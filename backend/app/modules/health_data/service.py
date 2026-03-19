import csv
import io
import json
import re
import xml.etree.ElementTree as ET
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from html import unescape

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import HealthAppConnection, HealthDataFile, HealthMetric, MetricSource, MetricType

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

SUPPORTED_HEALTH_APP_PROVIDERS = {
    "apple_health": "Apple Health",
    "google_fit": "Google Fitness",
}

SUPPORTED_METRIC_TYPE_VALUES = {metric_type.value for metric_type in MetricType}
APPLE_HEALTH_NAMESPACE = {"hl7": "urn:hl7-org:v3"}
APPLE_HEALTH_TYPE_MAP: dict[str, tuple[MetricType, str]] = {
    "HKQuantityTypeIdentifierStepCount": (MetricType.STEPS, "steps"),
    "HKQuantityTypeIdentifierWalkingStepLength": (MetricType.DISTANCE_KM, "km"),
    "HKQuantityTypeIdentifierDistanceWalkingRunning": (MetricType.DISTANCE_KM, "km"),
    "HKQuantityTypeIdentifierWalkingRunningDistance": (MetricType.DISTANCE_KM, "km"),
    "HKQuantityTypeIdentifierAppleExerciseTime": (MetricType.ACTIVE_MINUTES, "minutes"),
    "HKQuantityTypeIdentifierActiveEnergyBurned": (MetricType.CALORIES, "kcal"),
    "HKQuantityTypeIdentifierHeartRate": (MetricType.HEART_RATE, "bpm"),
    "HKQuantityTypeIdentifierBodyMass": (MetricType.WEIGHT, "kg"),
}

ACTIVITY_METRIC_TYPES = [
    MetricType.STEPS,
    MetricType.ACTIVE_MINUTES,
    MetricType.DISTANCE_KM,
    MetricType.CALORIES,
    MetricType.SLEEP_HOURS,
]
ADDITIVE_METRIC_TYPES = {
    MetricType.STEPS,
    MetricType.ACTIVE_MINUTES,
    MetricType.DISTANCE_KM,
    MetricType.CALORIES,
    MetricType.SLEEP_HOURS,
}
SOURCE_PRIORITY = {
    "verified_app": 3,
    "app": 2,
    "manual": 1,
}


class ActivitySourceConflictError(Exception):
    def __init__(self, *, attempted_source_label: str, conflicts: list[tuple[date, str]]) -> None:
        self.attempted_source_label = attempted_source_label
        self.conflicts = conflicts
        conflict_text = ", ".join(
            f"{conflict_date.isoformat()} ({label})" for conflict_date, label in conflicts
        )
        super().__init__(
            f"{attempted_source_label} data conflicts with existing activity on: {conflict_text}."
        )


async def save_health_file(
    db: AsyncSession,
    user_id: str,
    filename: str,
    file_url: str,
    file_type: str,
    provider: str | None = None,
) -> HealthDataFile:
    health_file = HealthDataFile(
        user_id=user_id,
        filename=filename,
        file_url=file_url,
        file_type=file_type,
        provider=provider,
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
    *,
    metric_source: MetricSource = MetricSource.FILE,
    provider: str | None = None,
) -> int:
    """Parse uploaded health data and create normalized HealthMetric records."""
    records_count = 0
    health_file_id = health_file.id
    try:
        if health_file.file_type == "csv":
            metric_payloads = _parse_csv(file_content, provider=provider)
        elif health_file.file_type == "json":
            metric_payloads = _parse_json(file_content, provider=provider)
        elif health_file.file_type == "xml":
            metric_payloads = _parse_apple_health_xml(file_content, provider=provider or "apple_health")
        else:
            metric_payloads = []

        normalized_payloads = _normalize_import_payloads(metric_payloads)
        if not normalized_payloads:
            raise ValueError("No supported activity metrics were found in this file.")

        import_dates = sorted(
            {
                payload["recorded_date"]
                for payload in normalized_payloads
                if isinstance(payload.get("recorded_date"), date)
            }
        )
        if import_dates:
            conflicts = await _find_activity_date_conflicts(
                db,
                user_id=health_file.user_id,
                dates=import_dates,
                source=metric_source,
                provider=provider,
            )
            if conflicts:
                attempted_label = _source_label(metric_source, provider)
                raise ActivitySourceConflictError(
                    attempted_source_label=attempted_label,
                    conflicts=conflicts,
                )

            if metric_source == MetricSource.APP and provider:
                await _delete_provider_metrics_for_dates(
                    db,
                    user_id=health_file.user_id,
                    provider=provider,
                    dates=import_dates,
                )

        for payload in normalized_payloads:
            metric = _build_health_metric(
                user_id=health_file.user_id,
                metric_type=payload["metric_type"],
                value=payload["value"],
                unit=payload["unit"],
                recorded_date=payload["recorded_date"],
                source=metric_source,
                provider=provider if metric_source == MetricSource.APP else None,
                health_data_file_id=health_file.id,
                external_type=payload.get("external_type"),
                source_name=payload.get("source_name"),
                source_version=payload.get("source_version"),
                device_name=payload.get("device_name"),
            )
            db.add(metric)

        records_count = len(normalized_payloads)
        health_file.parsed_status = "parsed"
        health_file.records_imported = records_count
        await db.commit()
    except Exception:
        await db.rollback()
        failed_file = await db.get(HealthDataFile, health_file_id)
        if failed_file is not None:
            failed_file.parsed_status = "failed"
            failed_file.records_imported = 0
            await db.commit()
            await db.refresh(failed_file)
            health_file.parsed_status = failed_file.parsed_status
            health_file.records_imported = failed_file.records_imported
            health_file.created_at = failed_file.created_at
            health_file.provider = failed_file.provider
        raise
    await db.refresh(health_file)
    return records_count


def _parse_csv(
    content: bytes,
    *,
    provider: str | None,
) -> list[dict[str, object]]:
    """Expected CSV columns: date, metric_type, value, unit (optional)."""
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
    payloads: list[dict[str, object]] = []
    for row in reader:
        metric_type_str = row.get("metric_type", row.get("type", "")).strip().lower()
        if metric_type_str not in SUPPORTED_METRIC_TYPE_VALUES:
            continue
        try:
            value = float(row.get("value", 0))
            recorded_date = _parse_date(row.get("date", row.get("recorded_date", "")))
            if not recorded_date:
                continue
            unit = row.get("unit", METRIC_UNITS.get(metric_type_str, ""))
            payloads.append(
                {
                    "metric_type": MetricType(metric_type_str),
                    "value": value,
                    "unit": unit,
                    "recorded_date": recorded_date,
                    "recorded_at": None,
                    "provider": provider,
                }
            )
        except (ValueError, KeyError):
            continue
    return payloads


def _parse_json(
    content: bytes,
    *,
    provider: str | None,
) -> list[dict[str, object]]:
    """Expected JSON: list of objects with date, metric_type, value, unit."""
    data = json.loads(content.decode("utf-8-sig"))
    if isinstance(data, dict):
        data = data.get("metrics", data.get("data", []))
    if not isinstance(data, list):
        return []

    payloads: list[dict[str, object]] = []
    for entry in data:
        metric_type_str = str(entry.get("metric_type", entry.get("type", ""))).strip().lower()
        if metric_type_str not in SUPPORTED_METRIC_TYPE_VALUES:
            continue
        try:
            value = float(entry.get("value", 0))
            recorded_date = _parse_date(str(entry.get("date", entry.get("recorded_date", ""))))
            if not recorded_date:
                continue
            unit = entry.get("unit", METRIC_UNITS.get(metric_type_str, ""))
            payloads.append(
                {
                    "metric_type": MetricType(metric_type_str),
                    "value": value,
                    "unit": unit,
                    "recorded_date": recorded_date,
                    "recorded_at": None,
                    "provider": provider,
                }
            )
        except (ValueError, KeyError):
            continue
    return payloads


def _parse_apple_health_xml(
    content: bytes,
    *,
    provider: str,
) -> list[dict[str, object]]:
    root = ET.fromstring(content.decode("utf-8-sig"))
    observations = root.findall(".//hl7:observation", APPLE_HEALTH_NAMESPACE)
    payloads: list[dict[str, object]] = []

    for observation in observations:
        payload = _extract_apple_health_observation(observation)
        if payload is None:
            continue
        payload["provider"] = provider
        payloads.append(payload)

    return payloads


def _normalize_import_payloads(
    payloads: list[dict[str, object]],
) -> list[dict[str, object]]:
    grouped_payloads: dict[tuple[date, MetricType], list[dict[str, object]]] = defaultdict(list)
    for payload in payloads:
        metric_type = payload.get("metric_type")
        recorded_date = payload.get("recorded_date")
        if not isinstance(metric_type, MetricType) or not isinstance(recorded_date, date):
            continue
        grouped_payloads[(recorded_date, metric_type)].append(payload)

    normalized_payloads: list[dict[str, object]] = []
    for (_, metric_type), group in grouped_payloads.items():
        representative = max(
            group,
            key=lambda item: (
                item.get("recorded_at") or datetime.min.replace(tzinfo=timezone.utc),
                item.get("value", 0),
            ),
        )
        total_value = sum(float(item["value"]) for item in group)
        normalized_value = (
            _round_metric_value(metric_type, total_value)
            if metric_type in ADDITIVE_METRIC_TYPES
            else _round_metric_value(metric_type, float(representative["value"]))
        )
        normalized_payloads.append(
            {
                "metric_type": metric_type,
                "value": normalized_value,
                "unit": representative["unit"],
                "recorded_date": representative["recorded_date"],
                "recorded_at": representative.get("recorded_at"),
                "provider": representative.get("provider"),
                "external_type": representative.get("external_type"),
                "source_name": representative.get("source_name"),
                "source_version": representative.get("source_version"),
                "device_name": representative.get("device_name"),
            }
        )

    return sorted(
        normalized_payloads,
        key=lambda item: (
            item["recorded_date"],
            item["metric_type"].value if isinstance(item["metric_type"], MetricType) else "",
        ),
    )


def _parse_date(date_str: str) -> date | None:
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(date_str.strip(), fmt).date()
        except ValueError:
            continue
    return None


def _parse_apple_health_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    normalized = value.strip()
    for fmt in ("%Y%m%d%H%M%S%z", "%Y%m%d%H%M%S", "%Y%m%d"):
        try:
            return datetime.strptime(normalized, fmt)
        except ValueError:
            continue
    return None


def _extract_apple_health_observation(
    observation: ET.Element,
) -> dict[str, object] | None:
    text_node = observation.find("hl7:text", APPLE_HEALTH_NAMESPACE)
    value_node = observation.find("hl7:value", APPLE_HEALTH_NAMESPACE)
    effective_time = observation.find("hl7:effectiveTime", APPLE_HEALTH_NAMESPACE)
    code_node = observation.find("hl7:code", APPLE_HEALTH_NAMESPACE)

    external_type = ""
    source_name = ""
    source_version = ""
    device_name = ""
    text_value = ""
    text_unit = ""

    if text_node is not None:
        external_type = (text_node.findtext("hl7:type", default="", namespaces=APPLE_HEALTH_NAMESPACE) or "").strip()
        source_name = (text_node.findtext("hl7:sourceName", default="", namespaces=APPLE_HEALTH_NAMESPACE) or "").strip()
        source_version = (text_node.findtext("hl7:sourceVersion", default="", namespaces=APPLE_HEALTH_NAMESPACE) or "").strip()
        text_value = (text_node.findtext("hl7:value", default="", namespaces=APPLE_HEALTH_NAMESPACE) or "").strip()
        text_unit = (text_node.findtext("hl7:unit", default="", namespaces=APPLE_HEALTH_NAMESPACE) or "").strip()
        device_name = _extract_device_name(
            text_node.findtext("hl7:device", default="", namespaces=APPLE_HEALTH_NAMESPACE)
        )

    if not external_type and code_node is not None:
        code_value = code_node.attrib.get("code")
        external_type = _map_loinc_code_to_external_type(code_value)

    normalized_metric = _normalize_apple_metric(external_type, text_value, text_unit, value_node, effective_time)
    if normalized_metric is None:
        return None

    recorded_at = _apple_effective_time(effective_time)
    if recorded_at is None:
        return None

    return {
        "metric_type": normalized_metric["metric_type"],
        "value": normalized_metric["value"],
        "unit": normalized_metric["unit"],
        "recorded_date": recorded_at.date(),
        "recorded_at": recorded_at,
        "external_type": external_type or None,
        "source_name": source_name or None,
        "source_version": source_version or None,
        "device_name": device_name or None,
    }


def _normalize_apple_metric(
    external_type: str,
    text_value: str,
    text_unit: str,
    value_node: ET.Element | None,
    effective_time: ET.Element | None,
) -> dict[str, object] | None:
    if external_type == "HKCategoryTypeIdentifierSleepAnalysis":
        duration_hours = _sleep_duration_hours(effective_time, text_value)
        if duration_hours is None:
            return None
        return {
            "metric_type": MetricType.SLEEP_HOURS,
            "value": duration_hours,
            "unit": "hours",
        }

    mapping = APPLE_HEALTH_TYPE_MAP.get(external_type)
    if mapping is None:
        return None

    raw_value = text_value or (value_node.attrib.get("value", "") if value_node is not None else "")
    raw_unit = text_unit or (value_node.attrib.get("unit", "") if value_node is not None else "")
    try:
        numeric_value = float(raw_value)
    except (TypeError, ValueError):
        return None

    metric_type, target_unit = mapping
    normalized_value = _convert_metric_value(metric_type, numeric_value, raw_unit, target_unit)
    if normalized_value is None:
        return None
    return {
        "metric_type": metric_type,
        "value": normalized_value,
        "unit": target_unit,
    }


def _convert_metric_value(
    metric_type: MetricType,
    value: float,
    raw_unit: str,
    target_unit: str,
) -> float | None:
    unit = raw_unit.strip().lower()
    if metric_type == MetricType.HEART_RATE:
        return round(value, 2)
    if metric_type == MetricType.STEPS:
        return round(value, 2)
    if metric_type == MetricType.ACTIVE_MINUTES:
        if unit in {"min", "minute", "minutes"}:
            return round(value, 2)
        if unit in {"s", "sec", "second", "seconds"}:
            return round(value / 60, 2)
        return round(value, 2)
    if metric_type == MetricType.CALORIES:
        if unit in {"cal"}:
            return round(value / 1000, 2)
        return round(value, 2)
    if metric_type == MetricType.WEIGHT:
        if unit in {"lb", "lbs", "pound", "pounds"}:
            return round(value * 0.45359237, 2)
        return round(value, 2)
    if metric_type == MetricType.DISTANCE_KM:
        if unit in {"m", "meter", "meters"}:
            return round(value / 1000, 3)
        if unit in {"mi", "mile", "miles"}:
            return round(value * 1.60934, 3)
        return round(value, 3)
    return round(value, 2)


def _sleep_duration_hours(
    effective_time: ET.Element | None, raw_value: str
) -> float | None:
    if raw_value and "awake" in raw_value.lower():
        return None
    start_at = _parse_apple_health_datetime(
        effective_time.find("hl7:low", APPLE_HEALTH_NAMESPACE).attrib.get("value")
        if effective_time is not None and effective_time.find("hl7:low", APPLE_HEALTH_NAMESPACE) is not None
        else None
    )
    end_at = _parse_apple_health_datetime(
        effective_time.find("hl7:high", APPLE_HEALTH_NAMESPACE).attrib.get("value")
        if effective_time is not None and effective_time.find("hl7:high", APPLE_HEALTH_NAMESPACE) is not None
        else None
    )
    if start_at is None or end_at is None or end_at <= start_at:
        return None
    return round((end_at - start_at).total_seconds() / 3600, 2)


def _apple_effective_time(effective_time: ET.Element | None) -> datetime | None:
    if effective_time is None:
        return None
    for tag_name in ("high", "low"):
        node = effective_time.find(f"hl7:{tag_name}", APPLE_HEALTH_NAMESPACE)
        if node is None:
            continue
        parsed = _parse_apple_health_datetime(node.attrib.get("value"))
        if parsed is not None:
            return parsed
    return None


def _extract_device_name(raw_device: str | None) -> str:
    if not raw_device:
        return ""
    decoded = unescape(raw_device).strip()
    match = re.search(r"name:([^,>]+)", decoded)
    if match:
        return match.group(1).strip()
    return decoded[:255]


def _map_loinc_code_to_external_type(code_value: str | None) -> str:
    return {
        "8867-4": "HKQuantityTypeIdentifierHeartRate",
        "3141-9": "HKQuantityTypeIdentifierBodyMass",
    }.get(code_value or "", "")


def _round_metric_value(metric_type: MetricType, value: float) -> float:
    if metric_type == MetricType.DISTANCE_KM:
        return round(value, 3)
    return round(value, 2)


def _source_label(source: MetricSource | str, provider: str | None) -> str:
    if source == MetricSource.MANUAL or source == MetricSource.MANUAL.value:
        return "Manual entry"
    if provider:
        return SUPPORTED_HEALTH_APP_PROVIDERS.get(provider, provider.replace("_", " ").title())
    return "Imported file"


def _source_identity(metric: HealthMetric) -> tuple[str, str | None]:
    if metric.source == MetricSource.MANUAL:
        return ("manual", None)
    if metric.provider:
        return ("app", metric.provider)
    return ("imported_file", None)


def _candidate_rank(
    metrics: list[HealthMetric],
    *,
    verified_providers: set[str],
) -> tuple[int, int, datetime]:
    representative = max(metrics, key=lambda metric: metric.created_at)
    distinct_metric_types = len({metric.metric_type for metric in metrics})
    if representative.source == MetricSource.MANUAL:
        priority = SOURCE_PRIORITY["manual"]
    elif representative.provider and representative.provider in verified_providers:
        priority = SOURCE_PRIORITY["verified_app"]
    else:
        priority = SOURCE_PRIORITY["app"]
    return (priority, distinct_metric_types, representative.created_at)


def _collapse_candidate_metric_rows(metrics: list[HealthMetric]) -> list[dict[str, object]]:
    grouped_rows: dict[MetricType, list[HealthMetric]] = defaultdict(list)
    for metric in metrics:
        grouped_rows[metric.metric_type].append(metric)

    collapsed: list[dict[str, object]] = []
    for metric_type, rows in grouped_rows.items():
        representative = max(rows, key=lambda metric: metric.created_at)
        if metric_type in ADDITIVE_METRIC_TYPES:
            value = _round_metric_value(metric_type, sum(metric.value for metric in rows))
        else:
            value = representative.value
        collapsed.append(
            {
                "id": representative.id,
                "metric_type": metric_type.value,
                "value": value,
                "unit": representative.unit,
                "recorded_date": representative.recorded_date,
                "source": representative.source.value,
                "source_label": _source_label(representative.source, representative.provider),
                "provider": representative.provider,
                "health_data_file_id": representative.health_data_file_id,
                "external_type": representative.external_type,
                "source_name": representative.source_name,
                "source_version": representative.source_version,
                "device_name": representative.device_name,
                "created_at": representative.created_at,
            }
        )

    metric_order = {metric_type.value: index for index, metric_type in enumerate(ACTIVITY_METRIC_TYPES)}
    return sorted(
        collapsed,
        key=lambda item: metric_order.get(str(item["metric_type"]), 999),
    )


def _canonicalize_activity_days(
    metrics: list[HealthMetric],
    *,
    verified_providers: set[str],
) -> list[dict[str, object]]:
    metrics_by_date: dict[date, dict[tuple[str, str | None], list[HealthMetric]]] = defaultdict(
        lambda: defaultdict(list)
    )
    for metric in metrics:
        if metric.metric_type not in ACTIVITY_METRIC_TYPES:
            continue
        metrics_by_date[metric.recorded_date][_source_identity(metric)].append(metric)

    canonical_days: list[dict[str, object]] = []
    for recorded_date, candidates in metrics_by_date.items():
        chosen_identity, chosen_rows = max(
            candidates.items(),
            key=lambda item: _candidate_rank(item[1], verified_providers=verified_providers),
        )
        source_kind, provider = chosen_identity
        representative = max(chosen_rows, key=lambda metric: metric.created_at)
        canonical_days.append(
            {
                "date": recorded_date,
                "source": representative.source.value if source_kind != "manual" else MetricSource.MANUAL.value,
                "source_label": _source_label(representative.source, provider),
                "provider": provider,
                "created_at": representative.created_at,
                "metrics": _collapse_candidate_metric_rows(chosen_rows),
            }
        )

    return sorted(canonical_days, key=lambda item: item["date"], reverse=True)


def _flatten_canonical_activity_metrics(canonical_days: list[dict[str, object]]) -> list[dict[str, object]]:
    flattened: list[dict[str, object]] = []
    for day in canonical_days:
        for metric in day["metrics"]:
            flattened.append(metric)
    return flattened


def _latest_metrics_by_type(
    canonical_metrics: list[dict[str, object]],
    *,
    target_date: date | None = None,
) -> dict[str, dict[str, object]]:
    latest_by_type: dict[str, dict[str, object]] = {}
    for metric in canonical_metrics:
        metric_date = metric.get("recorded_date")
        if target_date is not None and metric_date != target_date:
            continue
        metric_type = metric.get("metric_type")
        if not isinstance(metric_type, str):
            continue
        if metric_type not in latest_by_type:
            latest_by_type[metric_type] = {
                "value": metric["value"],
                "unit": metric["unit"],
                "recorded_date": metric["recorded_date"].isoformat(),
                "source": metric["source"],
                "source_label": metric["source_label"],
                "provider": metric.get("provider"),
            }
    return latest_by_type


def _build_recent_activity_days(canonical_days: list[dict[str, object]], *, limit: int = 14) -> list[dict[str, object]]:
    items: list[dict[str, object]] = []
    for day in canonical_days[:limit]:
        items.append(
            {
                "date": day["date"].isoformat(),
                "source": day["source"],
                "source_label": day["source_label"],
                "provider": day["provider"],
                "metrics": {
                    metric["metric_type"]: {
                        "value": metric["value"],
                        "unit": metric["unit"],
                    }
                    for metric in day["metrics"]
                },
            }
        )
    return items


def _build_authoritative_sources(
    canonical_days: list[dict[str, object]],
    *,
    connections: list[HealthAppConnection],
) -> list[dict[str, object]]:
    connection_map = {connection.provider: connection for connection in connections}
    grouped_dates: dict[tuple[str, str | None], list[date]] = defaultdict(list)
    for day in canonical_days:
        grouped_dates[(str(day["source"]), day.get("provider"))].append(day["date"])

    summaries: list[dict[str, object]] = []
    for (source, provider), dates in grouped_dates.items():
        connection = connection_map.get(provider) if provider else None
        summaries.append(
            {
                "source": source,
                "source_label": _source_label(source, provider),
                "provider": provider,
                "is_connected": connection.is_connected if connection is not None else False,
                "last_synced_at": connection.last_synced_at if connection is not None else None,
                "days_count": len(dates),
                "range_start": min(dates),
                "range_end": max(dates),
            }
        )

    return sorted(
        summaries,
        key=lambda item: (
            0 if item["provider"] else 1,
            -(item["days_count"]),
            str(item["source_label"]),
        ),
    )


async def _query_raw_health_metrics(
    db: AsyncSession,
    user_id: str,
    metric_type: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    *,
    activity_only: bool = False,
) -> list[HealthMetric]:
    query = select(HealthMetric).where(HealthMetric.user_id == user_id)
    if metric_type:
        query = query.where(HealthMetric.metric_type == MetricType(metric_type))
    if start_date:
        query = query.where(HealthMetric.recorded_date >= start_date)
    if end_date:
        query = query.where(HealthMetric.recorded_date <= end_date)
    if activity_only:
        query = query.where(HealthMetric.metric_type.in_(ACTIVITY_METRIC_TYPES))
    query = query.order_by(HealthMetric.recorded_date.desc(), HealthMetric.created_at.desc())
    result = await db.execute(query)
    return list(result.scalars().all())


async def _find_activity_date_conflicts(
    db: AsyncSession,
    *,
    user_id: str,
    dates: list[date],
    source: MetricSource,
    provider: str | None,
) -> list[tuple[date, str]]:
    if not dates:
        return []

    existing_metrics = await _query_raw_health_metrics(
        db,
        user_id=user_id,
        start_date=min(dates),
        end_date=max(dates),
        activity_only=True,
    )
    existing_by_date: dict[date, list[HealthMetric]] = defaultdict(list)
    tracked_dates = set(dates)
    for metric in existing_metrics:
        if metric.recorded_date in tracked_dates:
            existing_by_date[metric.recorded_date].append(metric)

    conflicts: list[tuple[date, str]] = []
    for conflict_date in sorted(tracked_dates):
        date_metrics = existing_by_date.get(conflict_date, [])
        if not date_metrics:
            continue

        labels: list[str] = []
        has_manual = any(metric.source == MetricSource.MANUAL for metric in date_metrics)
        existing_providers = {
            metric.provider
            for metric in date_metrics
            if metric.source != MetricSource.MANUAL and metric.provider
        }
        has_legacy_import = any(
            metric.source != MetricSource.MANUAL and metric.provider is None
            for metric in date_metrics
        )

        if source == MetricSource.MANUAL:
            if has_manual and not existing_providers and not has_legacy_import:
                continue
            if existing_providers:
                labels.extend(
                    sorted(_source_label(MetricSource.APP, existing_provider) for existing_provider in existing_providers)
                )
            if has_legacy_import:
                labels.append("Imported file")
        else:
            if has_manual:
                labels.append("Manual entry")
            other_providers = {existing_provider for existing_provider in existing_providers if existing_provider != provider}
            if other_providers:
                labels.extend(
                    sorted(_source_label(MetricSource.APP, existing_provider) for existing_provider in other_providers)
                )
            if has_legacy_import:
                labels.append("Imported file")

        deduped_labels = sorted({label for label in labels if label})
        if deduped_labels:
            conflicts.append((conflict_date, " and ".join(deduped_labels)))

    return conflicts


async def _delete_provider_metrics_for_dates(
    db: AsyncSession,
    *,
    user_id: str,
    provider: str,
    dates: list[date],
) -> None:
    if not dates:
        return
    await db.execute(
        delete(HealthMetric).where(
            HealthMetric.user_id == user_id,
            HealthMetric.source == MetricSource.APP,
            HealthMetric.provider == provider,
            HealthMetric.recorded_date.in_(dates),
        )
    )


def _build_health_metric(
    *,
    user_id: str,
    metric_type: MetricType,
    value: float,
    unit: str,
    recorded_date: date,
    source: MetricSource,
    provider: str | None,
    health_data_file_id: str | None = None,
    external_type: str | None = None,
    source_name: str | None = None,
    source_version: str | None = None,
    device_name: str | None = None,
) -> HealthMetric:
    return HealthMetric(
        user_id=user_id,
        metric_type=metric_type,
        value=value,
        unit=unit,
        recorded_date=recorded_date,
        source=source,
        provider=provider,
        health_data_file_id=health_data_file_id,
        external_type=external_type,
        source_name=source_name,
        source_version=source_version,
        device_name=device_name,
    )


def _serialize_metric(metric: HealthMetric) -> dict[str, object]:
    return {
        "id": metric.id,
        "metric_type": metric.metric_type.value,
        "value": metric.value,
        "unit": metric.unit,
        "recorded_date": metric.recorded_date,
        "source": metric.source.value,
        "source_label": _source_label(metric.source, metric.provider),
        "provider": metric.provider,
        "health_data_file_id": metric.health_data_file_id,
        "external_type": metric.external_type,
        "source_name": metric.source_name,
        "source_version": metric.source_version,
        "device_name": metric.device_name,
        "created_at": metric.created_at,
    }


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
    metric_type_enum = MetricType(metric_type)
    source_enum = MetricSource(source)

    conflicts = await _find_activity_date_conflicts(
        db,
        user_id=user_id,
        dates=[recorded_date],
        source=source_enum,
        provider=None,
    )
    if conflicts:
        raise ActivitySourceConflictError(
            attempted_source_label="Manual entry",
            conflicts=conflicts,
        )

    existing_metric = await db.scalar(
        select(HealthMetric).where(
            HealthMetric.user_id == user_id,
            HealthMetric.metric_type == metric_type_enum,
            HealthMetric.recorded_date == recorded_date,
            HealthMetric.source == MetricSource.MANUAL,
        ).order_by(HealthMetric.created_at.desc())
    )

    if existing_metric is None:
        metric = _build_health_metric(
            user_id=user_id,
            metric_type=metric_type_enum,
            value=value,
            unit=unit,
            recorded_date=recorded_date,
            source=source_enum,
            provider=None,
        )
        db.add(metric)
    else:
        existing_metric.value = value
        existing_metric.unit = unit
        metric = existing_metric

    await db.commit()
    await db.refresh(metric)
    return metric


async def get_health_metrics(
    db: AsyncSession,
    user_id: str,
    metric_type: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
) -> list[dict[str, object]]:
    if metric_type and metric_type not in {item.value for item in ACTIVITY_METRIC_TYPES}:
        metrics = await _query_raw_health_metrics(
            db,
            user_id=user_id,
            metric_type=metric_type,
            start_date=start_date,
            end_date=end_date,
            activity_only=False,
        )
        return [_serialize_metric(metric) for metric in metrics]

    connections = await list_health_app_connections(db, user_id)
    verified_providers = {
        connection.provider
        for connection in connections
        if connection.is_connected and connection.last_synced_at is not None
    }
    metrics = await _query_raw_health_metrics(
        db,
        user_id=user_id,
        metric_type=metric_type,
        start_date=start_date,
        end_date=end_date,
        activity_only=True,
    )
    canonical_days = _canonicalize_activity_days(metrics, verified_providers=verified_providers)
    return _flatten_canonical_activity_metrics(canonical_days)


async def get_metrics_summary(
    db: AsyncSession,
    user_id: str,
    target_date: date,
) -> dict:
    """Get aggregated metrics for a single day."""
    summary: dict = {"date": target_date}
    connections = await list_health_app_connections(db, user_id)
    verified_providers = {
        connection.provider
        for connection in connections
        if connection.is_connected and connection.last_synced_at is not None
    }
    raw_metrics = await _query_raw_health_metrics(
        db,
        user_id=user_id,
        start_date=target_date,
        end_date=target_date,
        activity_only=False,
    )
    canonical_activity_metrics = _flatten_canonical_activity_metrics(
        _canonicalize_activity_days(
            [metric for metric in raw_metrics if metric.metric_type in ACTIVITY_METRIC_TYPES],
            verified_providers=verified_providers,
        )
    )
    latest_non_activity: dict[str, HealthMetric] = {}
    for metric in raw_metrics:
        if metric.metric_type in ACTIVITY_METRIC_TYPES:
            continue
        metric_key = metric.metric_type.value
        current = latest_non_activity.get(metric_key)
        if current is None or metric.created_at > current.created_at:
            latest_non_activity[metric_key] = metric

    metrics: list[dict[str, object]] = [
        *canonical_activity_metrics,
        *[_serialize_metric(metric) for metric in latest_non_activity.values()],
    ]
    for metric in metrics:
        metric_type = metric.get("metric_type")
        if isinstance(metric_type, str):
            summary[metric_type] = metric.get("value")
    return summary


async def list_health_app_connections(
    db: AsyncSession,
    user_id: str,
) -> list[HealthAppConnection]:
    result = await db.execute(
        select(HealthAppConnection)
        .where(HealthAppConnection.user_id == user_id)
        .order_by(HealthAppConnection.provider.asc())
    )
    return list(result.scalars().all())


async def upsert_health_app_connection(
    db: AsyncSession,
    *,
    user_id: str,
    provider: str,
    is_connected: bool,
    sync_method: str,
) -> HealthAppConnection:
    connection = await db.scalar(
        select(HealthAppConnection).where(
            HealthAppConnection.user_id == user_id,
            HealthAppConnection.provider == provider,
        )
    )
    now = datetime.now(timezone.utc)
    if connection is None:
        connection = HealthAppConnection(
            user_id=user_id,
            provider=provider,
            is_connected=is_connected,
            sync_method=sync_method,
            connected_at=now,
            updated_at=now,
        )
        db.add(connection)
    else:
        connection.is_connected = is_connected
        connection.sync_method = sync_method
        connection.updated_at = now
        if is_connected and connection.connected_at is None:
            connection.connected_at = now
    await db.commit()
    await db.refresh(connection)
    return connection


async def remove_health_app_connection(
    db: AsyncSession,
    *,
    user_id: str,
    provider: str,
) -> None:
    connection = await db.scalar(
        select(HealthAppConnection).where(
            HealthAppConnection.user_id == user_id,
            HealthAppConnection.provider == provider,
        )
    )
    if connection is None:
        return
    await db.delete(connection)
    await db.commit()


async def mark_health_app_connection_synced(
    db: AsyncSession,
    *,
    user_id: str,
    provider: str,
) -> HealthAppConnection:
    connection = await db.scalar(
        select(HealthAppConnection).where(
            HealthAppConnection.user_id == user_id,
            HealthAppConnection.provider == provider,
        )
    )
    now = datetime.now(timezone.utc)
    if connection is None:
        connection = HealthAppConnection(
            user_id=user_id,
            provider=provider,
            is_connected=True,
            sync_method="export_file",
            connected_at=now,
            last_synced_at=now,
            updated_at=now,
        )
        db.add(connection)
    else:
        connection.is_connected = True
        connection.last_synced_at = now
        connection.updated_at = now
    await db.commit()
    await db.refresh(connection)
    return connection


def build_activity_overview(metrics: list[dict[str, object]], *, days: int) -> dict:
    today = date.today()
    range_start = today - timedelta(days=max(days - 1, 0))
    last_7_start = today - timedelta(days=6)
    previous_7_start = today - timedelta(days=13)
    previous_7_end = today - timedelta(days=7)
    metrics_by_type: dict[str, list[dict[str, object]]] = {
        metric_type.value: [] for metric_type in ACTIVITY_METRIC_TYPES
    }
    for metric in metrics:
        metric_type = metric.get("metric_type")
        if isinstance(metric_type, str) and metric_type in metrics_by_type:
            metrics_by_type[metric_type].append(metric)

    output_metrics: list[dict[str, object]] = []
    for metric_type in ACTIVITY_METRIC_TYPES:
        metric_key = metric_type.value
        items = sorted(
            metrics_by_type.get(metric_key, []),
            key=lambda metric: metric["recorded_date"],
            reverse=True,
        )
        latest = items[0] if items else None
        last_7_values = [
            float(metric["value"])
            for metric in items
            if isinstance(metric.get("recorded_date"), date)
            and last_7_start <= metric["recorded_date"] <= today
        ]
        previous_7_values = [
            float(metric["value"])
            for metric in items
            if isinstance(metric.get("recorded_date"), date)
            and previous_7_start <= metric["recorded_date"] <= previous_7_end
        ]
        last_7_average = (
            round(sum(last_7_values) / len(last_7_values), 1) if last_7_values else None
        )
        previous_7_average = (
            round(sum(previous_7_values) / len(previous_7_values), 1)
            if previous_7_values
            else None
        )
        trend = "insufficient"
        if last_7_average is not None and previous_7_average is not None:
            baseline = max(abs(previous_7_average), 1)
            change_ratio = (last_7_average - previous_7_average) / baseline
            if abs(change_ratio) < 0.05:
                trend = "flat"
            elif change_ratio > 0:
                trend = "up"
            else:
                trend = "down"

        output_metrics.append(
            {
                "metric_type": metric_key,
                "unit": METRIC_UNITS[metric_key],
                "latest_value": latest["value"] if latest else None,
                "latest_recorded_date": latest["recorded_date"] if latest else None,
                "last_7_day_average": last_7_average,
                "previous_7_day_average": previous_7_average,
                "last_7_day_total": round(sum(last_7_values), 1) if last_7_values else None,
                "trend": trend,
            }
        )

    return {
        "range_start": range_start,
        "range_end": today,
        "metrics": output_metrics,
    }


async def get_canonical_activity_context(
    db: AsyncSession,
    *,
    user_id: str,
    days: int,
) -> dict[str, object]:
    range_start = date.today() - timedelta(days=max(days - 1, 0))
    connections = await list_health_app_connections(db, user_id)
    verified_providers = {
        connection.provider
        for connection in connections
        if connection.is_connected and connection.last_synced_at is not None
    }
    raw_metrics = await _query_raw_health_metrics(
        db,
        user_id=user_id,
        start_date=range_start,
        end_date=date.today(),
        activity_only=True,
    )
    canonical_days = _canonicalize_activity_days(raw_metrics, verified_providers=verified_providers)
    canonical_metrics = _flatten_canonical_activity_metrics(canonical_days)
    health_files = await get_user_health_files(db, user_id)
    parsed_health_files = [item for item in health_files if item.parsed_status == "parsed"]
    overview = build_activity_overview(canonical_metrics, days=days)
    overview["connected_apps"] = sum(1 for item in connections if item.is_connected)
    overview["imported_files"] = len(parsed_health_files)
    overview["hydration_tracking_available"] = False
    overview["authoritative_sources"] = _build_authoritative_sources(
        canonical_days,
        connections=connections,
    )
    overview["verified_providers"] = [
        {
            "provider": connection.provider,
            "provider_label": SUPPORTED_HEALTH_APP_PROVIDERS.get(
                connection.provider, connection.provider.replace("_", " ").title()
            ),
            "last_synced_at": connection.last_synced_at,
        }
        for connection in connections
        if connection.is_connected and connection.last_synced_at is not None
    ]
    overview["latest_activity_metrics"] = _latest_metrics_by_type(canonical_metrics)
    overview["today_activity_metrics"] = _latest_metrics_by_type(
        canonical_metrics,
        target_date=date.today(),
    )
    overview["recent_activity_days"] = _build_recent_activity_days(canonical_days)
    overview["activity_sync_sources"] = [
        {
            "provider": connection.provider,
            "provider_label": SUPPORTED_HEALTH_APP_PROVIDERS.get(
                connection.provider, connection.provider.replace("_", " ").title()
            ),
            "sync_method": connection.sync_method,
            "is_connected": connection.is_connected,
            "connected_at": connection.connected_at,
            "last_synced_at": connection.last_synced_at,
        }
        for connection in connections
    ]
    latest_import = next(iter(parsed_health_files or health_files), None)
    overview["latest_imported_file"] = (
        {
            "filename": latest_import.filename,
            "provider": latest_import.provider,
            "parsed_status": latest_import.parsed_status,
            "records_imported": latest_import.records_imported,
            "created_at": latest_import.created_at,
        }
        if latest_import is not None
        else None
    )
    return overview


async def get_activity_overview(
    db: AsyncSession,
    *,
    user_id: str,
    days: int,
) -> dict:
    return await get_canonical_activity_context(db, user_id=user_id, days=days)
