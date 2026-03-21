import json
import re
from datetime import date, datetime, timedelta, timezone
from typing import cast

from fastapi import HTTPException, status
from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    AgenticConversation,
    AgenticMessage,
    AgenticProfile,
    AgentPreferredPanel,
    CareAgentType,
    CarePlan,
    CarePlanCheckin,
    CarePlanCheckinStatus,
    CarePlanItem,
    CarePlanItemOverride,
    CarePlanItemType,
    CarePlanStatus,
    CarePlanType,
    LabOrder,
    LabReport,
    MedicationOrder,
    PatientProfile,
    User,
)
from app.modules.agentic.llm import (
    DietStructuredResponse,
    ExerciseStructuredResponse,
    IncompletePlanError,
    agentic_llm_service,
)
from app.modules.health_data.service import (
    get_canonical_activity_context,
)
from app.modules.agentic.schemas import (
    AgentCalendarEventResponse,
    AgentConversationDetail,
    AgentConversationSummary,
    AgentMessageItem,
    AgentProfileResponse,
    AgentProfileUpdateRequest,
    AgentQueryRequest,
    AgentQueryResponse,
    AgentResponseData,
    CarePlanCheckinCreateRequest,
    CarePlanCheckinResponse,
    CarePlanItemOverrideResponse,
    CarePlanItemResponse,
    CarePlanItemUpdateRequest,
    CarePlanResponse,
    CarePlanUpdateRequest,
    YesterdaySummaryResponse,
)

WEEKDAY_INDEX = {
    "monday": 0,
    "tuesday": 1,
    "wednesday": 2,
    "thursday": 3,
    "friday": 4,
    "saturday": 5,
    "sunday": 6,
}
DAY_SEQUENCE_PATTERN = re.compile(r"\bday\s*([1-9]\d*)\b", re.IGNORECASE)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _slug_weekday(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip().lower()
    return normalized if normalized in WEEKDAY_INDEX else None


def _extract_weekday(value: str | None) -> str | None:
    if not value:
        return None
    normalized = re.sub(r"[^a-z]+", " ", value.strip().lower())
    for weekday in WEEKDAY_INDEX:
        if re.search(rf"\b{weekday}\b", normalized):
            return weekday
    return None


def _parse_schedule_date_token(value: str | None, *, plan_start: date) -> date | None:
    if not value:
        return None
    normalized = value.strip()
    if not normalized:
        return None
    lowered = normalized.lower()
    if lowered == "today":
        return plan_start
    if lowered == "tomorrow":
        return plan_start + timedelta(days=1)
    if lowered == "day after tomorrow":
        return plan_start + timedelta(days=2)
    try:
        return date.fromisoformat(normalized)
    except ValueError:
        pass
    match = DAY_SEQUENCE_PATTERN.search(lowered.replace("-", " "))
    if match is None:
        return None
    offset = max(0, int(match.group(1)) - 1)
    return plan_start + timedelta(days=offset)


def _plan_span_days(start_date: date, end_date: date | None) -> int:
    effective_end = end_date or start_date
    return max(1, (effective_end - start_date).days + 1)


def _sequenced_schedule_date(
    *,
    start_date: date,
    end_date: date | None,
    order_index: int,
    total_items: int,
) -> date | None:
    if order_index < 0 or total_items <= 0:
        return None
    span_days = _plan_span_days(start_date, end_date)
    if total_items <= span_days:
        return start_date + timedelta(days=min(order_index, span_days - 1))
    if total_items % span_days == 0:
        items_per_day = total_items // span_days
        if items_per_day > 0:
            return start_date + timedelta(
                days=min(order_index // items_per_day, span_days - 1)
            )
    return start_date + timedelta(
        days=min(int(order_index * span_days / total_items), span_days - 1)
    )


def _resolve_schedule_fields(
    *,
    scheduled_day: str | None,
    scheduled_date: date | None,
    start_date: date,
    end_date: date | None,
    order_index: int,
    total_items: int,
) -> tuple[str | None, date | None]:
    resolved_weekday = _slug_weekday(scheduled_day) or _extract_weekday(scheduled_day)
    if scheduled_date is not None:
        return resolved_weekday, scheduled_date
    if resolved_weekday is not None:
        return resolved_weekday, None
    resolved_date = _parse_schedule_date_token(scheduled_day, plan_start=start_date)
    if resolved_date is not None:
        return None, resolved_date
    return None, _sequenced_schedule_date(
        start_date=start_date,
        end_date=end_date,
        order_index=order_index,
        total_items=total_items,
    )


def _resolved_item_schedule(item: CarePlanItem) -> tuple[str | None, date | None]:
    active_items = [candidate for candidate in item.plan.items if candidate.is_active]
    total_items = max(1, len(active_items))
    return _resolve_schedule_fields(
        scheduled_day=item.scheduled_day,
        scheduled_date=item.scheduled_date,
        start_date=item.plan.start_date,
        end_date=item.plan.end_date,
        order_index=item.order_index,
        total_items=total_items,
    )


def _parse_list(value: str | None) -> list[str]:
    if not value:
        return []
    parts = [part.strip() for chunk in value.splitlines() for part in chunk.split(",")]
    return [part for part in parts if part]


def _truncate_title(prompt: str, fallback: str) -> str:
    normalized = " ".join(prompt.split())
    if not normalized:
        return fallback
    return normalized[:60] + ("..." if len(normalized) > 60 else "")


def build_context_messages(messages: list[AgenticMessage], limit: int = 10) -> list[dict[str, str]]:
    context: list[dict[str, str]] = []
    for message in sorted(messages, key=lambda item: (item.created_at, item.id))[-limit:]:
        context.append({"role": "user", "content": message.prompt})
        if isinstance(message.response_data, dict):
            summary = message.response_data.get("summary")
            if isinstance(summary, str) and summary.strip():
                context.append({"role": "assistant", "content": summary.strip()})
    return context


async def get_or_create_agentic_profile(db: AsyncSession, user: User) -> AgenticProfile:
    profile = await db.scalar(select(AgenticProfile).where(AgenticProfile.user_id == user.id))
    if profile is not None:
        return profile

    patient_profile = await db.scalar(
        select(PatientProfile).where(PatientProfile.user_id == user.id)
    )
    profile = AgenticProfile(
        user_id=user.id,
        allergies=_parse_list(patient_profile.allergies) if patient_profile else [],
    )
    db.add(profile)
    await db.flush()
    return profile


def _profile_completeness(profile: AgenticProfile) -> int:
    checks = [
        bool(profile.goals),
        bool(profile.allergies),
        bool(profile.injuries_pain_points),
        bool(profile.dietary_constraints),
        bool(profile.motivation_style),
        bool(profile.equipment_access),
        bool(profile.schedule_preferences),
        bool(profile.sleep_work_routine),
        bool(profile.additional_notes),
    ]
    return int((sum(checks) / len(checks)) * 100)


def _map_profile(profile: AgenticProfile) -> AgentProfileResponse:
    return AgentProfileResponse(
        id=profile.id,
        goals=list(profile.goals or []),
        allergies=list(profile.allergies or []),
        injuries_pain_points=profile.injuries_pain_points,
        dietary_constraints=list(profile.dietary_constraints or []),
        motivation_style=profile.motivation_style,
        equipment_access=profile.equipment_access,
        schedule_preferences=list(profile.schedule_preferences or []),
        sleep_work_routine=profile.sleep_work_routine,
        preferred_plan_horizon_days=profile.preferred_plan_horizon_days,
        share_medical_history=profile.share_medical_history,
        share_medications=profile.share_medications,
        share_health_metrics=profile.share_health_metrics,
        additional_notes=profile.additional_notes,
        completeness_score=_profile_completeness(profile),
        updated_at=profile.updated_at,
    )


async def get_profile_response(db: AsyncSession, user: User) -> AgentProfileResponse:
    profile = await get_or_create_agentic_profile(db, user)
    await db.commit()
    await db.refresh(profile)
    return _map_profile(profile)


async def update_profile_response(
    db: AsyncSession, user: User, payload: AgentProfileUpdateRequest
) -> AgentProfileResponse:
    profile = await get_or_create_agentic_profile(db, user)
    updates = payload.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(profile, key, value)
    profile.updated_at = _utcnow()
    await db.commit()
    await db.refresh(profile)
    return _map_profile(profile)


def _conversation_query(user_id: str) -> Select[tuple[AgenticConversation]]:
    return select(AgenticConversation).where(
        AgenticConversation.user_id == user_id,
        AgenticConversation.is_active.is_(True),
        AgenticConversation.is_deleted.is_(False),
    )


async def _get_conversation_or_404(
    db: AsyncSession, user_id: str, conversation_id: str
) -> AgenticConversation:
    conversation = await db.scalar(
        _conversation_query(user_id)
        .where(AgenticConversation.id == conversation_id)
        .options(selectinload(AgenticConversation.messages))
    )
    if conversation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found",
        )
    return conversation


def _map_checkin(checkin: CarePlanCheckin | None) -> CarePlanCheckinResponse | None:
    if checkin is None:
        return None
    return CarePlanCheckinResponse(
        id=checkin.id,
        checkin_date=checkin.checkin_date,
        status=checkin.status,
        pain_level=checkin.pain_level,
        energy_level=checkin.energy_level,
        hunger_level=checkin.hunger_level,
        notes=checkin.notes,
        replacement_title=checkin.replacement_title,
        created_at=checkin.created_at,
    )


def _map_override(override: CarePlanItemOverride) -> CarePlanItemOverrideResponse:
    return CarePlanItemOverrideResponse(
        id=override.id,
        override_date=override.override_date,
        title=override.title,
        target_time=override.target_time,
        duration_minutes=override.duration_minutes,
        calories=override.calories,
        intensity=override.intensity,
        instructions=override.instructions,
        details=cast(dict[str, object] | None, override.details),
        is_deleted=override.is_deleted,
    )


def _matches_item_on_date(item: CarePlanItem, target_date: date) -> bool:
    weekday, scheduled_date = _resolved_item_schedule(item)
    if scheduled_date is not None:
        return scheduled_date == target_date
    if weekday is None:
        return False
    return target_date.weekday() == WEEKDAY_INDEX[weekday]


def _checkin_for_date(item: CarePlanItem, target_date: date) -> CarePlanCheckin | None:
    for checkin in item.checkins:
        if checkin.checkin_date == target_date:
            return checkin
    return None


def _yesterday_summary_for_plan(plan: CarePlan, today: date | None = None) -> YesterdaySummaryResponse:
    anchor = today or date.today()
    yesterday = anchor - timedelta(days=1)
    summary = YesterdaySummaryResponse(date=yesterday)
    for item in plan.items:
        if not item.is_active or not _matches_item_on_date(item, yesterday):
            continue
        summary.planned_count += 1
        checkin = _checkin_for_date(item, yesterday)
        if checkin is None:
            continue
        if checkin.status == CarePlanCheckinStatus.COMPLETED:
            summary.completed_count += 1
        elif checkin.status == CarePlanCheckinStatus.MISSED:
            summary.missed_count += 1
        elif checkin.status == CarePlanCheckinStatus.SKIPPED:
            summary.skipped_count += 1
        elif checkin.status == CarePlanCheckinStatus.REPLACED:
            summary.replaced_count += 1
    return summary


def _latest_checkin(item: CarePlanItem) -> CarePlanCheckin | None:
    if not item.checkins:
        return None
    return max(item.checkins, key=lambda checkin: (checkin.checkin_date, checkin.created_at))


def _map_plan_item(item: CarePlanItem) -> CarePlanItemResponse:
    active_overrides = [override for override in item.overrides if not override.is_deleted]
    scheduled_day, scheduled_date = _resolved_item_schedule(item)
    return CarePlanItemResponse(
        id=item.id,
        item_type=item.item_type,
        title=item.title,
        scheduled_day=scheduled_day,
        scheduled_date=scheduled_date,
        meal_slot=item.meal_slot,
        target_time=item.target_time,
        duration_minutes=item.duration_minutes,
        calories=item.calories,
        intensity=item.intensity,
        instructions=item.instructions,
        details=cast(dict[str, object] | None, item.details),
        order_index=item.order_index,
        latest_checkin=_map_checkin(_latest_checkin(item)),
        overrides=[_map_override(override) for override in active_overrides],
    )


def _map_plan(plan: CarePlan) -> CarePlanResponse:
    return CarePlanResponse(
        id=plan.id,
        plan_type=plan.plan_type,
        status=plan.status,
        title=plan.title,
        summary=plan.summary,
        start_date=plan.start_date,
        end_date=plan.end_date,
        version=plan.version,
        supersedes_plan_id=plan.supersedes_plan_id,
        created_from_conversation_id=plan.created_from_conversation_id,
        created_at=plan.created_at,
        updated_at=plan.updated_at,
        yesterday_summary=_yesterday_summary_for_plan(plan),
        items=[_map_plan_item(item) for item in plan.items if item.is_active],
    )


def _occurrence_payload(
    item: CarePlanItem, target_date: date
) -> AgentCalendarEventResponse | None:
    if not item.is_active or not _matches_item_on_date(item, target_date):
        return None

    override = next(
        (candidate for candidate in item.overrides if candidate.override_date == target_date),
        None,
    )
    if override is not None and override.is_deleted:
        return None

    title = override.title if override and override.title else item.title
    target_time = override.target_time if override and override.target_time else item.target_time
    duration_minutes = (
        override.duration_minutes
        if override and override.duration_minutes is not None
        else item.duration_minutes
    )
    calories = override.calories if override and override.calories is not None else item.calories
    intensity = override.intensity if override and override.intensity else item.intensity
    instructions = (
        override.instructions if override and override.instructions else item.instructions
    )
    details = override.details if override and override.details is not None else item.details
    checkin = _checkin_for_date(item, target_date)

    return AgentCalendarEventResponse(
        id=f"{item.id}:{target_date.isoformat()}",
        plan_id=item.plan_id,
        plan_item_id=item.id,
        plan_type=item.plan.plan_type,
        title=title,
        scheduled_for=target_date,
        target_time=target_time,
        meal_slot=item.meal_slot,
        intensity=intensity,
        duration_minutes=duration_minutes,
        calories=calories,
        instructions=instructions,
        details=cast(dict[str, object] | None, details),
        status=checkin.status if checkin else None,
        source="override" if override is not None else "plan",
    )


def _build_date_range(start_date: date, end_date: date) -> list[date]:
    day_count = (end_date - start_date).days
    return [start_date + timedelta(days=offset) for offset in range(day_count + 1)]


async def _get_plans_query(
    db: AsyncSession,
    *,
    user_id: str,
    plan_type: CarePlanType | None,
    status_filter: str,
) -> list[CarePlan]:
    query = (
        select(CarePlan)
        .where(CarePlan.user_id == user_id)
        .execution_options(populate_existing=True)
        .options(
            selectinload(CarePlan.items).selectinload(CarePlanItem.overrides),
            selectinload(CarePlan.items).selectinload(CarePlanItem.checkins),
        )
        .order_by(CarePlan.updated_at.desc())
    )
    if plan_type is not None:
        query = query.where(CarePlan.plan_type == plan_type)
    if status_filter == "active":
        query = query.where(CarePlan.status == CarePlanStatus.ACTIVE)
    elif status_filter == "history":
        query = query.where(CarePlan.status != CarePlanStatus.ACTIVE)
    return list((await db.execute(query)).scalars().all())


async def list_conversations_response(
    db: AsyncSession,
    *,
    user: User,
    agent: CareAgentType,
    limit: int,
    offset: int,
) -> list[AgentConversationSummary]:
    conversations = list(
        (
            await db.execute(
                _conversation_query(user.id)
                .where(AgenticConversation.agent == agent)
                .options(selectinload(AgenticConversation.messages))
                .order_by(AgenticConversation.updated_at.desc())
                .limit(limit)
                .offset(offset)
            )
        )
        .scalars()
        .all()
    )
    return [_map_conversation_summary(conversation) for conversation in conversations]


def _map_conversation_summary(conversation: AgenticConversation) -> AgentConversationSummary:
    return AgentConversationSummary(
        id=conversation.id,
        agent=conversation.agent,
        title=conversation.title,
        starred=conversation.starred,
        updated_at=conversation.updated_at,
        message_count=len([message for message in conversation.messages if message.is_active]),
    )


async def get_conversation_detail_response(
    db: AsyncSession, *, user: User, conversation_id: str
) -> AgentConversationDetail:
    conversation = await _get_conversation_or_404(db, user.id, conversation_id)
    return AgentConversationDetail(
        id=conversation.id,
        agent=conversation.agent,
        title=conversation.title,
        starred=conversation.starred,
        updated_at=conversation.updated_at,
        message_count=len([message for message in conversation.messages if message.is_active]),
        messages=[
            AgentMessageItem(
                id=message.id,
                prompt=message.prompt,
                created_at=message.created_at,
                preferred_panel=message.preferred_panel,
                response_data=cast(dict[str, object] | None, message.response_data),
            )
            for message in conversation.messages
            if message.is_active
        ],
    )


async def star_conversation_response(
    db: AsyncSession, *, user: User, conversation_id: str, starred: bool
) -> None:
    conversation = await _get_conversation_or_404(db, user.id, conversation_id)
    conversation.starred = starred
    conversation.updated_at = _utcnow()
    await db.commit()


async def update_conversation_title_response(
    db: AsyncSession, *, user: User, conversation_id: str, title: str
) -> AgentConversationSummary:
    conversation = await _get_conversation_or_404(db, user.id, conversation_id)
    conversation.title = title.strip()
    conversation.updated_at = _utcnow()
    await db.commit()
    return _map_conversation_summary(conversation)


async def delete_conversation_response(
    db: AsyncSession, *, user: User, conversation_id: str
) -> None:
    conversation = await _get_conversation_or_404(db, user.id, conversation_id)
    conversation.is_deleted = True
    conversation.is_active = False
    conversation.updated_at = _utcnow()
    await db.commit()


async def _build_context_snapshot(db: AsyncSession, user: User) -> tuple[AgenticProfile, str]:
    profile = await get_or_create_agentic_profile(db, user)
    patient_profile = await db.scalar(
        select(PatientProfile).where(PatientProfile.user_id == user.id)
    )
    active_plans = await _get_plans_query(
        db, user_id=user.id, plan_type=None, status_filter="active"
    )
    payload: dict[str, object] = {
        "agent_profile": {
            "goals": list(profile.goals or []),
            "allergies": list(profile.allergies or []),
            "injuries_pain_points": profile.injuries_pain_points,
            "dietary_constraints": list(profile.dietary_constraints or []),
            "motivation_style": profile.motivation_style,
            "equipment_access": profile.equipment_access,
            "schedule_preferences": list(profile.schedule_preferences or []),
            "sleep_work_routine": profile.sleep_work_routine,
            "preferred_plan_horizon_days": profile.preferred_plan_horizon_days,
            "additional_notes": profile.additional_notes,
        },
        "active_plans": [
            {
                "plan_type": plan.plan_type.value,
                "title": plan.title,
                "summary": plan.summary,
                "yesterday_summary": _yesterday_summary_for_plan(plan).model_dump(mode="json"),
                "items": [
                    {
                        "title": item.title,
                        "scheduled_day": item.scheduled_day,
                        "meal_slot": item.meal_slot,
                        "target_time": item.target_time,
                        "duration_minutes": item.duration_minutes,
                        "calories": item.calories,
                        "intensity": item.intensity,
                        "instructions": item.instructions,
                    }
                    for item in plan.items[:8]
                    if item.is_active
                ],
            }
            for plan in active_plans
        ],
    }

    if profile.share_medical_history:
        payload["patient_profile"] = {
            "blood_group": patient_profile.blood_group if patient_profile else None,
            "chronic_conditions": (
                _parse_list(patient_profile.chronic_conditions) if patient_profile else []
            ),
        }
        lab_reports = list(
            (
                await db.execute(
                    select(LabReport, LabOrder, User.full_name)
                    .join(LabOrder, LabReport.lab_order_id == LabOrder.id)
                    .join(User, LabOrder.requested_by_user_id == User.id)
                    .where(LabOrder.patient_user_id == user.id)
                    .order_by(LabReport.created_at.desc())
                    .limit(10)
                )
            ).all()
        )
        payload["lab_reports"] = [
            {
                "test_description": order.test_description,
                "status": order.status,
                "ordered_by_name": ordered_by_name,
                "report_summary": report.report_summary,
                "file_attached": bool(report.file_url),
                "created_at": report.created_at.isoformat(),
            }
            for report, order, ordered_by_name in lab_reports
        ]

    if profile.share_medications:
        medications = list(
            (
                await db.execute(
                    select(MedicationOrder)
                    .where(MedicationOrder.patient_user_id == user.id)
                    .order_by(MedicationOrder.created_at.desc())
                    .limit(10)
                )
            )
            .scalars()
            .all()
        )
        payload["medications"] = [
            {
                "medicine_name": medication.medicine_name,
                "dosage_instruction": medication.dosage_instruction,
                "status": medication.status,
            }
            for medication in medications
        ]

    if profile.share_health_metrics:
        activity_context = await get_canonical_activity_context(
            db,
            user_id=user.id,
            days=30,
        )
        payload["hydration_tracking_available"] = bool(
            activity_context.get("hydration_tracking_available", False)
        )
        payload["activity_sync_sources"] = activity_context.get("activity_sync_sources", [])
        payload["verified_activity_providers"] = activity_context.get("verified_providers", [])
        payload["authoritative_activity_sources"] = activity_context.get(
            "authoritative_sources", []
        )
        payload["latest_imported_file"] = activity_context.get("latest_imported_file")
        payload["latest_activity_metrics"] = activity_context.get(
            "latest_activity_metrics", {}
        )
        payload["today_activity_metrics"] = activity_context.get(
            "today_activity_metrics", {}
        )
        payload["recent_activity_days"] = activity_context.get("recent_activity_days", [])
        payload["recent_metrics"] = [
            {
                "metric_type": metric_name,
                **metric_payload,
            }
            for day in activity_context.get("recent_activity_days", [])
            if isinstance(day, dict)
            for metric_name, metric_payload in (
                day.get("metrics", {}).items()
                if isinstance(day.get("metrics"), dict)
                else []
            )
        ][:12]
        payload["activity_overview"] = {
            "range_start": activity_context.get("range_start"),
            "range_end": activity_context.get("range_end"),
            "connected_apps": activity_context.get("connected_apps", 0),
            "imported_files": activity_context.get("imported_files", 0),
            "metrics": activity_context.get("metrics", []),
        }

    return profile, json.dumps(payload, default=str, indent=2)


async def _persist_plan_from_exercise_response(
    db: AsyncSession,
    *,
    user: User,
    conversation: AgenticConversation,
    response: ExerciseStructuredResponse,
) -> CarePlan:
    current = await db.scalar(
        select(CarePlan).where(
            CarePlan.user_id == user.id,
            CarePlan.plan_type == CarePlanType.EXERCISE,
            CarePlan.status == CarePlanStatus.ACTIVE,
        )
    )
    version = 1
    if current is not None:
        current.status = CarePlanStatus.ARCHIVED
        current.end_date = response.start_date - timedelta(days=1)
        current.updated_at = _utcnow()
        version = current.version + 1

    plan = CarePlan(
        user_id=user.id,
        plan_type=CarePlanType.EXERCISE,
        status=CarePlanStatus.ACTIVE,
        title=response.plan_title,
        summary=response.summary,
        start_date=response.start_date,
        end_date=response.end_date,
        version=version,
        supersedes_plan_id=current.id if current is not None else None,
        created_from_conversation_id=conversation.id,
    )
    db.add(plan)
    await db.flush()

    total_items = max(1, len(response.items))
    for order_index, item in enumerate(response.items):
        scheduled_day, scheduled_date = _resolve_schedule_fields(
            scheduled_day=item.scheduled_day,
            scheduled_date=None,
            start_date=response.start_date,
            end_date=response.end_date,
            order_index=order_index,
            total_items=total_items,
        )
        db.add(
            CarePlanItem(
                plan_id=plan.id,
                user_id=user.id,
                item_type=CarePlanItemType.EXERCISE,
                title=item.title,
                scheduled_day=scheduled_day,
                scheduled_date=scheduled_date,
                target_time=item.target_time,
                duration_minutes=item.duration_minutes,
                intensity=item.intensity,
                instructions=item.instructions,
                details={"bullets": item.details},
                order_index=order_index,
            )
        )
    await db.flush()
    return plan


async def _persist_plan_from_diet_response(
    db: AsyncSession,
    *,
    user: User,
    conversation: AgenticConversation,
    response: DietStructuredResponse,
) -> CarePlan:
    current = await db.scalar(
        select(CarePlan).where(
            CarePlan.user_id == user.id,
            CarePlan.plan_type == CarePlanType.DIET,
            CarePlan.status == CarePlanStatus.ACTIVE,
        )
    )
    version = 1
    if current is not None:
        current.status = CarePlanStatus.ARCHIVED
        current.end_date = response.start_date - timedelta(days=1)
        current.updated_at = _utcnow()
        version = current.version + 1

    plan = CarePlan(
        user_id=user.id,
        plan_type=CarePlanType.DIET,
        status=CarePlanStatus.ACTIVE,
        title=response.plan_title,
        summary=response.summary,
        start_date=response.start_date,
        end_date=response.end_date,
        version=version,
        supersedes_plan_id=current.id if current is not None else None,
        created_from_conversation_id=conversation.id,
    )
    db.add(plan)
    await db.flush()

    total_items = max(1, len(response.items))
    for order_index, item in enumerate(response.items):
        scheduled_day, scheduled_date = _resolve_schedule_fields(
            scheduled_day=item.scheduled_day,
            scheduled_date=None,
            start_date=response.start_date,
            end_date=response.end_date,
            order_index=order_index,
            total_items=total_items,
        )
        db.add(
            CarePlanItem(
                plan_id=plan.id,
                user_id=user.id,
                item_type=CarePlanItemType.MEAL,
                title=item.title,
                scheduled_day=scheduled_day,
                scheduled_date=scheduled_date,
                meal_slot=item.meal_slot,
                target_time=item.target_time,
                calories=item.calories,
                instructions=item.instructions,
                details={
                    "bullets": item.details,
                    "protein_g": item.protein_g,
                    "carbs_g": item.carbs_g,
                    "fat_g": item.fat_g,
                },
                order_index=order_index,
            )
        )
    await db.flush()
    return plan


async def _reload_plan(db: AsyncSession, plan_id: str) -> CarePlan:
    plan = await db.scalar(
        select(CarePlan)
        .where(CarePlan.id == plan_id)
        .execution_options(populate_existing=True)
        .options(
            selectinload(CarePlan.items).selectinload(CarePlanItem.overrides),
            selectinload(CarePlan.items).selectinload(CarePlanItem.checkins),
        )
    )
    if plan is None:
        raise HTTPException(status_code=404, detail="Plan not found")
    return plan


async def _calendar_preview_for_user(
    db: AsyncSession,
    *,
    user: User,
    plan_type: CarePlanType | None,
    days: int = 7,
) -> list[AgentCalendarEventResponse]:
    plans = await _get_plans_query(
        db, user_id=user.id, plan_type=plan_type, status_filter="active"
    )
    start = date.today()
    end = start + timedelta(days=days - 1)
    events: list[AgentCalendarEventResponse] = []
    for plan in plans:
        for current_date in _build_date_range(start, end):
            for item in plan.items:
                occurrence = _occurrence_payload(item, current_date)
                if occurrence is not None:
                    events.append(occurrence)
    return sorted(events, key=lambda item: (item.scheduled_for, item.target_time or "99:99"))[:12]


def _build_response_data(
    *,
    summary: str,
    highlights: list[str],
    suggested_follow_ups: list[str],
    plan: CarePlanResponse | None,
    calendar_preview: list[AgentCalendarEventResponse],
    yesterday_summary: YesterdaySummaryResponse | None,
) -> AgentResponseData:
    return AgentResponseData(
        summary=summary,
        highlights=highlights,
        suggested_follow_ups=suggested_follow_ups,
        plan=plan,
        calendar_preview=calendar_preview,
        yesterday_summary=yesterday_summary,
    )


async def query_agent_response(
    db: AsyncSession, *, user: User, payload: AgentQueryRequest
) -> AgentQueryResponse:
    if payload.conversation_id:
        conversation = await _get_conversation_or_404(db, user.id, payload.conversation_id)
        if conversation.agent != payload.agent:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Conversation agent does not match requested agent",
            )
        existing_messages = [message for message in conversation.messages if message.is_active]
    else:
        conversation = AgenticConversation(
            user_id=user.id,
            agent=payload.agent,
            title=_truncate_title(payload.prompt, f"{payload.agent.value.title()} Chat"),
        )
        db.add(conversation)
        await db.flush()
        existing_messages = []

    context_messages = build_context_messages(existing_messages)
    _, context_snapshot = await _build_context_snapshot(db, user)

    pending_message = AgenticMessage(
        user_id=user.id,
        conversation_id=conversation.id,
        prompt=payload.prompt,
        preferred_panel=AgentPreferredPanel.SUMMARY,
        status="pending",
    )
    db.add(pending_message)
    conversation.updated_at = _utcnow()
    await db.flush()

    try:
        plan_response: CarePlanResponse | None = None
        yesterday_summary: YesterdaySummaryResponse | None = None
        calendar_preview: list[AgentCalendarEventResponse] = []

        if payload.agent == CareAgentType.MEDICAL:
            result = await agentic_llm_service.run_medical(
                user_id=user.id,
                prompt=payload.prompt,
                context_messages=context_messages,
                context_snapshot=context_snapshot,
            )
            calendar_preview = await _calendar_preview_for_user(db, user=user, plan_type=None)
            response_data = _build_response_data(
                summary=result.summary,
                highlights=result.highlights,
                suggested_follow_ups=result.suggested_follow_ups,
                plan=None,
                calendar_preview=calendar_preview,
                yesterday_summary=None,
            )
            response_text = result.summary
            preferred_panel = result.preferred_panel
        elif payload.agent == CareAgentType.EXERCISE:
            result = await agentic_llm_service.run_exercise(
                user_id=user.id,
                prompt=payload.prompt,
                context_messages=context_messages,
                context_snapshot=context_snapshot,
            )
            plan = await _persist_plan_from_exercise_response(
                db, user=user, conversation=conversation, response=result
            )
            await db.flush()
            plan = await _reload_plan(db, plan.id)
            plan_response = _map_plan(plan)
            yesterday_summary = plan_response.yesterday_summary
            calendar_preview = await _calendar_preview_for_user(
                db, user=user, plan_type=CarePlanType.EXERCISE
            )
            response_data = _build_response_data(
                summary=result.summary,
                highlights=result.highlights,
                suggested_follow_ups=result.suggested_follow_ups,
                plan=plan_response,
                calendar_preview=calendar_preview,
                yesterday_summary=yesterday_summary,
            )
            response_text = result.summary
            preferred_panel = result.preferred_panel
        else:
            result = await agentic_llm_service.run_diet(
                user_id=user.id,
                prompt=payload.prompt,
                context_messages=context_messages,
                context_snapshot=context_snapshot,
            )
            plan = await _persist_plan_from_diet_response(
                db, user=user, conversation=conversation, response=result
            )
            await db.flush()
            plan = await _reload_plan(db, plan.id)
            plan_response = _map_plan(plan)
            yesterday_summary = plan_response.yesterday_summary
            calendar_preview = await _calendar_preview_for_user(
                db, user=user, plan_type=CarePlanType.DIET
            )
            response_data = _build_response_data(
                summary=result.summary,
                highlights=result.highlights,
                suggested_follow_ups=result.suggested_follow_ups,
                plan=plan_response,
                calendar_preview=calendar_preview,
                yesterday_summary=yesterday_summary,
            )
            response_text = result.summary
            preferred_panel = result.preferred_panel
    except IncompletePlanError as exc:
        pending_message.status = "failed"
        pending_message.response_data = _build_response_data(
            summary=str(exc),
            highlights=[
                "No partial plan was saved to your active calendar.",
                "Ask again and I will regenerate the full plan day by day.",
            ],
            suggested_follow_ups=[
                "Rebuild the full plan day by day",
                "Create the full first 30 days with exact Day 1 to Day 30 scheduling",
                "Make the 30-day plan simpler but still complete",
            ],
            plan=None,
            calendar_preview=[],
            yesterday_summary=None,
        ).model_dump(mode="json")
        pending_message.preferred_panel = AgentPreferredPanel.SUMMARY
        conversation.updated_at = _utcnow()
        await db.commit()
        return AgentQueryResponse(
            conversation_id=conversation.id,
            response=str(exc),
            preferred_panel=AgentPreferredPanel.SUMMARY,
            data=AgentResponseData.model_validate(pending_message.response_data),
        )
    except Exception:
        pending_message.status = "failed"
        pending_message.response_data = _build_response_data(
            summary="I couldn't process that request safely. Please try again with more detail.",
            highlights=[],
            suggested_follow_ups=[
                "Tell me what changed yesterday",
                "Show my current plan",
                "Help me update one item instead of the whole plan",
            ],
            plan=None,
            calendar_preview=[],
            yesterday_summary=None,
        ).model_dump(mode="json")
        pending_message.preferred_panel = AgentPreferredPanel.SUMMARY
        conversation.updated_at = _utcnow()
        await db.commit()
        return AgentQueryResponse(
            conversation_id=conversation.id,
            response="I couldn't process that request safely. Please try again with more detail.",
            preferred_panel=AgentPreferredPanel.SUMMARY,
            data=AgentResponseData.model_validate(pending_message.response_data),
        )

    pending_message.response_data = response_data.model_dump(mode="json")
    pending_message.preferred_panel = preferred_panel
    pending_message.status = "completed"
    conversation.updated_at = _utcnow()
    await db.commit()

    return AgentQueryResponse(
        conversation_id=conversation.id,
        response=response_text,
        preferred_panel=preferred_panel,
        data=response_data,
    )


async def list_plans_response(
    db: AsyncSession,
    *,
    user: User,
    plan_type: CarePlanType | None,
    status_filter: str,
) -> list[CarePlanResponse]:
    plans = await _get_plans_query(
        db, user_id=user.id, plan_type=plan_type, status_filter=status_filter
    )
    return [_map_plan(plan) for plan in plans]


async def update_plan_response(
    db: AsyncSession, *, user: User, plan_id: str, payload: CarePlanUpdateRequest
) -> CarePlanResponse:
    plan = await db.scalar(
        select(CarePlan)
        .where(CarePlan.id == plan_id, CarePlan.user_id == user.id)
        .options(
            selectinload(CarePlan.items).selectinload(CarePlanItem.overrides),
            selectinload(CarePlan.items).selectinload(CarePlanItem.checkins),
        )
    )
    if plan is None:
        raise HTTPException(status_code=404, detail="Plan not found")
    updates = payload.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(plan, key, value)
    plan.updated_at = _utcnow()
    await db.commit()
    await db.refresh(plan)
    plan = await _reload_plan(db, plan.id)
    return _map_plan(plan)


async def update_plan_item_response(
    db: AsyncSession, *, user: User, item_id: str, payload: CarePlanItemUpdateRequest
) -> CarePlanItemResponse:
    item = await db.scalar(
        select(CarePlanItem)
        .where(CarePlanItem.id == item_id, CarePlanItem.user_id == user.id)
        .options(
            selectinload(CarePlanItem.overrides),
            selectinload(CarePlanItem.checkins),
            selectinload(CarePlanItem.plan),
        )
    )
    if item is None:
        raise HTTPException(status_code=404, detail="Plan item not found")

    updates = payload.model_dump(exclude_unset=True)
    override_date = updates.pop("override_date", None)
    if override_date is not None:
        override = next(
            (candidate for candidate in item.overrides if candidate.override_date == override_date),
            None,
        )
        if override is None:
            override = CarePlanItemOverride(
                plan_item_id=item.id,
                user_id=user.id,
                override_date=override_date,
            )
            db.add(override)
        for key, value in updates.items():
            setattr(override, key, value)
        override.updated_at = _utcnow()
    else:
        if "scheduled_day" in updates:
            updates["scheduled_day"] = _slug_weekday(cast(str | None, updates["scheduled_day"]))
        for key, value in updates.items():
            setattr(item, key, value)
        item.updated_at = _utcnow()

    await db.commit()
    item = await db.scalar(
        select(CarePlanItem)
        .where(CarePlanItem.id == item_id, CarePlanItem.user_id == user.id)
        .options(
            selectinload(CarePlanItem.overrides),
            selectinload(CarePlanItem.checkins),
            selectinload(CarePlanItem.plan).selectinload(CarePlan.items),
        )
    )
    assert item is not None
    return _map_plan_item(item)


async def create_checkin_response(
    db: AsyncSession,
    *,
    user: User,
    item_id: str,
    payload: CarePlanCheckinCreateRequest,
) -> CarePlanCheckinResponse:
    item = await db.scalar(
        select(CarePlanItem).where(CarePlanItem.id == item_id, CarePlanItem.user_id == user.id)
    )
    if item is None:
        raise HTTPException(status_code=404, detail="Plan item not found")

    checkin = await db.scalar(
        select(CarePlanCheckin).where(
            CarePlanCheckin.plan_item_id == item.id,
            CarePlanCheckin.checkin_date == payload.checkin_date,
        )
    )
    if checkin is None:
        checkin = CarePlanCheckin(
            plan_item_id=item.id,
            user_id=user.id,
            checkin_date=payload.checkin_date,
            status=payload.status,
        )
        db.add(checkin)

    checkin.status = payload.status
    checkin.pain_level = payload.pain_level
    checkin.energy_level = payload.energy_level
    checkin.hunger_level = payload.hunger_level
    checkin.notes = payload.notes
    checkin.replacement_title = payload.replacement_title
    checkin.updated_at = _utcnow()
    await db.commit()
    await db.refresh(checkin)
    return cast(CarePlanCheckinResponse, _map_checkin(checkin))


async def get_calendar_events_response(
    db: AsyncSession,
    *,
    user: User,
    plan_type: CarePlanType | None,
    start_date: date,
    end_date: date,
) -> list[AgentCalendarEventResponse]:
    plans = await _get_plans_query(
        db, user_id=user.id, plan_type=plan_type, status_filter="active"
    )
    events: list[AgentCalendarEventResponse] = []
    for plan in plans:
        for current_date in _build_date_range(start_date, end_date):
            for item in plan.items:
                occurrence = _occurrence_payload(item, current_date)
                if occurrence is not None:
                    events.append(occurrence)
    return sorted(events, key=lambda item: (item.scheduled_for, item.target_time or "99:99"))
