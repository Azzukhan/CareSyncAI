from datetime import datetime, timezone

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db.base import Base
from app.models import (
    GPVisit,
    LabOrder,
    LabReport,
    MedicationOrder,
    SpecialistReferral,
    User,
    UserRole,
)
from app.modules.patients.schemas import BulkHistoryAccessRequest, UpdateHistoryAccessRequest
from app.modules.patients.service import bulk_update_history_access, patient_dashboard, update_history_access


@pytest.fixture
async def db_session(tmp_path) -> AsyncSession:
    database_path = tmp_path / "patient-history-access.db"
    engine = create_async_engine(f"sqlite+aiosqlite:///{database_path}")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with session_factory() as session:
        yield session

    await engine.dispose()


async def create_user(
    session: AsyncSession,
    *,
    nhs_healthcare_id: str,
    email: str,
    role: UserRole,
) -> User:
    user = User(
        nhs_healthcare_id=nhs_healthcare_id,
        full_name=email.split("@")[0].title(),
        email=email,
        password_hash="hashed",
        role=role,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user


@pytest.mark.asyncio
async def test_patient_history_is_hidden_from_gp_and_specialist_by_default(
    db_session: AsyncSession,
) -> None:
    patient = await create_user(
        db_session,
        nhs_healthcare_id="PATIENT-1",
        email="patient-history@example.com",
        role=UserRole.PATIENT,
    )
    gp = await create_user(
        db_session,
        nhs_healthcare_id="GP-1",
        email="gp-history@example.com",
        role=UserRole.GP,
    )
    specialist = await create_user(
        db_session,
        nhs_healthcare_id="SPEC-1",
        email="specialist-history@example.com",
        role=UserRole.SPECIALIST,
    )

    lab_order = LabOrder(
        patient_user_id=patient.id,
        requested_by_user_id=gp.id,
        test_description="Full blood count",
    )
    medication = MedicationOrder(
        patient_user_id=patient.id,
        prescribed_by_user_id=gp.id,
        medicine_name="Ibuprofen",
        dosage_instruction="200mg after food",
    )
    db_session.add_all(
        [
            GPVisit(
                patient_user_id=patient.id,
                gp_user_id=gp.id,
                notes="Initial GP note",
            ),
            SpecialistReferral(
                patient_user_id=patient.id,
                referred_by_user_id=gp.id,
                specialist_notes="Referral note",
            ),
            lab_order,
            medication,
        ]
    )
    await db_session.flush()
    db_session.add(
        LabReport(
            lab_order_id=lab_order.id,
            uploaded_by_user_id=gp.id,
            report_summary="All values within range",
            created_at=datetime.now(timezone.utc),
        )
    )
    await db_session.commit()

    patient_view = await patient_dashboard(db_session, patient, UserRole.PATIENT)
    assert len(patient_view["visits"]) == 2
    assert len(patient_view["lab_reports"]) == 1
    assert len(patient_view["medications"]) == 1

    gp_view = await patient_dashboard(db_session, patient, UserRole.GP)
    assert gp_view["visits"] == []
    assert gp_view["lab_reports"] == []
    assert gp_view["medications"] == []

    specialist_view = await patient_dashboard(db_session, patient, UserRole.SPECIALIST)
    assert specialist_view["visits"] == []
    assert specialist_view["lab_reports"] == []
    assert specialist_view["medications"] == []


@pytest.mark.asyncio
async def test_bulk_and_record_history_access_updates_provider_visibility(
    db_session: AsyncSession,
) -> None:
    patient = await create_user(
        db_session,
        nhs_healthcare_id="PATIENT-2",
        email="patient-history-2@example.com",
        role=UserRole.PATIENT,
    )
    gp = await create_user(
        db_session,
        nhs_healthcare_id="GP-2",
        email="gp-history-2@example.com",
        role=UserRole.GP,
    )

    visit = GPVisit(
        patient_user_id=patient.id,
        gp_user_id=gp.id,
        notes="Review after treatment",
    )
    lab_order = LabOrder(
        patient_user_id=patient.id,
        requested_by_user_id=gp.id,
        test_description="Cholesterol panel",
    )
    medication = MedicationOrder(
        patient_user_id=patient.id,
        prescribed_by_user_id=gp.id,
        medicine_name="Atorvastatin",
        dosage_instruction="10mg at night",
    )
    db_session.add_all([visit, lab_order, medication])
    await db_session.flush()
    report = LabReport(
        lab_order_id=lab_order.id,
        uploaded_by_user_id=gp.id,
        report_summary="Raised LDL",
    )
    db_session.add(report)
    await db_session.commit()

    updated_records = await bulk_update_history_access(
        db_session,
        patient_user_id=patient.id,
        payload=BulkHistoryAccessRequest(shared_with_gp=True),
    )
    assert updated_records == 3

    gp_view = await patient_dashboard(db_session, patient, UserRole.GP)
    assert len(gp_view["visits"]) == 1
    assert len(gp_view["lab_reports"]) == 1
    assert len(gp_view["medications"]) == 1

    await update_history_access(
        db_session,
        patient_user_id=patient.id,
        record_source="gp_visit",
        record_id=visit.id,
        payload=UpdateHistoryAccessRequest(is_hidden_by_patient=True),
    )

    gp_view_after_hide = await patient_dashboard(db_session, patient, UserRole.GP)
    assert gp_view_after_hide["visits"] == []
    assert len(gp_view_after_hide["lab_reports"]) == 1
    assert len(gp_view_after_hide["medications"]) == 1
