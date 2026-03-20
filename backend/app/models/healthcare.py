import enum
import uuid
from datetime import date, datetime, timezone

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class UserRole(str, enum.Enum):
    PATIENT = "patient"
    GP = "gp"
    SPECIALIST = "specialist"
    LAB = "lab"
    PHARMACY = "pharmacy"


class User(Base):
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    nhs_healthcare_id: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    patient_profile: Mapped["PatientProfile | None"] = relationship(back_populates="patient_user")


class PatientProfile(Base):
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("user.id"), unique=True)
    date_of_birth: Mapped[str | None] = mapped_column(String(20), nullable=True)
    phone_number: Mapped[str | None] = mapped_column(String(40), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    blood_group: Mapped[str | None] = mapped_column(String(8), nullable=True)
    allergies: Mapped[str | None] = mapped_column(Text, nullable=True)
    chronic_conditions: Mapped[str | None] = mapped_column(Text, nullable=True)

    patient_user: Mapped[User] = relationship(back_populates="patient_profile")


class GPVisit(Base):
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_user_id: Mapped[str] = mapped_column(String(36), ForeignKey("user.id"), index=True)
    gp_user_id: Mapped[str] = mapped_column(String(36), ForeignKey("user.id"), index=True)
    notes: Mapped[str] = mapped_column(Text)
    is_hidden_by_patient: Mapped[bool] = mapped_column(Boolean, default=False)
    shared_with_gp: Mapped[bool] = mapped_column(Boolean, default=False)
    shared_with_specialist: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )


class SpecialistReferral(Base):
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_user_id: Mapped[str] = mapped_column(String(36), ForeignKey("user.id"), index=True)
    referred_by_user_id: Mapped[str] = mapped_column(String(36), ForeignKey("user.id"), index=True)
    specialist_notes: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(40), default="open")
    is_hidden_by_patient: Mapped[bool] = mapped_column(Boolean, default=False)
    shared_with_gp: Mapped[bool] = mapped_column(Boolean, default=False)
    shared_with_specialist: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class LabOrder(Base):
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_user_id: Mapped[str] = mapped_column(String(36), ForeignKey("user.id"), index=True)
    requested_by_user_id: Mapped[str] = mapped_column(String(36), ForeignKey("user.id"), index=True)
    test_description: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(40), default="ordered")
    shared_with_gp: Mapped[bool] = mapped_column(Boolean, default=False)
    shared_with_specialist: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class LabReport(Base):
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    lab_order_id: Mapped[str] = mapped_column(String(36), ForeignKey("laborder.id"), index=True)
    uploaded_by_user_id: Mapped[str] = mapped_column(String(36), ForeignKey("user.id"), index=True)
    report_summary: Mapped[str] = mapped_column(Text)
    file_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class MedicationOrder(Base):
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_user_id: Mapped[str] = mapped_column(String(36), ForeignKey("user.id"), index=True)
    prescribed_by_user_id: Mapped[str] = mapped_column(String(36), ForeignKey("user.id"), index=True)
    medicine_name: Mapped[str] = mapped_column(String(120))
    dosage_instruction: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(40), default="new")
    shared_with_gp: Mapped[bool] = mapped_column(Boolean, default=False)
    shared_with_specialist: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class MetricType(str, enum.Enum):
    STEPS = "steps"
    HEART_RATE = "heart_rate"
    CALORIES = "calories"
    SLEEP_HOURS = "sleep_hours"
    WEIGHT = "weight"
    BLOOD_PRESSURE = "blood_pressure"
    DISTANCE_KM = "distance_km"
    ACTIVE_MINUTES = "active_minutes"


class MetricSource(str, enum.Enum):
    MANUAL = "manual"
    FILE = "file"
    APP = "app"


class HealthDataFile(Base):
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("user.id"), index=True)
    filename: Mapped[str] = mapped_column(String(255))
    file_url: Mapped[str] = mapped_column(String(255))
    file_type: Mapped[str] = mapped_column(String(20))  # csv, json, xml
    provider: Mapped[str | None] = mapped_column(String(40), nullable=True, index=True)
    export_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    export_locale: Mapped[str | None] = mapped_column(String(80), nullable=True)
    source_date_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    source_date_end: Mapped[date | None] = mapped_column(Date, nullable=True)
    source_tag_counts: Mapped[dict[str, int] | None] = mapped_column(JSON, nullable=True)
    source_profile: Mapped[dict[str, object] | None] = mapped_column(JSON, nullable=True)
    parsed_status: Mapped[str] = mapped_column(String(20), default="pending")  # pending, parsed, failed
    records_imported: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class HealthAppConnection(Base):
    __table_args__ = (UniqueConstraint("user_id", "provider", name="uq_healthappconnection_user_provider"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("user.id"), index=True)
    provider: Mapped[str] = mapped_column(String(40), index=True)
    is_connected: Mapped[bool] = mapped_column(Boolean, default=True)
    sync_method: Mapped[str] = mapped_column(String(30), default="export_file")
    connected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class HealthMetric(Base):
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("user.id"), index=True)
    metric_type: Mapped[MetricType] = mapped_column(Enum(MetricType), index=True)
    value: Mapped[float] = mapped_column(Float)
    unit: Mapped[str] = mapped_column(String(30))
    recorded_date: Mapped[date] = mapped_column(Date, index=True)
    recorded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    source: Mapped[MetricSource] = mapped_column(Enum(MetricSource), default=MetricSource.MANUAL)
    provider: Mapped[str | None] = mapped_column(String(40), nullable=True, index=True)
    health_data_file_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("healthdatafile.id"), nullable=True, index=True
    )
    external_type: Mapped[str | None] = mapped_column(String(120), nullable=True)
    source_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    source_version: Mapped[str | None] = mapped_column(String(40), nullable=True)
    source_unit: Mapped[str | None] = mapped_column(String(60), nullable=True)
    source_created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    source_start_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    source_end_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    source_record_count: Mapped[int] = mapped_column(Integer, default=1)
    source_metadata: Mapped[dict[str, object] | None] = mapped_column(JSON, nullable=True)
    device_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    raw_device: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class ChatMessage(Base):
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("user.id"), index=True)
    role: Mapped[str] = mapped_column(String(20))  # user, assistant
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class ExerciseSchedule(Base):
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("user.id"), index=True)
    day_of_week: Mapped[str] = mapped_column(String(15))  # monday, tuesday, ...
    exercise_name: Mapped[str] = mapped_column(String(120))
    duration_minutes: Mapped[int] = mapped_column(Integer)
    intensity: Mapped[str] = mapped_column(String(20))  # low, moderate, high
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class DietPlan(Base):
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("user.id"), index=True)
    meal_type: Mapped[str] = mapped_column(String(20))  # breakfast, lunch, dinner, snack
    food_items: Mapped[str] = mapped_column(Text)  # JSON-encoded list
    calories: Mapped[float] = mapped_column(Float, default=0.0)
    protein_g: Mapped[float] = mapped_column(Float, default=0.0)
    carbs_g: Mapped[float] = mapped_column(Float, default=0.0)
    fat_g: Mapped[float] = mapped_column(Float, default=0.0)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class CalendarEvent(Base):
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("user.id"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    event_type: Mapped[str] = mapped_column(String(20), default="custom")  # exercise, diet, appointment, custom
    event_date: Mapped[date] = mapped_column(Date, index=True)
    start_time: Mapped[str | None] = mapped_column(String(10), nullable=True)  # HH:MM
    end_time: Mapped[str | None] = mapped_column(String(10), nullable=True)
    is_recurring: Mapped[bool] = mapped_column(Boolean, default=False)
    recurrence_rule: Mapped[str | None] = mapped_column(String(100), nullable=True)  # e.g. "weekly"
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
