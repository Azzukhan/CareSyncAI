import csv
import io
import json
from datetime import date, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import HealthDataFile, HealthMetric, MetricSource, MetricType

METRIC_UNITS: dict[str, str] = {
    "steps": "steps",
    "heart_rate": "bpm",
    "calories": "kcal",
    "sleep_hours": "hours",
    "weight": "kg",
    "blood_pressure": "mmHg",
    "distance_km": "km",
    "active_minutes": "minutes",
}


async def save_health_file(
    db: AsyncSession,
    user_id: str,
    filename: str,
    file_url: str,
    file_type: str,
) -> HealthDataFile:
    health_file = HealthDataFile(
        user_id=user_id,
        filename=filename,
        file_url=file_url,
        file_type=file_type,
        parsed_status="pending",
    )
    db.add(health_file)
    await db.commit()
    await db.refresh(health_file)
    return health_file


async def parse_health_file(
    db: AsyncSession,
    health_file: HealthDataFile,
    file_content: bytes,
) -> int:
    """Parse uploaded CSV/JSON health data and create HealthMetric records."""
    records_count = 0
    try:
        if health_file.file_type == "csv":
            records_count = await _parse_csv(db, health_file.user_id, file_content)
        elif health_file.file_type == "json":
            records_count = await _parse_json(db, health_file.user_id, file_content)

        health_file.parsed_status = "parsed"
        health_file.records_imported = records_count
    except Exception:
        health_file.parsed_status = "failed"

    await db.commit()
    await db.refresh(health_file)
    return records_count


async def _parse_csv(db: AsyncSession, user_id: str, content: bytes) -> int:
    """Expected CSV columns: date, metric_type, value, unit (optional)."""
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
    count = 0
    for row in reader:
        metric_type_str = row.get("metric_type", row.get("type", "")).strip().lower()
        if metric_type_str not in [m.value for m in MetricType]:
            continue
        try:
            value = float(row.get("value", 0))
            recorded_date = _parse_date(row.get("date", row.get("recorded_date", "")))
            if not recorded_date:
                continue
            unit = row.get("unit", METRIC_UNITS.get(metric_type_str, ""))
            metric = HealthMetric(
                user_id=user_id,
                metric_type=MetricType(metric_type_str),
                value=value,
                unit=unit,
                recorded_date=recorded_date,
                source=MetricSource.FILE,
            )
            db.add(metric)
            count += 1
        except (ValueError, KeyError):
            continue
    if count > 0:
        await db.flush()
    return count


async def _parse_json(db: AsyncSession, user_id: str, content: bytes) -> int:
    """Expected JSON: list of objects with date, metric_type, value, unit."""
    data = json.loads(content.decode("utf-8-sig"))
    if isinstance(data, dict):
        data = data.get("metrics", data.get("data", []))
    if not isinstance(data, list):
        return 0

    count = 0
    for entry in data:
        metric_type_str = str(entry.get("metric_type", entry.get("type", ""))).strip().lower()
        if metric_type_str not in [m.value for m in MetricType]:
            continue
        try:
            value = float(entry.get("value", 0))
            recorded_date = _parse_date(str(entry.get("date", entry.get("recorded_date", ""))))
            if not recorded_date:
                continue
            unit = entry.get("unit", METRIC_UNITS.get(metric_type_str, ""))
            metric = HealthMetric(
                user_id=user_id,
                metric_type=MetricType(metric_type_str),
                value=value,
                unit=unit,
                recorded_date=recorded_date,
                source=MetricSource.FILE,
            )
            db.add(metric)
            count += 1
        except (ValueError, KeyError):
            continue
    if count > 0:
        await db.flush()
    return count


def _parse_date(date_str: str) -> date | None:
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(date_str.strip(), fmt).date()
        except ValueError:
            continue
    return None


async def get_user_health_files(db: AsyncSession, user_id: str) -> list[HealthDataFile]:
    result = await db.execute(
        select(HealthDataFile)
        .where(HealthDataFile.user_id == user_id)
        .order_by(HealthDataFile.created_at.desc())
    )
    return list(result.scalars().all())


async def create_health_metric(
    db: AsyncSession,
    user_id: str,
    metric_type: str,
    value: float,
    unit: str,
    recorded_date: date,
    source: str = "manual",
) -> HealthMetric:
    metric = HealthMetric(
        user_id=user_id,
        metric_type=MetricType(metric_type),
        value=value,
        unit=unit,
        recorded_date=recorded_date,
        source=MetricSource(source),
    )
    db.add(metric)
    await db.commit()
    await db.refresh(metric)
    return metric


async def get_health_metrics(
    db: AsyncSession,
    user_id: str,
    metric_type: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
) -> list[HealthMetric]:
    query = select(HealthMetric).where(HealthMetric.user_id == user_id)
    if metric_type:
        query = query.where(HealthMetric.metric_type == MetricType(metric_type))
    if start_date:
        query = query.where(HealthMetric.recorded_date >= start_date)
    if end_date:
        query = query.where(HealthMetric.recorded_date <= end_date)
    query = query.order_by(HealthMetric.recorded_date.desc())
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_metrics_summary(
    db: AsyncSession,
    user_id: str,
    target_date: date,
) -> dict:
    """Get aggregated metrics for a single day."""
    metrics = await get_health_metrics(db, user_id, start_date=target_date, end_date=target_date)
    summary: dict = {"date": target_date}
    for metric in metrics:
        summary[metric.metric_type.value] = metric.value
    return summary
