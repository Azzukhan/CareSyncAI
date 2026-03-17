from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.api.deps import DbSession, require_roles
from app.models import CareAgentType, CarePlanType, User, UserRole
from app.modules.agentic.schemas import (
    AgentCalendarEventsResponse,
    AgentConversationDetailResponse,
    AgentConversationListResponse,
    AgentConversationStarRequest,
    AgentConversationSummary,
    AgentConversationUpdateRequest,
    AgentMutationResponse,
    AgentProfileResponse,
    AgentProfileUpdateRequest,
    AgentQueryRequest,
    AgentQueryResponse,
    CarePlanCheckinCreateRequest,
    CarePlanCheckinResponse,
    CarePlanItemResponse,
    CarePlanItemUpdateRequest,
    CarePlanResponse,
    CarePlanUpdateRequest,
    CarePlansResponse,
)
from app.modules.agentic.service import (
    create_checkin_response,
    delete_conversation_response,
    get_calendar_events_response,
    get_conversation_detail_response,
    get_profile_response,
    list_conversations_response,
    list_plans_response,
    query_agent_response,
    star_conversation_response,
    update_conversation_title_response,
    update_plan_item_response,
    update_plan_response,
    update_profile_response,
)

router = APIRouter(prefix="/agentic", tags=["agentic"])


@router.post("/chat/query", response_model=AgentQueryResponse)
async def query_agent(
    payload: AgentQueryRequest,
    db: DbSession,
    current_user: Annotated[User, Depends(require_roles(UserRole.PATIENT))],
) -> AgentQueryResponse:
    return await query_agent_response(db, user=current_user, payload=payload)


@router.get("/conversations", response_model=AgentConversationListResponse)
async def list_conversations(
    agent: CareAgentType,
    db: DbSession,
    current_user: Annotated[User, Depends(require_roles(UserRole.PATIENT))],
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> AgentConversationListResponse:
    items = await list_conversations_response(
        db,
        user=current_user,
        agent=agent,
        limit=limit,
        offset=offset,
    )
    return AgentConversationListResponse(items=items)


@router.get("/conversations/{conversation_id}", response_model=AgentConversationDetailResponse)
async def get_conversation(
    conversation_id: str,
    db: DbSession,
    current_user: Annotated[User, Depends(require_roles(UserRole.PATIENT))],
) -> AgentConversationDetailResponse:
    detail = await get_conversation_detail_response(
        db, user=current_user, conversation_id=conversation_id
    )
    return AgentConversationDetailResponse(data=detail)


@router.patch("/conversations/{conversation_id}/star", response_model=AgentMutationResponse)
async def star_conversation(
    conversation_id: str,
    payload: AgentConversationStarRequest,
    db: DbSession,
    current_user: Annotated[User, Depends(require_roles(UserRole.PATIENT))],
) -> AgentMutationResponse:
    await star_conversation_response(
        db,
        user=current_user,
        conversation_id=conversation_id,
        starred=payload.starred,
    )
    return AgentMutationResponse(success=True)


@router.patch("/conversations/{conversation_id}", response_model=AgentConversationSummary)
async def update_conversation(
    conversation_id: str,
    payload: AgentConversationUpdateRequest,
    db: DbSession,
    current_user: Annotated[User, Depends(require_roles(UserRole.PATIENT))],
) -> AgentConversationSummary:
    return await update_conversation_title_response(
        db,
        user=current_user,
        conversation_id=conversation_id,
        title=payload.title,
    )


@router.delete("/conversations/{conversation_id}", response_model=AgentMutationResponse)
async def delete_conversation(
    conversation_id: str,
    db: DbSession,
    current_user: Annotated[User, Depends(require_roles(UserRole.PATIENT))],
) -> AgentMutationResponse:
    await delete_conversation_response(db, user=current_user, conversation_id=conversation_id)
    return AgentMutationResponse(success=True)


@router.get("/profile", response_model=AgentProfileResponse)
async def get_profile(
    db: DbSession,
    current_user: Annotated[User, Depends(require_roles(UserRole.PATIENT))],
) -> AgentProfileResponse:
    return await get_profile_response(db, current_user)


@router.put("/profile", response_model=AgentProfileResponse)
async def update_profile(
    payload: AgentProfileUpdateRequest,
    db: DbSession,
    current_user: Annotated[User, Depends(require_roles(UserRole.PATIENT))],
) -> AgentProfileResponse:
    return await update_profile_response(db, current_user, payload)


@router.get("/plans", response_model=CarePlansResponse)
async def list_plans(
    db: DbSession,
    current_user: Annotated[User, Depends(require_roles(UserRole.PATIENT))],
    plan_type: CarePlanType | None = Query(default=None),
    status_filter: str = Query(default="active", alias="status"),
) -> CarePlansResponse:
    items = await list_plans_response(
        db,
        user=current_user,
        plan_type=plan_type,
        status_filter=status_filter,
    )
    return CarePlansResponse(items=items)


@router.patch("/plans/{plan_id}", response_model=CarePlanResponse)
async def update_plan(
    plan_id: str,
    payload: CarePlanUpdateRequest,
    db: DbSession,
    current_user: Annotated[User, Depends(require_roles(UserRole.PATIENT))],
) -> CarePlanResponse:
    return await update_plan_response(db, user=current_user, plan_id=plan_id, payload=payload)


@router.patch("/plan-items/{item_id}", response_model=CarePlanItemResponse)
async def update_plan_item(
    item_id: str,
    payload: CarePlanItemUpdateRequest,
    db: DbSession,
    current_user: Annotated[User, Depends(require_roles(UserRole.PATIENT))],
) -> CarePlanItemResponse:
    return await update_plan_item_response(db, user=current_user, item_id=item_id, payload=payload)


@router.post("/plan-items/{item_id}/checkins", response_model=CarePlanCheckinResponse)
async def create_checkin(
    item_id: str,
    payload: CarePlanCheckinCreateRequest,
    db: DbSession,
    current_user: Annotated[User, Depends(require_roles(UserRole.PATIENT))],
) -> CarePlanCheckinResponse:
    return await create_checkin_response(db, user=current_user, item_id=item_id, payload=payload)


@router.get("/calendar", response_model=AgentCalendarEventsResponse)
async def get_calendar(
    db: DbSession,
    current_user: Annotated[User, Depends(require_roles(UserRole.PATIENT))],
    start_date: date,
    end_date: date,
    plan_type: CarePlanType | None = Query(default=None),
) -> AgentCalendarEventsResponse:
    items = await get_calendar_events_response(
        db,
        user=current_user,
        plan_type=plan_type,
        start_date=start_date,
        end_date=end_date,
    )
    return AgentCalendarEventsResponse(items=items)
