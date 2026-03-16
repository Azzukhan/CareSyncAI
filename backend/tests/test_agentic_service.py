from datetime import date

import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db.base import Base
from app.models import CareAgentType, CarePlanType, User, UserRole
from app.modules.agentic.llm import agentic_llm_service
from app.modules.agentic.schemas import AgentQueryRequest, CarePlanCheckinCreateRequest
from app.modules.agentic.service import (
    create_checkin_response,
    get_conversation_detail_response,
    list_plans_response,
    query_agent_response,
)


@pytest.fixture
async def db_session(tmp_path) -> AsyncSession:
    database_path = tmp_path / "agentic-test.db"
    engine = create_async_engine(f"sqlite+aiosqlite:///{database_path}")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with session_factory() as session:
        yield session

    await engine.dispose()


@pytest.fixture(autouse=True)
def force_fallback_llm(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(agentic_llm_service, "_client", None)


async def create_user(session: AsyncSession, email: str) -> User:
    user = User(
        nhs_healthcare_id=email.split("@")[0],
        full_name=email.split("@")[0].title(),
        email=email,
        password_hash="hashed",
        role=UserRole.PATIENT,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user


@pytest.mark.asyncio
async def test_query_agent_creates_conversation_and_active_plan(db_session: AsyncSession) -> None:
    user = await create_user(db_session, "patient1@example.com")

    response = await query_agent_response(
        db_session,
        user=user,
        payload=AgentQueryRequest(prompt="Build me a gentle weekly exercise plan", agent=CareAgentType.EXERCISE),
    )

    assert response.conversation_id
    assert response.preferred_panel == "plan"
    assert response.data.plan is not None
    assert response.data.plan.plan_type == "exercise"
    assert len(response.data.plan.items) > 0

    detail = await get_conversation_detail_response(
        db_session,
        user=user,
        conversation_id=response.conversation_id,
    )
    assert detail.agent == CareAgentType.EXERCISE
    assert len(detail.messages) == 1
    assert detail.messages[0].response_data is not None


@pytest.mark.asyncio
async def test_conversation_access_is_scoped_to_authenticated_user(db_session: AsyncSession) -> None:
    owner = await create_user(db_session, "patient2@example.com")
    intruder = await create_user(db_session, "patient3@example.com")

    response = await query_agent_response(
        db_session,
        user=owner,
        payload=AgentQueryRequest(prompt="Help me plan meals", agent=CareAgentType.DIET),
    )

    with pytest.raises(HTTPException):
        await get_conversation_detail_response(
            db_session,
            user=intruder,
            conversation_id=response.conversation_id,
        )


@pytest.mark.asyncio
async def test_checkin_updates_yesterday_summary(db_session: AsyncSession) -> None:
    user = await create_user(db_session, "patient4@example.com")
    response = await query_agent_response(
        db_session,
        user=user,
        payload=AgentQueryRequest(prompt="Create an exercise plan I can actually follow", agent=CareAgentType.EXERCISE),
    )
    plan = response.data.plan
    assert plan is not None
    tracked_item = plan.items[0]

    checkin_date = date.today()
    await create_checkin_response(
        db_session,
        user=user,
        item_id=tracked_item.id,
        payload=CarePlanCheckinCreateRequest(
            checkin_date=checkin_date,
            status="completed",
        ),
    )

    plans = await list_plans_response(
        db_session,
        user=user,
        plan_type=CarePlanType.EXERCISE,
        status_filter="active",
    )
    assert len(plans) == 1
    returned_item = next(item for item in plans[0].items if item.id == tracked_item.id)
    assert returned_item.latest_checkin is not None
    assert returned_item.latest_checkin.checkin_date == checkin_date
