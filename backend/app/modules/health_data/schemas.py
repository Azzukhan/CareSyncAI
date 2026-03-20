from datetime import date, datetime

from pydantic import BaseModel, Field

PROVIDER_PATTERN = "^(apple_health|google_fit)$"
SYNC_METHOD_PATTERN = "^(export_file|manual_entry|mobile_app)$"


class HealthFileUploadResponse(BaseModel):
    id: str
    filename: str
    file_url: str
    file_type: str
    provider: str | None = None
    export_date: datetime | None = None
    export_locale: str | None = None
    source_date_start: date | None = None
    source_date_end: date | None = None
    source_tag_counts: dict[str, int] | None = None
    parsed_status: str
    records_imported: int
    created_at: datetime


class HealthMetricCreate(BaseModel):
    metric_type: str = Field(..., pattern="^(steps|heart_rate|calories|sleep_hours|weight|blood_pressure|distance_km|active_minutes)$")
    value: float
    unit: str
    recorded_date: date
    source: str = Field(default="manual", pattern="^manual$")


class HealthMetricResponse(BaseModel):
    id: str
    metric_type: str
    value: float
    unit: str
    recorded_date: date
    recorded_at: datetime | None = None
    source: str
    source_label: str
    provider: str | None = None
    health_data_file_id: str | None = None
    external_type: str | None = None
    source_name: str | None = None
    source_version: str | None = None
    source_unit: str | None = None
    source_created_at: datetime | None = None
    source_start_at: datetime | None = None
    source_end_at: datetime | None = None
    source_record_count: int = 1
    device_name: str | None = None
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


class HealthAppConnectionCreate(BaseModel):
    is_connected: bool = True
    sync_method: str = Field(default="export_file", pattern=SYNC_METHOD_PATTERN)


class HealthAppConnectionResponse(BaseModel):
    id: str
    provider: str = Field(..., pattern=PROVIDER_PATTERN)
    is_connected: bool
    sync_method: str
    connected_at: datetime
    last_synced_at: datetime | None = None
    updated_at: datetime


class HealthAppConnectionsListResponse(BaseModel):
    items: list[HealthAppConnectionResponse]


class ActivityOverviewMetric(BaseModel):
    metric_type: str
    unit: str
    latest_value: float | None = None
    latest_recorded_date: date | None = None
    last_7_day_average: float | None = None
    previous_7_day_average: float | None = None
    last_7_day_total: float | None = None
    trend: str


class ActivityMetricSnapshot(BaseModel):
    value: float
    unit: str
    recorded_date: str
    source: str
    source_label: str
    provider: str | None = None


class ActivityRecentDayMetric(BaseModel):
    value: float
    unit: str


class ActivityRecentDay(BaseModel):
    date: str
    source: str
    source_label: str
    provider: str | None = None
    metrics: dict[str, ActivityRecentDayMetric]


class ActivityAuthoritativeSource(BaseModel):
    source: str
    source_label: str
    provider: str | None = None
    is_connected: bool
    last_synced_at: datetime | None = None
    days_count: int
    range_start: date
    range_end: date


class ActivityVerifiedProvider(BaseModel):
    provider: str = Field(..., pattern=PROVIDER_PATTERN)
    provider_label: str
    last_synced_at: datetime | None = None


class ActivityLatestImportedFile(BaseModel):
    filename: str
    provider: str | None = None
    export_date: datetime | None = None
    export_locale: str | None = None
    source_date_start: date | None = None
    source_date_end: date | None = None
    source_tag_counts: dict[str, int] | None = None
    parsed_status: str
    records_imported: int
    created_at: datetime


class ActivityOverviewResponse(BaseModel):
    range_start: date
    range_end: date
    connected_apps: int
    imported_files: int
    metrics: list[ActivityOverviewMetric]
    hydration_tracking_available: bool = False
    authoritative_sources: list[ActivityAuthoritativeSource] = Field(default_factory=list)
    verified_providers: list[ActivityVerifiedProvider] = Field(default_factory=list)
    latest_activity_metrics: dict[str, ActivityMetricSnapshot] = Field(default_factory=dict)
    today_activity_metrics: dict[str, ActivityMetricSnapshot] = Field(default_factory=dict)
    recent_activity_days: list[ActivityRecentDay] = Field(default_factory=list)
    latest_imported_file: ActivityLatestImportedFile | None = None
