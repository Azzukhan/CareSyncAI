from datetime import date, datetime, timedelta, timezone

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db.base import Base
from app.models import HealthAppConnection, HealthDataFile, HealthMetric, MetricSource, MetricType
from app.modules.health_data.service import (
    ActivitySourceConflictError,
    SUPPORTED_HEALTH_APP_PROVIDERS,
    create_health_metric,
    get_canonical_activity_context,
    parse_health_file,
    save_health_file,
)


APPLE_HEALTH_XML_SAMPLE = """<?xml version="1.0"?>
<ClinicalDocument xmlns="urn:hl7-org:v3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <entry>
    <observation classCode="OBS" moodCode="EVN">
      <text>
        <sourceName>Azzu's Apple Watch</sourceName>
        <sourceVersion>11.5</sourceVersion>
        <device>&lt;&lt;HKDevice: 0x1, name:Apple Watch, manufacturer:Apple Inc.&gt;&gt;</device>
        <value>78</value>
        <type>HKQuantityTypeIdentifierHeartRate</type>
        <unit>count/min</unit>
      </text>
      <effectiveTime>
        <low value="20260318070000+0000" />
        <high value="20260318070000+0000" />
      </effectiveTime>
      <value xsi:type="PQ" value="78" unit="count/min" />
    </observation>
  </entry>
  <entry>
    <observation classCode="OBS" moodCode="EVN">
      <text>
        <sourceName>Azzu's iPhone</sourceName>
        <sourceVersion>18.4</sourceVersion>
        <value>8042</value>
        <type>HKQuantityTypeIdentifierStepCount</type>
        <unit>count</unit>
      </text>
      <effectiveTime>
        <low value="20260318090000+0000" />
        <high value="20260318090000+0000" />
      </effectiveTime>
      <value xsi:type="PQ" value="8042" unit="count" />
    </observation>
  </entry>
  <entry>
    <observation classCode="OBS" moodCode="EVN">
      <text>
        <sourceName>Azzu's iPhone</sourceName>
        <sourceVersion>18.4</sourceVersion>
        <value>HKCategoryValueSleepAnalysisAsleepCore</value>
        <type>HKCategoryTypeIdentifierSleepAnalysis</type>
      </text>
      <effectiveTime>
        <low value="20260317230000+0000" />
        <high value="20260318030000+0000" />
      </effectiveTime>
    </observation>
  </entry>
</ClinicalDocument>
"""

GOOGLE_FIT_JSON_SAMPLE = """
[
  {"date": "2026-03-18", "metric_type": "steps", "value": 9200, "unit": "steps"},
  {"date": "2026-03-18", "metric_type": "active_minutes", "value": 55, "unit": "minutes"},
  {"date": "2026-03-18", "metric_type": "distance_km", "value": 6.4, "unit": "km"}
]
"""


def _csv_for_rows(rows: list[tuple[str, str, float, str]]) -> bytes:
    header = "date,metric_type,value,unit\n"
    body = "\n".join(f"{recorded_date},{metric_type},{value},{unit}" for recorded_date, metric_type, value, unit in rows)
    return f"{header}{body}\n".encode("utf-8")


@pytest.fixture
async def db_session(tmp_path) -> AsyncSession:
    database_path = tmp_path / "health-data-test.db"
    engine = create_async_engine(f"sqlite+aiosqlite:///{database_path}")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with session_factory() as session:
        yield session

    await engine.dispose()


@pytest.mark.asyncio
async def test_parse_apple_health_xml_imports_metrics_and_metadata(
    db_session: AsyncSession,
) -> None:
    health_file = await save_health_file(
        db_session,
        user_id="patient-1",
        filename="export_cda.xml",
        file_url="/media/health_data/patient-1/export_cda.xml",
        file_type="xml",
        provider="apple_health",
    )

    imported_count = await parse_health_file(
        db_session,
        health_file,
        APPLE_HEALTH_XML_SAMPLE.encode("utf-8"),
        metric_source=MetricSource.APP,
        provider="apple_health",
    )

    assert imported_count == 3
    assert health_file.parsed_status == "parsed"
    assert health_file.records_imported == 3

    metrics = list(
        (
            await db_session.execute(
                select(HealthMetric).where(HealthMetric.user_id == "patient-1")
            )
        )
        .scalars()
        .all()
    )
    assert len(metrics) == 3
    assert all(metric.health_data_file_id == health_file.id for metric in metrics)

    heart_rate_metric = next(
        metric for metric in metrics if metric.metric_type == MetricType.HEART_RATE
    )
    assert heart_rate_metric.provider == "apple_health"
    assert heart_rate_metric.external_type == "HKQuantityTypeIdentifierHeartRate"
    assert heart_rate_metric.source_name == "Azzu's Apple Watch"
    assert heart_rate_metric.source_version == "11.5"
    assert heart_rate_metric.device_name == "Apple Watch"

    steps_metric = next(metric for metric in metrics if metric.metric_type == MetricType.STEPS)
    assert steps_metric.value == 8042
    assert steps_metric.recorded_date == date(2026, 3, 18)

    sleep_metric = next(
        metric for metric in metrics if metric.metric_type == MetricType.SLEEP_HOURS
    )
    assert sleep_metric.value == 4
    assert sleep_metric.unit == "hours"


@pytest.mark.asyncio
async def test_parse_google_fit_json_sets_provider_and_file_provenance(
    db_session: AsyncSession,
) -> None:
    health_file = await save_health_file(
        db_session,
        user_id="patient-json",
        filename="google-fit.json",
        file_url="/media/health_data/patient-json/google-fit.json",
        file_type="json",
        provider="google_fit",
    )

    imported_count = await parse_health_file(
        db_session,
        health_file,
        GOOGLE_FIT_JSON_SAMPLE.encode("utf-8"),
        metric_source=MetricSource.APP,
        provider="google_fit",
    )

    assert imported_count == 3
    metrics = list(
        (
            await db_session.execute(
                select(HealthMetric).where(HealthMetric.user_id == "patient-json")
            )
        )
        .scalars()
        .all()
    )
    assert {metric.provider for metric in metrics} == {"google_fit"}
    assert all(metric.health_data_file_id == health_file.id for metric in metrics)


@pytest.mark.asyncio
async def test_manual_entry_is_rejected_when_app_data_owns_same_date(
    db_session: AsyncSession,
) -> None:
    activity_date = date.today()
    health_file = await save_health_file(
        db_session,
        user_id="patient-conflict",
        filename="apple.csv",
        file_url="/media/health_data/patient-conflict/apple.csv",
        file_type="csv",
        provider="apple_health",
    )
    await parse_health_file(
        db_session,
        health_file,
        _csv_for_rows([(activity_date.isoformat(), "steps", 8200, "steps")]),
        metric_source=MetricSource.APP,
        provider="apple_health",
    )

    with pytest.raises(ActivitySourceConflictError):
        await create_health_metric(
            db_session,
            "patient-conflict",
            "steps",
            7600,
            "steps",
            activity_date,
            "manual",
        )


@pytest.mark.asyncio
async def test_import_conflict_with_manual_date_is_atomic(
    db_session: AsyncSession,
) -> None:
    conflicting_date = date.today()
    free_date = conflicting_date - timedelta(days=1)
    await create_health_metric(
        db_session,
        "patient-atomic",
        "steps",
        6100,
        "steps",
        conflicting_date,
        "manual",
    )
    health_file = await save_health_file(
        db_session,
        user_id="patient-atomic",
        filename="apple.csv",
        file_url="/media/health_data/patient-atomic/apple.csv",
        file_type="csv",
        provider="apple_health",
    )

    with pytest.raises(ActivitySourceConflictError):
        await parse_health_file(
            db_session,
            health_file,
            _csv_for_rows(
                [
                    (conflicting_date.isoformat(), "steps", 9000, "steps"),
                    (free_date.isoformat(), "steps", 9500, "steps"),
                ]
            ),
            metric_source=MetricSource.APP,
            provider="apple_health",
        )

    metrics = list(
        (
            await db_session.execute(
                select(HealthMetric).where(HealthMetric.user_id == "patient-atomic")
            )
        )
        .scalars()
        .all()
    )
    assert len(metrics) == 1
    assert metrics[0].source == MetricSource.MANUAL

    refreshed_file = await db_session.get(HealthDataFile, health_file.id)
    assert refreshed_file is not None
    assert refreshed_file.parsed_status == "failed"
    assert refreshed_file.records_imported == 0


@pytest.mark.asyncio
async def test_import_rejects_different_provider_for_same_date(
    db_session: AsyncSession,
) -> None:
    activity_date = date.today()
    apple_file = await save_health_file(
        db_session,
        user_id="patient-provider-conflict",
        filename="apple.csv",
        file_url="/media/health_data/patient-provider-conflict/apple.csv",
        file_type="csv",
        provider="apple_health",
    )
    await parse_health_file(
        db_session,
        apple_file,
        _csv_for_rows([(activity_date.isoformat(), "steps", 8400, "steps")]),
        metric_source=MetricSource.APP,
        provider="apple_health",
    )

    google_file = await save_health_file(
        db_session,
        user_id="patient-provider-conflict",
        filename="google.csv",
        file_url="/media/health_data/patient-provider-conflict/google.csv",
        file_type="csv",
        provider="google_fit",
    )

    with pytest.raises(ActivitySourceConflictError):
        await parse_health_file(
            db_session,
            google_file,
            _csv_for_rows([(activity_date.isoformat(), "steps", 9100, "steps")]),
            metric_source=MetricSource.APP,
            provider="google_fit",
        )


@pytest.mark.asyncio
async def test_same_provider_reimport_replaces_rows_for_same_date(
    db_session: AsyncSession,
) -> None:
    activity_date = date.today()
    first_file = await save_health_file(
        db_session,
        user_id="patient-reimport",
        filename="apple-first.csv",
        file_url="/media/health_data/patient-reimport/apple-first.csv",
        file_type="csv",
        provider="apple_health",
    )
    await parse_health_file(
        db_session,
        first_file,
        _csv_for_rows(
            [
                (activity_date.isoformat(), "steps", 7000, "steps"),
                (activity_date.isoformat(), "active_minutes", 35, "minutes"),
            ]
        ),
        metric_source=MetricSource.APP,
        provider="apple_health",
    )

    second_file = await save_health_file(
        db_session,
        user_id="patient-reimport",
        filename="apple-second.csv",
        file_url="/media/health_data/patient-reimport/apple-second.csv",
        file_type="csv",
        provider="apple_health",
    )
    await parse_health_file(
        db_session,
        second_file,
        _csv_for_rows(
            [
                (activity_date.isoformat(), "steps", 9100, "steps"),
                (activity_date.isoformat(), "active_minutes", 52, "minutes"),
            ]
        ),
        metric_source=MetricSource.APP,
        provider="apple_health",
    )

    metrics = list(
        (
            await db_session.execute(
                select(HealthMetric).where(
                    HealthMetric.user_id == "patient-reimport",
                    HealthMetric.recorded_date == activity_date,
                )
            )
        )
        .scalars()
        .all()
    )
    assert len(metrics) == 2
    assert {metric.health_data_file_id for metric in metrics} == {second_file.id}
    assert {metric.metric_type.value: metric.value for metric in metrics} == {
        "steps": 9100,
        "active_minutes": 52,
    }


@pytest.mark.asyncio
async def test_canonical_activity_context_prefers_verified_app_data_over_legacy_manual_rows(
    db_session: AsyncSession,
) -> None:
    activity_date = date.today()
    health_file = HealthDataFile(
        user_id="patient-canonical",
        filename="apple-health.json",
        file_url="/media/health_data/patient-canonical/apple-health.json",
        file_type="json",
        provider="apple_health",
        parsed_status="parsed",
        records_imported=2,
    )
    db_session.add(health_file)
    await db_session.flush()

    db_session.add(
        HealthAppConnection(
            user_id="patient-canonical",
            provider="apple_health",
            is_connected=True,
            sync_method="export_file",
            last_synced_at=datetime.now(timezone.utc),
        )
    )
    db_session.add_all(
        [
            HealthMetric(
                user_id="patient-canonical",
                metric_type=MetricType.STEPS,
                value=5000,
                unit="steps",
                recorded_date=activity_date,
                source=MetricSource.MANUAL,
            ),
            HealthMetric(
                user_id="patient-canonical",
                metric_type=MetricType.STEPS,
                value=9200,
                unit="steps",
                recorded_date=activity_date,
                source=MetricSource.APP,
                provider="apple_health",
                health_data_file_id=health_file.id,
            ),
            HealthMetric(
                user_id="patient-canonical",
                metric_type=MetricType.SLEEP_HOURS,
                value=6.5,
                unit="hours",
                recorded_date=activity_date,
                source=MetricSource.APP,
                provider="apple_health",
                health_data_file_id=health_file.id,
            ),
        ]
    )
    await db_session.commit()

    context = await get_canonical_activity_context(
        db_session,
        user_id="patient-canonical",
        days=30,
    )

    latest_metrics = context["latest_activity_metrics"]
    assert latest_metrics["steps"]["value"] == 9200
    assert latest_metrics["steps"]["provider"] == "apple_health"
    assert latest_metrics["steps"]["source_label"] == "Apple Health"
    assert latest_metrics["sleep_hours"]["value"] == 6.5

    authoritative_sources = context["authoritative_sources"]
    assert any(
        source["provider"] == "apple_health" and source["days_count"] == 1
        for source in authoritative_sources
    )
    assert context["hydration_tracking_available"] is False


def test_supported_health_providers_are_limited_to_apple_and_google() -> None:
    assert set(SUPPORTED_HEALTH_APP_PROVIDERS) == {"apple_health", "google_fit"}
