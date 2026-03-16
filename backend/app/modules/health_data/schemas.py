from datetime import date, datetime

from pydantic import BaseModel, Field


class HealthFileUploadResponse(BaseModel):
    id: str
    filename: str
    file_url: str
    file_type: str
    parsed_status: str
    records_imported: int
    created_at: datetime


class HealthMetricCreate(BaseModel):
    metric_type: str = Field(..., pattern="^(steps|heart_rate|calories|sleep_hours|weight|blood_pressure|distance_km|active_minutes)$")
    value: float
    unit: str
    recorded_date: date
    source: str = "manual"


class HealthMetricResponse(BaseModel):
    id: str
    metric_type: str
    value: float
    unit: str
    recorded_date: date
    source: str
    created_at: datetime


class HealthMetricsSummary(BaseModel):
    date: date
    steps: float | None = None
    heart_rate: float | None = None
    calories: float | None = None
    sleep_hours: float | None = None
    weight: float | None = None
    active_minutes: float | None = None
    distance_km: float | None = None


class HealthFilesListResponse(BaseModel):
    items: list[HealthFileUploadResponse]


class HealthMetricsListResponse(BaseModel):
    items: list[HealthMetricResponse]
