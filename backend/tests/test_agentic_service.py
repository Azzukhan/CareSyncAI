import json
from datetime import date, datetime, timezone

import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db.base import Base
from app.models import (
    CareAgentType,
    CarePlanType,
    HealthDataFile,
    HealthAppConnection,
    HealthMetric,
    LabOrder,
    LabReport,
    MetricSource,
    MetricType,
    User,
    UserRole,
)
from app.modules.agentic.llm import MedicalStructuredResponse, agentic_llm_service
from app.modules.agentic.schemas import AgentQueryRequest, CarePlanCheckinCreateRequest
from app.modules.agentic.service import (
    create_checkin_response,
    delete_conversation_response,
    get_conversation_detail_response,
    list_plans_response,
    list_conversations_response,
    query_agent_response,
    update_conversation_title_response,
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


@pytest.mark.asyncio
async def test_conversation_title_can_be_updated(db_session: AsyncSession) -> None:
    user = await create_user(db_session, "patient5@example.com")
    response = await query_agent_response(
        db_session,
        user=user,
        payload=AgentQueryRequest(prompt="Help me review my asthma management", agent=CareAgentType.MEDICAL),
    )

    updated = await update_conversation_title_response(
        db_session,
        user=user,
        conversation_id=response.conversation_id,
        title="Asthma weekly review",
    )

    assert updated.title == "Asthma weekly review"

    detail = await get_conversation_detail_response(
        db_session,
        user=user,
        conversation_id=response.conversation_id,
    )
    assert detail.title == "Asthma weekly review"


@pytest.mark.asyncio
async def test_soft_deleted_conversation_is_hidden(db_session: AsyncSession) -> None:
    user = await create_user(db_session, "patient6@example.com")
    response = await query_agent_response(
        db_session,
        user=user,
        payload=AgentQueryRequest(prompt="Build me a better sleep routine", agent=CareAgentType.MEDICAL),
    )

    await delete_conversation_response(
        db_session,
        user=user,
        conversation_id=response.conversation_id,
    )

    conversations = await list_conversations_response(
        db_session,
        user=user,
        agent=CareAgentType.MEDICAL,
        limit=20,
        offset=0,
    )
    assert conversations == []

    with pytest.raises(HTTPException):
        await get_conversation_detail_response(
            db_session,
            user=user,
            conversation_id=response.conversation_id,
        )


@pytest.mark.asyncio
async def test_medical_agent_context_includes_recent_lab_reports(
    db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    patient = await create_user(db_session, "patient7@example.com")
    requester = await create_user(db_session, "gp7@example.com")
    order = LabOrder(
        patient_user_id=patient.id,
        requested_by_user_id=requester.id,
        test_description="Full blood count",
        status="completed",
    )
    db_session.add(order)
    await db_session.commit()
    await db_session.refresh(order)

    report = LabReport(
        lab_order_id=order.id,
        uploaded_by_user_id=requester.id,
        report_summary="Hemoglobin slightly low. Ferritin borderline low. White cell count normal.",
        file_url="/media/labs/fbc.pdf",
    )
    db_session.add(report)
    await db_session.commit()

    captured_snapshot: dict[str, object] = {}

    async def fake_run_medical(
        *,
        user_id: str,
        prompt: str,
        context_messages: list[dict[str, str]],
        context_snapshot: str,
    ) -> MedicalStructuredResponse:
        captured_snapshot.update(json.loads(context_snapshot))
        return MedicalStructuredResponse(
            summary="Reviewed the available lab reports.",
            highlights=["Lab report context received."],
            suggested_follow_ups=[],
        )

    monkeypatch.setattr(agentic_llm_service, "run_medical", fake_run_medical)

    await query_agent_response(
        db_session,
        user=patient,
        payload=AgentQueryRequest(
            prompt="Can you analyze my lab reports and tell me what to improve?",
            agent=CareAgentType.MEDICAL,
        ),
    )

    assert "lab_reports" in captured_snapshot
    lab_reports = captured_snapshot["lab_reports"]
    assert isinstance(lab_reports, list)
    assert len(lab_reports) == 1
    report_payload = lab_reports[0]
    assert isinstance(report_payload, dict)
    assert report_payload["test_description"] == "Full blood count"
    assert report_payload["status"] == "completed"
    assert "Hemoglobin slightly low" in report_payload["report_summary"]


@pytest.mark.asyncio
async def test_medical_agent_context_includes_activity_sync_data(
    db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    patient = await create_user(db_session, "patient8@example.com")
    health_file = HealthDataFile(
        user_id=patient.id,
        filename="apple-health.json",
        file_url="/media/health_data/apple-health.json",
        file_type="json",
        provider="apple_health",
        parsed_status="parsed",
        records_imported=3,
    )
    db_session.add(health_file)
    await db_session.flush()
    db_session.add(
        HealthAppConnection(
            user_id=patient.id,
            provider="apple_health",
            is_connected=True,
            sync_method="export_file",
            last_synced_at=datetime.now(timezone.utc),
        )
    )
    db_session.add_all(
        [
            HealthMetric(
                user_id=patient.id,
                metric_type=MetricType.STEPS,
                value=8200,
                unit="steps",
                recorded_date=date.today(),
                source=MetricSource.APP,
                provider="apple_health",
                health_data_file_id=health_file.id,
            ),
            HealthMetric(
                user_id=patient.id,
                metric_type=MetricType.ACTIVE_MINUTES,
                value=46,
                unit="minutes",
                recorded_date=date.today(),
                source=MetricSource.APP,
                provider="apple_health",
                health_data_file_id=health_file.id,
            ),
            HealthMetric(
                user_id=patient.id,
                metric_type=MetricType.DISTANCE_KM,
                value=5.1,
                unit="km",
                recorded_date=date.today(),
                source=MetricSource.APP,
                provider="apple_health",
                health_data_file_id=health_file.id,
            ),
        ]
    )
    await db_session.commit()

    captured_snapshot: dict[str, object] = {}

    async def fake_run_medical(
        *,
        user_id: str,
        prompt: str,
        context_messages: list[dict[str, str]],
        context_snapshot: str,
    ) -> MedicalStructuredResponse:
        captured_snapshot.update(json.loads(context_snapshot))
        return MedicalStructuredResponse(
            summary="Reviewed the current activity trends.",
            highlights=["Activity sync context received."],
            suggested_follow_ups=[],
        )

    monkeypatch.setattr(agentic_llm_service, "run_medical", fake_run_medical)

    await query_agent_response(
        db_session,
        user=patient,
        payload=AgentQueryRequest(
            prompt="Analyze my current activity and tell me how much to increase my steps.",
            agent=CareAgentType.MEDICAL,
        ),
    )

    assert "activity_overview" in captured_snapshot
    assert "activity_sync_sources" in captured_snapshot
    assert "authoritative_activity_sources" in captured_snapshot
    assert "verified_activity_providers" in captured_snapshot
    assert "recent_activity_days" in captured_snapshot
    assert "latest_activity_metrics" in captured_snapshot
    assert captured_snapshot["hydration_tracking_available"] is False
    latest_metrics = captured_snapshot["latest_activity_metrics"]
    assert isinstance(latest_metrics, dict)
    assert latest_metrics["steps"]["value"] == 8200
    assert latest_metrics["steps"]["provider"] == "apple_health"
    assert latest_metrics["steps"]["source_label"] == "Apple Health"
    sources = captured_snapshot["activity_sync_sources"]
    assert isinstance(sources, list)
    assert any(
        isinstance(source, dict) and source.get("provider") == "apple_health"
        for source in sources
    )
    authoritative_sources = captured_snapshot["authoritative_activity_sources"]
    assert isinstance(authoritative_sources, list)
    assert any(
        isinstance(source, dict) and source.get("provider") == "apple_health"
        for source in authoritative_sources
    )
    recent_days = captured_snapshot["recent_activity_days"]
    assert isinstance(recent_days, list)
    assert any(
        isinstance(day, dict)
        and day.get("metrics", {}).get("steps", {}).get("value") == 8200
        for day in recent_days
    )
