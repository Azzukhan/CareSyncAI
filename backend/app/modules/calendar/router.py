from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import DbSession, require_roles
from app.models import CalendarEvent, User, UserRole
from app.modules.calendar.schemas import (
    CalendarEventCreate,
    CalendarEventResponse,
    CalendarEventUpdate,
    CalendarEventsListResponse,
)
from app.modules.calendar.service import (
    create_event,
    delete_event,
    get_events,
    sync_exercise_to_calendar,
    update_event,
)
from sqlalchemy import select

router = APIRouter(prefix="/calendar", tags=["calendar"])


@router.get("/events", response_model=CalendarEventsListResponse)
async def list_events(
    db: DbSession,
    current_user: Annotated[User, Depends(require_roles(UserRole.PATIENT))],
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
) -> CalendarEventsListResponse:
    events = await get_events(db, current_user.id, start_date, end_date)
    return CalendarEventsListResponse(
        items=[
            CalendarEventResponse(
                id=e.id,
                title=e.title,
                description=e.description,
                event_type=e.event_type,
                event_date=e.event_date,
                start_time=e.start_time,
                end_time=e.end_time,
                is_recurring=e.is_recurring,
                recurrence_rule=e.recurrence_rule,
                created_at=e.created_at,
            )
            for e in events
        ]
    )


@router.post("/events", response_model=CalendarEventResponse, status_code=status.HTTP_201_CREATED)
async def create_calendar_event(
    payload: CalendarEventCreate,
    db: DbSession,
    current_user: Annotated[User, Depends(require_roles(UserRole.PATIENT))],
) -> CalendarEventResponse:
    event = await create_event(
        db,
        current_user.id,
        title=payload.title,
        event_date=payload.event_date,
        description=payload.description,
        event_type=payload.event_type,
        start_time=payload.start_time,
        end_time=payload.end_time,
        is_recurring=payload.is_recurring,
        recurrence_rule=payload.recurrence_rule,
    )
    return CalendarEventResponse(
        id=event.id,
        title=event.title,
        description=event.description,
        event_type=event.event_type,
        event_date=event.event_date,
        start_time=event.start_time,
        end_time=event.end_time,
        is_recurring=event.is_recurring,
        recurrence_rule=event.recurrence_rule,
        created_at=event.created_at,
    )


@router.put("/events/{event_id}", response_model=CalendarEventResponse)
async def update_calendar_event(
    event_id: str,
    payload: CalendarEventUpdate,
    db: DbSession,
    current_user: Annotated[User, Depends(require_roles(UserRole.PATIENT))],
) -> CalendarEventResponse:
    event = await db.scalar(
        select(CalendarEvent).where(
            CalendarEvent.id == event_id,
            CalendarEvent.user_id == current_user.id,
        )
    )
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    update_data = payload.model_dump(exclude_unset=True)
    event = await update_event(db, event, **update_data)
    return CalendarEventResponse(
        id=event.id,
        title=event.title,
        description=event.description,
        event_type=event.event_type,
        event_date=event.event_date,
        start_time=event.start_time,
        end_time=event.end_time,
        is_recurring=event.is_recurring,
        recurrence_rule=event.recurrence_rule,
        created_at=event.created_at,
    )


@router.delete("/events/{event_id}")
async def delete_calendar_event(
    event_id: str,
    db: DbSession,
    current_user: Annotated[User, Depends(require_roles(UserRole.PATIENT))],
) -> dict[str, str]:
    event = await db.scalar(
        select(CalendarEvent).where(
            CalendarEvent.id == event_id,
            CalendarEvent.user_id == current_user.id,
        )
    )
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    await delete_event(db, event)
    return {"message": "Event deleted"}


@router.post("/events/sync-exercise", response_model=CalendarEventsListResponse)
async def sync_exercise_schedule(
    db: DbSession,
    current_user: Annotated[User, Depends(require_roles(UserRole.PATIENT))],
    week_start: date = Query(default_factory=date.today),
) -> CalendarEventsListResponse:
    events = await sync_exercise_to_calendar(db, current_user.id, week_start)
    return CalendarEventsListResponse(
        items=[
            CalendarEventResponse(
                id=e.id,
                title=e.title,
                description=e.description,
                event_type=e.event_type,
                event_date=e.event_date,
                start_time=e.start_time,
                end_time=e.end_time,
                is_recurring=e.is_recurring,
                recurrence_rule=e.recurrence_rule,
                created_at=e.created_at,
            )
            for e in events
        ]
    )
