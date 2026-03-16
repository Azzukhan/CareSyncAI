from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status

from app.api.deps import DbSession, require_roles
from app.core.storage import MEDIA_ROOT
from app.models import User, UserRole
from app.modules.health_data.schemas import (
    HealthFileUploadResponse,
    HealthFilesListResponse,
    HealthMetricCreate,
    HealthMetricResponse,
    HealthMetricsListResponse,
    HealthMetricsSummary,
)
from app.modules.health_data.service import (
    create_health_metric,
    get_health_metrics,
    get_metrics_summary,
    get_user_health_files,
    parse_health_file,
    save_health_file,
)

router = APIRouter(prefix="/health-data", tags=["health-data"])

ALLOWED_EXTENSIONS = {"csv", "json"}


@router.post("/upload", response_model=HealthFileUploadResponse)
async def upload_health_file(
    db: DbSession,
    current_user: Annotated[User, Depends(require_roles(UserRole.PATIENT))],
    file: UploadFile = File(...),
) -> HealthFileUploadResponse:
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No file provided")

    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type '{ext}' not supported. Use CSV or JSON.",
        )

    content = await file.read()
    file_dir = MEDIA_ROOT / "health_data" / current_user.id
    file_dir.mkdir(parents=True, exist_ok=True)
    file_path = file_dir / file.filename
    file_path.write_bytes(content)
    file_url = f"/media/health_data/{current_user.id}/{file.filename}"

    health_file = await save_health_file(db, current_user.id, file.filename, file_url, ext)
    await parse_health_file(db, health_file, content)

    return HealthFileUploadResponse(
        id=health_file.id,
        filename=health_file.filename,
        file_url=health_file.file_url,
        file_type=health_file.file_type,
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
    metric = await create_health_metric(
        db,
        current_user.id,
        payload.metric_type,
        payload.value,
        payload.unit,
        payload.recorded_date,
        payload.source,
    )
    return HealthMetricResponse(
        id=metric.id,
        metric_type=metric.metric_type.value,
        value=metric.value,
        unit=metric.unit,
        recorded_date=metric.recorded_date,
        source=metric.source.value,
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
                id=m.id,
                metric_type=m.metric_type.value,
                value=m.value,
                unit=m.unit,
                recorded_date=m.recorded_date,
                source=m.source.value,
                created_at=m.created_at,
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
