from datetime import date, datetime

from pydantic import BaseModel


class CalendarEventCreate(BaseModel):
    title: str
    description: str | None = None
    event_type: str = "custom"  # exercise, diet, appointment, custom
    event_date: date
    start_time: str | None = None  # HH:MM
    end_time: str | None = None
    is_recurring: bool = False
    recurrence_rule: str | None = None


class CalendarEventUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    event_type: str | None = None
    event_date: date | None = None
    start_time: str | None = None
    end_time: str | None = None
    is_recurring: bool | None = None
    recurrence_rule: str | None = None


class CalendarEventResponse(BaseModel):
    id: str
    title: str
    description: str | None = None
    event_type: str
    event_date: date
    start_time: str | None = None
    end_time: str | None = None
    is_recurring: bool
    recurrence_rule: str | None = None
    created_at: datetime


class CalendarEventsListResponse(BaseModel):
    items: list[CalendarEventResponse]
