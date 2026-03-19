from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status

from app.api.deps import DbSession, require_roles
from app.core.storage import MEDIA_ROOT
from app.models import MetricSource, User, UserRole
from app.modules.health_data.schemas import (
    ActivityOverviewResponse,
    HealthAppConnectionCreate,
    HealthAppConnectionResponse,
    HealthAppConnectionsListResponse,
    HealthFileUploadResponse,
    HealthFilesListResponse,
    HealthMetricCreate,
    HealthMetricResponse,
    HealthMetricsListResponse,
    HealthMetricsSummary,
)
from app.modules.health_data.service import (
    ActivitySourceConflictError,
    create_health_metric,
    get_activity_overview,
    get_health_metrics,
    get_metrics_summary,
    get_user_health_files,
    list_health_app_connections,
    mark_health_app_connection_synced,
    parse_health_file,
    remove_health_app_connection,
    save_health_file,
    upsert_health_app_connection,
    SUPPORTED_HEALTH_APP_PROVIDERS,
)

router = APIRouter(prefix="/health-data", tags=["health-data"])

ALLOWED_EXTENSIONS = {"csv", "json", "xml"}


@router.post("/upload", response_model=HealthFileUploadResponse)
async def upload_health_file(
    db: DbSession,
    current_user: Annotated[User, Depends(require_roles(UserRole.PATIENT))],
    provider: str = Query(...),
    file: UploadFile = File(...),
) -> HealthFileUploadResponse:
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No file provided")

    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type '{ext}' not supported. Use CSV, JSON, or Apple Health XML.",
        )

    if provider not in SUPPORTED_HEALTH_APP_PROVIDERS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Provider '{provider}' is not supported.",
        )
    if ext == "xml" and provider != "apple_health":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="XML uploads are only supported for Apple Health exports.",
        )
    if provider == "google_fit" and ext == "xml":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google Fitness uploads must be CSV or JSON exports.",
        )

    content = await file.read()
    file_dir = MEDIA_ROOT / "health_data" / current_user.id
    file_dir.mkdir(parents=True, exist_ok=True)
    file_path = file_dir / file.filename
    file_path.write_bytes(content)
    file_url = f"/media/health_data/{current_user.id}/{file.filename}"

    health_file = await save_health_file(
        db, current_user.id, file.filename, file_url, ext, provider=provider
    )
    try:
        await parse_health_file(
            db,
            health_file,
            content,
            metric_source=MetricSource.APP,
            provider=provider,
        )
    except ActivitySourceConflictError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"{exc.attempted_source_label} upload conflicts with existing activity on "
                f"{', '.join(f'{conflict_date.isoformat()} ({label})' for conflict_date, label in exc.conflicts)}."
            ),
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    if provider:
        await mark_health_app_connection_synced(db, user_id=current_user.id, provider=provider)

    return HealthFileUploadResponse(
        id=health_file.id,
        filename=health_file.filename,
        file_url=health_file.file_url,
        file_type=health_file.file_type,
        provider=health_file.provider,
        parsed_status=health_file.parsed_status,
        records_imported=health_file.records_imported,
        created_at=health_file.created_at,
    )


@router.get("/files", response_model=HealthFilesListResponse)
async def list_health_files(
    db: DbSession,
    current_user: Annotated[User, Depends(require_roles(UserRole.PATIENT))],
) -> HealthFilesListResponse:
    files = await get_user_health_files(db, current_user.id)
    return HealthFilesListResponse(
        items=[
            HealthFileUploadResponse(
                id=f.id,
                filename=f.filename,
                file_url=f.file_url,
                file_type=f.file_type,
                provider=f.provider,
                parsed_status=f.parsed_status,
                records_imported=f.records_imported,
                created_at=f.created_at,
            )
            for f in files
        ]
    )


@router.post("/metrics", response_model=HealthMetricResponse)
async def log_health_metric(
    payload: HealthMetricCreate,
    db: DbSession,
    current_user: Annotated[User, Depends(require_roles(UserRole.PATIENT))],
) -> HealthMetricResponse:
    try:
        metric = await create_health_metric(
            db,
            current_user.id,
            payload.metric_type,
            payload.value,
            payload.unit,
            payload.recorded_date,
            payload.source,
        )
    except ActivitySourceConflictError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Manual activity for {payload.recorded_date.isoformat()} conflicts with "
                f"{', '.join(label for _, label in exc.conflicts)}. Use one source per date."
            ),
        ) from exc
    return HealthMetricResponse(
        id=metric.id,
        metric_type=metric.metric_type.value,
        value=metric.value,
        unit=metric.unit,
        recorded_date=metric.recorded_date,
        source=metric.source.value,
        source_label="Manual entry",
        provider=metric.provider,
        health_data_file_id=metric.health_data_file_id,
        external_type=metric.external_type,
        source_name=metric.source_name,
        source_version=metric.source_version,
        device_name=metric.device_name,
        created_at=metric.created_at,
    )


@router.get("/metrics", response_model=HealthMetricsListResponse)
async def list_health_metrics(
    db: DbSession,
    current_user: Annotated[User, Depends(require_roles(UserRole.PATIENT))],
    metric_type: str | None = Query(None),
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
) -> HealthMetricsListResponse:
    metrics = await get_health_metrics(db, current_user.id, metric_type, start_date, end_date)
    return HealthMetricsListResponse(
        items=[
            HealthMetricResponse(
                id=str(m["id"]),
                metric_type=str(m["metric_type"]),
                value=float(m["value"]),
                unit=str(m["unit"]),
                recorded_date=m["recorded_date"],
                source=str(m["source"]),
                source_label=str(m["source_label"]),
                provider=m.get("provider"),
                health_data_file_id=m.get("health_data_file_id"),
                external_type=m.get("external_type"),
                source_name=m.get("source_name"),
                source_version=m.get("source_version"),
                device_name=m.get("device_name"),
                created_at=m["created_at"],
            )
            for m in metrics
        ]
    )


@router.get("/metrics/summary", response_model=HealthMetricsSummary)
async def health_metrics_summary(
    db: DbSession,
    current_user: Annotated[User, Depends(require_roles(UserRole.PATIENT))],
    target_date: date = Query(default_factory=date.today),
) -> HealthMetricsSummary:
    summary = await get_metrics_summary(db, current_user.id, target_date)
    return HealthMetricsSummary(**summary)


@router.get("/integrations", response_model=HealthAppConnectionsListResponse)
async def list_integrations(
    db: DbSession,
    current_user: Annotated[User, Depends(require_roles(UserRole.PATIENT))],
) -> HealthAppConnectionsListResponse:
    items = await list_health_app_connections(db, current_user.id)
    return HealthAppConnectionsListResponse(
        items=[
            HealthAppConnectionResponse(
                id=item.id,
                provider=item.provider,
                is_connected=item.is_connected,
                sync_method=item.sync_method,
                connected_at=item.connected_at,
                last_synced_at=item.last_synced_at,
                updated_at=item.updated_at,
            )
            for item in items
        ]
    )


@router.put("/integrations/{provider}", response_model=HealthAppConnectionResponse)
async def upsert_integration(
    provider: str,
    payload: HealthAppConnectionCreate,
    db: DbSession,
    current_user: Annotated[User, Depends(require_roles(UserRole.PATIENT))],
) -> HealthAppConnectionResponse:
    if provider not in SUPPORTED_HEALTH_APP_PROVIDERS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Provider '{provider}' is not supported.",
        )
    if payload.is_connected:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Direct source connection is not supported. Upload a real Apple Health or Google Fitness export file to verify a source.",
        )
    item = await upsert_health_app_connection(
        db,
        user_id=current_user.id,
        provider=provider,
        is_connected=payload.is_connected,
        sync_method=payload.sync_method,
    )
    return HealthAppConnectionResponse(
        id=item.id,
        provider=item.provider,
        is_connected=item.is_connected,
        sync_method=item.sync_method,
        connected_at=item.connected_at,
        last_synced_at=item.last_synced_at,
        updated_at=item.updated_at,
    )


@router.delete("/integrations/{provider}", status_code=status.HTTP_204_NO_CONTENT)
async def disconnect_integration(
    provider: str,
    db: DbSession,
    current_user: Annotated[User, Depends(require_roles(UserRole.PATIENT))],
) -> None:
    if provider not in SUPPORTED_HEALTH_APP_PROVIDERS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Provider '{provider}' is not supported.",
        )
    await remove_health_app_connection(db, user_id=current_user.id, provider=provider)


@router.get("/activity-overview", response_model=ActivityOverviewResponse)
async def activity_overview(
    db: DbSession,
    current_user: Annotated[User, Depends(require_roles(UserRole.PATIENT))],
    days: int = Query(default=30, ge=7, le=90),
) -> ActivityOverviewResponse:
    overview = await get_activity_overview(db, user_id=current_user.id, days=days)
    return ActivityOverviewResponse(**overview)
