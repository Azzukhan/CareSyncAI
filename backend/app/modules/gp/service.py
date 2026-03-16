from datetime import date, datetime, time, timezone

from fastapi import HTTPException, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import GPVisit, LabOrder, MedicationOrder, SpecialistReferral, User, UserRole
from app.modules.gp.schemas import (
    GPVisitCreateRequest,
    LabOrderCreateRequest,
    MedicationCreateRequest,
    ReferralCreateRequest,
)


async def _get_patient_by_nhs(db: AsyncSession, nhs_id: str) -> User:
    patient = await db.scalar(
        select(User).where(User.nhs_healthcare_id == nhs_id, User.role == UserRole.PATIENT)
    )
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")
    return patient


async def create_gp_visit(db: AsyncSession, gp_user: User, payload: GPVisitCreateRequest) -> GPVisit:
    patient = await _get_patient_by_nhs(db, payload.patient_nhs_healthcare_id)
    visit = GPVisit(patient_user_id=patient.id, gp_user_id=gp_user.id, notes=payload.notes)
    db.add(visit)
    await db.commit()
    await db.refresh(visit)
    return visit


async def create_specialist_referral(
    db: AsyncSession, gp_user: User, payload: ReferralCreateRequest
) -> SpecialistReferral:
    patient = await _get_patient_by_nhs(db, payload.patient_nhs_healthcare_id)
    referral = SpecialistReferral(
        patient_user_id=patient.id,
        referred_by_user_id=gp_user.id,
        specialist_notes=payload.specialist_notes,
    )
    db.add(referral)
    await db.commit()
    await db.refresh(referral)
    return referral


async def create_lab_order(db: AsyncSession, gp_user: User, payload: LabOrderCreateRequest) -> LabOrder:
    patient = await _get_patient_by_nhs(db, payload.patient_nhs_healthcare_id)
    order = LabOrder(
        patient_user_id=patient.id,
        requested_by_user_id=gp_user.id,
        test_description=payload.test_description,
    )
    db.add(order)
    await db.commit()
    await db.refresh(order)
    return order


async def prescribe_medication(
    db: AsyncSession, gp_user: User, payload: MedicationCreateRequest
) -> MedicationOrder:
    patient = await _get_patient_by_nhs(db, payload.patient_nhs_healthcare_id)
    medication = MedicationOrder(
        patient_user_id=patient.id,
        prescribed_by_user_id=gp_user.id,
        medicine_name=payload.medicine_name,
        dosage_instruction=payload.dosage_instruction,
    )
    db.add(medication)
    await db.commit()
    await db.refresh(medication)
    return medication


async def gp_dashboard_stats(db: AsyncSession, gp_user_id: str) -> dict:
    today_start = datetime.combine(date.today(), time.min, tzinfo=timezone.utc)
    today_end = datetime.combine(date.today(), time.max, tzinfo=timezone.utc)

    unique_patients = await db.scalar(
        select(func.count(func.distinct(GPVisit.patient_user_id))).where(
            and_(
                GPVisit.gp_user_id == gp_user_id,
                GPVisit.created_at >= today_start,
                GPVisit.created_at <= today_end,
            )
        )
    )
    total_visits = await db.scalar(
        select(func.count(GPVisit.id)).where(
            and_(
                GPVisit.gp_user_id == gp_user_id,
                GPVisit.created_at >= today_start,
                GPVisit.created_at <= today_end,
            )
        )
    )
    last_visit_at = func.max(GPVisit.created_at).label("last_visit_at")
    recent_patient_rows = await db.execute(
        select(User.nhs_healthcare_id, User.full_name, last_visit_at)
        .join(GPVisit, GPVisit.patient_user_id == User.id)
        .where(GPVisit.gp_user_id == gp_user_id, User.role == UserRole.PATIENT)
        .group_by(User.id, User.nhs_healthcare_id, User.full_name)
        .order_by(last_visit_at.desc())
        .limit(6)
    )

    return {
        "gp_user_id": gp_user_id,
        "todays_patient_count": unique_patients or 0,
        "todays_visits": total_visits or 0,
        "recent_patients": [
            {
                "nhs_healthcare_id": nhs_healthcare_id,
                "full_name": full_name,
                "last_visit_at": recent_visit_at,
            }
            for nhs_healthcare_id, full_name, recent_visit_at in recent_patient_rows.all()
        ],
        "generated_at": datetime.now(timezone.utc),
    }
