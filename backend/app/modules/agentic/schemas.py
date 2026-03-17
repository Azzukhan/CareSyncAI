from datetime import date, datetime

from pydantic import BaseModel, Field, model_validator

from app.models import (
    AgentPreferredPanel,
    CareAgentType,
    CarePlanCheckinStatus,
    CarePlanItemType,
    CarePlanStatus,
    CarePlanType,
)


class YesterdaySummaryResponse(BaseModel):
    date: date
    planned_count: int = 0
    completed_count: int = 0
    missed_count: int = 0
    skipped_count: int = 0
    replaced_count: int = 0


class CarePlanCheckinCreateRequest(BaseModel):
    checkin_date: date
    status: CarePlanCheckinStatus
    pain_level: int | None = None
    energy_level: int | None = None
    hunger_level: int | None = None
    notes: str | None = None
    replacement_title: str | None = None


class CarePlanCheckinResponse(BaseModel):
    id: str
    checkin_date: date
    status: CarePlanCheckinStatus
    pain_level: int | None = None
    energy_level: int | None = None
    hunger_level: int | None = None
    notes: str | None = None
    replacement_title: str | None = None
    created_at: datetime


class CarePlanItemOverrideResponse(BaseModel):
    id: str
    override_date: date
    title: str | None = None
    target_time: str | None = None
    duration_minutes: int | None = None
    calories: float | None = None
    intensity: str | None = None
    instructions: str | None = None
    details: dict[str, object] | None = None
    is_deleted: bool


class CarePlanItemUpdateRequest(BaseModel):
    title: str | None = None
    scheduled_day: str | None = None
    scheduled_date: date | None = None
    meal_slot: str | None = None
    target_time: str | None = None
    duration_minutes: int | None = None
    calories: float | None = None
    intensity: str | None = None
    instructions: str | None = None
    details: dict[str, object] | None = None
    override_date: date | None = None


class CarePlanItemResponse(BaseModel):
    id: str
    item_type: CarePlanItemType
    title: str
    scheduled_day: str | None = None
    scheduled_date: date | None = None
    meal_slot: str | None = None
    target_time: str | None = None
    duration_minutes: int | None = None
    calories: float | None = None
    intensity: str | None = None
    instructions: str | None = None
    details: dict[str, object] | None = None
    order_index: int
    latest_checkin: CarePlanCheckinResponse | None = None
    overrides: list[CarePlanItemOverrideResponse] = Field(default_factory=list)


class CarePlanUpdateRequest(BaseModel):
    title: str | None = None
    summary: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    status: CarePlanStatus | None = None


class CarePlanResponse(BaseModel):
    id: str
    plan_type: CarePlanType
    status: CarePlanStatus
    title: str
    summary: str | None = None
    start_date: date
    end_date: date | None = None
    version: int
    supersedes_plan_id: str | None = None
    created_from_conversation_id: str | None = None
    created_at: datetime
    updated_at: datetime
    yesterday_summary: YesterdaySummaryResponse
    items: list[CarePlanItemResponse] = Field(default_factory=list)


class CarePlansResponse(BaseModel):
    items: list[CarePlanResponse]


class AgentCalendarEventResponse(BaseModel):
    id: str
    plan_id: str
    plan_item_id: str
    plan_type: CarePlanType
    title: str
    scheduled_for: date
    target_time: str | None = None
    meal_slot: str | None = None
    intensity: str | None = None
    duration_minutes: int | None = None
    calories: float | None = None
    instructions: str | None = None
    status: CarePlanCheckinStatus | None = None
    source: str = "plan"


class AgentCalendarEventsResponse(BaseModel):
    items: list[AgentCalendarEventResponse]


class AgentProfileUpdateRequest(BaseModel):
    goals: list[str] | None = None
    allergies: list[str] | None = None
    injuries_pain_points: str | None = None
    dietary_constraints: list[str] | None = None
    motivation_style: str | None = None
    equipment_access: str | None = None
    schedule_preferences: list[str] | None = None
    sleep_work_routine: str | None = None
    preferred_plan_horizon_days: int | None = None
    share_medical_history: bool | None = None
    share_medications: bool | None = None
    share_health_metrics: bool | None = None
    additional_notes: str | None = None


class AgentProfileResponse(BaseModel):
    id: str
    goals: list[str] = Field(default_factory=list)
    allergies: list[str] = Field(default_factory=list)
    injuries_pain_points: str | None = None
    dietary_constraints: list[str] = Field(default_factory=list)
    motivation_style: str | None = None
    equipment_access: str | None = None
    schedule_preferences: list[str] = Field(default_factory=list)
    sleep_work_routine: str | None = None
    preferred_plan_horizon_days: int
    share_medical_history: bool
    share_medications: bool
    share_health_metrics: bool
    additional_notes: str | None = None
    completeness_score: int = 0
    updated_at: datetime


class AgentMessageItem(BaseModel):
    id: str
    prompt: str
    created_at: datetime
    preferred_panel: AgentPreferredPanel
    response_data: dict[str, object] | None = None


class AgentConversationSummary(BaseModel):
    id: str
    agent: CareAgentType
    title: str
    starred: bool
    updated_at: datetime
    message_count: int


class AgentConversationDetail(AgentConversationSummary):
    messages: list[AgentMessageItem] = Field(default_factory=list)


class AgentConversationListResponse(BaseModel):
    items: list[AgentConversationSummary]


class AgentConversationDetailResponse(BaseModel):
    data: AgentConversationDetail


class AgentConversationStarRequest(BaseModel):
    starred: bool


class AgentConversationUpdateRequest(BaseModel):
    title: str

    @model_validator(mode="after")
    def validate_title(self) -> "AgentConversationUpdateRequest":
        if not self.title.strip():
            raise ValueError("Title cannot be empty.")
        return self


class AgentMutationResponse(BaseModel):
    success: bool = True


class AgentResponseData(BaseModel):
    summary: str
    highlights: list[str] = Field(default_factory=list)
    suggested_follow_ups: list[str] = Field(default_factory=list)
    plan: CarePlanResponse | None = None
    calendar_preview: list[AgentCalendarEventResponse] = Field(default_factory=list)
    yesterday_summary: YesterdaySummaryResponse | None = None


class AgentQueryRequest(BaseModel):
    prompt: str
    agent: CareAgentType
    conversation_id: str | None = None

    @model_validator(mode="after")
    def validate_prompt(self) -> "AgentQueryRequest":
        if not self.prompt.strip():
            raise ValueError("Prompt cannot be empty.")
        return self


class AgentQueryResponse(BaseModel):
    conversation_id: str
    response: str
    preferred_panel: AgentPreferredPanel
    data: AgentResponseData
