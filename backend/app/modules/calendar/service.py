from datetime import date

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import CalendarEvent, ExerciseSchedule


async def get_events(
    db: AsyncSession,
    user_id: str,
    start_date: date | None = None,
    end_date: date | None = None,
) -> list[CalendarEvent]:
    query = select(CalendarEvent).where(CalendarEvent.user_id == user_id)
    if start_date:
        query = query.where(CalendarEvent.event_date >= start_date)
    if end_date:
        query = query.where(CalendarEvent.event_date <= end_date)
    query = query.order_by(CalendarEvent.event_date, CalendarEvent.start_time)
    result = await db.execute(query)
    return list(result.scalars().all())


async def create_event(
    db: AsyncSession,
    user_id: str,
    title: str,
    event_date: date,
    description: str | None = None,
    event_type: str = "custom",
    start_time: str | None = None,
    end_time: str | None = None,
    is_recurring: bool = False,
    recurrence_rule: str | None = None,
) -> CalendarEvent:
    event = CalendarEvent(
        user_id=user_id,
        title=title,
        description=description,
        event_type=event_type,
        event_date=event_date,
        start_time=start_time,
        end_time=end_time,
        is_recurring=is_recurring,
        recurrence_rule=recurrence_rule,
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)
    return event


async def update_event(
    db: AsyncSession,
    event: CalendarEvent,
    **kwargs: str | date | bool | None,
) -> CalendarEvent:
    for key, value in kwargs.items():
        if value is not None:
            setattr(event, key, value)
    await db.commit()
    await db.refresh(event)
    return event


async def delete_event(db: AsyncSession, event: CalendarEvent) -> None:
    await db.delete(event)
    await db.commit()


async def sync_exercise_to_calendar(
    db: AsyncSession,
    user_id: str,
    week_start: date,
) -> list[CalendarEvent]:
    """Sync exercise schedule to calendar events for the given week."""
    day_names = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]

    # Get active exercise schedules
    result = await db.execute(
        select(ExerciseSchedule).where(
            ExerciseSchedule.user_id == user_id,
            ExerciseSchedule.is_active.is_(True),
        )
    )
    schedules = list(result.scalars().all())

    if not schedules:
        return []

    # Remove existing exercise events for this week
    week_end = date.fromordinal(week_start.toordinal() + 6)
    await db.execute(
        delete(CalendarEvent).where(
            CalendarEvent.user_id == user_id,
            CalendarEvent.event_type == "exercise",
            CalendarEvent.event_date >= week_start,
            CalendarEvent.event_date <= week_end,
        )
    )

    events: list[CalendarEvent] = []
    for schedule in schedules:
        day_lower = schedule.day_of_week.lower()
        if day_lower not in day_names:
            continue
        day_index = day_names.index(day_lower)
        event_date = date.fromordinal(week_start.toordinal() + day_index)

        event = CalendarEvent(
            user_id=user_id,
            title=schedule.exercise_name,
            description=f"Duration: {schedule.duration_minutes} min | Intensity: {schedule.intensity}"
            + (f"\n{schedule.notes}" if schedule.notes else ""),
            event_type="exercise",
            event_date=event_date,
            start_time="07:00",
            end_time=f"{7 + schedule.duration_minutes // 60:02d}:{schedule.duration_minutes % 60:02d}",
            is_recurring=True,
            recurrence_rule="weekly",
        )
        db.add(event)
        events.append(event)

    await db.commit()
    for e in events:
        await db.refresh(e)
    return events
