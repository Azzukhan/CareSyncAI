import enum
import uuid
from datetime import date, datetime, timezone

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class CareAgentType(str, enum.Enum):
    MEDICAL = "medical"
    EXERCISE = "exercise"
    DIET = "diet"


class AgentPreferredPanel(str, enum.Enum):
    SUMMARY = "summary"
    PLAN = "plan"
    CALENDAR = "calendar"
    HISTORY = "history"


class CarePlanType(str, enum.Enum):
    EXERCISE = "exercise"
    DIET = "diet"


class CarePlanStatus(str, enum.Enum):
    ACTIVE = "active"
    ARCHIVED = "archived"
    DRAFT = "draft"


class CarePlanItemType(str, enum.Enum):
    EXERCISE = "exercise"
    MEAL = "meal"


class CarePlanCheckinStatus(str, enum.Enum):
    COMPLETED = "completed"
    MISSED = "missed"
    SKIPPED = "skipped"
    REPLACED = "replaced"


class AgenticConversation(Base):
    __tablename__ = "agentic_conversation"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("user.id"), index=True)
    agent: Mapped[CareAgentType] = mapped_column(Enum(CareAgentType), index=True)
    title: Mapped[str] = mapped_column(String(255))
    starred: Mapped[bool] = mapped_column(Boolean, default=False)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        index=True,
    )

    messages: Mapped[list["AgenticMessage"]] = relationship(
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="AgenticMessage.created_at.asc()",
    )


class AgenticMessage(Base):
    __tablename__ = "agentic_message"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("user.id"), index=True)
    conversation_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("agentic_conversation.id"), index=True
    )
    prompt: Mapped[str] = mapped_column(Text)
    response_data: Mapped[dict[str, object] | None] = mapped_column(JSON, nullable=True)
    preferred_panel: Mapped[AgentPreferredPanel] = mapped_column(
        Enum(AgentPreferredPanel), default=AgentPreferredPanel.SUMMARY
    )
    status: Mapped[str] = mapped_column(String(20), default="pending")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    conversation: Mapped[AgenticConversation] = relationship(back_populates="messages")


class AgenticProfile(Base):
    __tablename__ = "agentic_profile"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("user.id"), unique=True, index=True
    )
    goals: Mapped[list[str]] = mapped_column(JSON, default=list)
    allergies: Mapped[list[str]] = mapped_column(JSON, default=list)
    injuries_pain_points: Mapped[str | None] = mapped_column(Text, nullable=True)
    dietary_constraints: Mapped[list[str]] = mapped_column(JSON, default=list)
    motivation_style: Mapped[str | None] = mapped_column(String(80), nullable=True)
    equipment_access: Mapped[str | None] = mapped_column(Text, nullable=True)
    schedule_preferences: Mapped[list[str]] = mapped_column(JSON, default=list)
    sleep_work_routine: Mapped[str | None] = mapped_column(Text, nullable=True)
    preferred_plan_horizon_days: Mapped[int] = mapped_column(Integer, default=28)
    share_medical_history: Mapped[bool] = mapped_column(Boolean, default=True)
    share_medications: Mapped[bool] = mapped_column(Boolean, default=True)
    share_health_metrics: Mapped[bool] = mapped_column(Boolean, default=True)
    additional_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class CarePlan(Base):
    __tablename__ = "care_plan"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("user.id"), index=True)
    plan_type: Mapped[CarePlanType] = mapped_column(Enum(CarePlanType), index=True)
    status: Mapped[CarePlanStatus] = mapped_column(
        Enum(CarePlanStatus), default=CarePlanStatus.ACTIVE, index=True
    )
    title: Mapped[str] = mapped_column(String(255))
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    start_date: Mapped[date] = mapped_column(Date, index=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    supersedes_plan_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("care_plan.id"), nullable=True, index=True
    )
    created_from_conversation_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("agentic_conversation.id"), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        index=True,
    )

    items: Mapped[list["CarePlanItem"]] = relationship(
        back_populates="plan",
        cascade="all, delete-orphan",
        order_by="CarePlanItem.order_index.asc()",
    )
    supersedes_plan: Mapped["CarePlan | None"] = relationship(
        remote_side=[id], uselist=False
    )


class CarePlanItem(Base):
    __tablename__ = "care_plan_item"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    plan_id: Mapped[str] = mapped_column(String(36), ForeignKey("care_plan.id"), index=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("user.id"), index=True)
    item_type: Mapped[CarePlanItemType] = mapped_column(Enum(CarePlanItemType), index=True)
    title: Mapped[str] = mapped_column(String(200))
    scheduled_day: Mapped[str | None] = mapped_column(String(16), nullable=True, index=True)
    scheduled_date: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    meal_slot: Mapped[str | None] = mapped_column(String(30), nullable=True)
    target_time: Mapped[str | None] = mapped_column(String(10), nullable=True)
    duration_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    calories: Mapped[float | None] = mapped_column(Float, nullable=True)
    intensity: Mapped[str | None] = mapped_column(String(20), nullable=True)
    instructions: Mapped[str | None] = mapped_column(Text, nullable=True)
    details: Mapped[dict[str, object] | None] = mapped_column(JSON, nullable=True)
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    plan: Mapped[CarePlan] = relationship(back_populates="items")
    overrides: Mapped[list["CarePlanItemOverride"]] = relationship(
        back_populates="plan_item",
        cascade="all, delete-orphan",
        order_by="CarePlanItemOverride.override_date.asc()",
    )
    checkins: Mapped[list["CarePlanCheckin"]] = relationship(
        back_populates="plan_item",
        cascade="all, delete-orphan",
        order_by="CarePlanCheckin.checkin_date.asc()",
    )


class CarePlanItemOverride(Base):
    __tablename__ = "care_plan_item_override"
    __table_args__ = (
        UniqueConstraint("plan_item_id", "override_date", name="uq_care_plan_item_override"),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    plan_item_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("care_plan_item.id"), index=True
    )
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("user.id"), index=True)
    override_date: Mapped[date] = mapped_column(Date, index=True)
    title: Mapped[str | None] = mapped_column(String(200), nullable=True)
    target_time: Mapped[str | None] = mapped_column(String(10), nullable=True)
    duration_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    calories: Mapped[float | None] = mapped_column(Float, nullable=True)
    intensity: Mapped[str | None] = mapped_column(String(20), nullable=True)
    instructions: Mapped[str | None] = mapped_column(Text, nullable=True)
    details: Mapped[dict[str, object] | None] = mapped_column(JSON, nullable=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    plan_item: Mapped[CarePlanItem] = relationship(back_populates="overrides")


class CarePlanCheckin(Base):
    __tablename__ = "care_plan_checkin"
    __table_args__ = (
        UniqueConstraint("plan_item_id", "checkin_date", name="uq_care_plan_checkin"),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    plan_item_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("care_plan_item.id"), index=True
    )
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("user.id"), index=True)
    checkin_date: Mapped[date] = mapped_column(Date, index=True)
    status: Mapped[CarePlanCheckinStatus] = mapped_column(
        Enum(CarePlanCheckinStatus), index=True
    )
    pain_level: Mapped[int | None] = mapped_column(Integer, nullable=True)
    energy_level: Mapped[int | None] = mapped_column(Integer, nullable=True)
    hunger_level: Mapped[int | None] = mapped_column(Integer, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    replacement_title: Mapped[str | None] = mapped_column(String(200), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    plan_item: Mapped[CarePlanItem] = relationship(back_populates="checkins")
