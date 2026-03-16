from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.models import (
    GPVisit,
    LabOrder,
    LabReport,
    MedicationOrder,
    PatientProfile,
    SpecialistReferral,
    User,
    UserRole,
)
from app.modules.patients.schemas import (
    BulkHistoryAccessRequest,
    HistoryAccessResponse,
    HistoryRecordSource,
    PatientProfileUpsertRequest,
    UpdateHistoryAccessRequest,
)


def _split_csv_field(value: str | None) -> list[str]:
    if not value:
        return []
    return [item.strip() for item in value.split(",") if item.strip()]


def _build_patient_summary(patient_user: User, profile: PatientProfile | None) -> dict:
    return {
        "user_id": patient_user.id,
        "nhs_healthcare_id": patient_user.nhs_healthcare_id,
        "full_name": patient_user.full_name,
        "email": patient_user.email,
        "date_of_birth": profile.date_of_birth if profile else None,
        "phone_number": profile.phone_number if profile else None,
        "address": profile.address if profile else None,
        "blood_group": profile.blood_group if profile else None,
        "allergies": _split_csv_field(profile.allergies if profile else None),
        "chronic_conditions": _split_csv_field(profile.chronic_conditions if profile else None),
    }


async def upsert_patient_profile(
    db: AsyncSession, patient_user_id: str, payload: PatientProfileUpsertRequest
) -> PatientProfile:
    profile = await db.scalar(select(PatientProfile).where(PatientProfile.user_id == patient_user_id))
    if not profile:
        profile = PatientProfile(user_id=patient_user_id)
        db.add(profile)

    for key, value in payload.model_dump().items():
        setattr(profile, key, value)

    await db.commit()
    await db.refresh(profile)
    return profile


async def get_patient_summary(db: AsyncSession, patient_user: User) -> dict:
    profile = await db.scalar(select(PatientProfile).where(PatientProfile.user_id == patient_user.id))
    return _build_patient_summary(patient_user, profile)


def _provider_share_field(viewer_role: UserRole) -> str | None:
    if viewer_role == UserRole.GP:
        return "shared_with_gp"
    if viewer_role == UserRole.SPECIALIST:
        return "shared_with_specialist"
    return None


async def patient_dashboard(db: AsyncSession, patient_user: User, viewer_role: UserRole) -> dict:
    profile = await db.scalar(select(PatientProfile).where(PatientProfile.user_id == patient_user.id))
    visit_provider = aliased(User)
    referral_provider = aliased(User)
    report_requester = aliased(User)
    medication_prescriber = aliased(User)

    share_field = _provider_share_field(viewer_role)
    visit_filters = [GPVisit.patient_user_id == patient_user.id]
    if share_field:
        visit_filters.extend(
            [
                GPVisit.is_hidden_by_patient.is_(False),
                getattr(GPVisit, share_field).is_(True),
            ]
        )

    visit_rows = await db.execute(
        select(
            GPVisit,
            visit_provider.full_name.label("provider_name"),
            visit_provider.role.label("provider_role"),
        )
        .join(visit_provider, GPVisit.gp_user_id == visit_provider.id)
        .where(*visit_filters)
        .order_by(GPVisit.created_at.desc())
    )
    referral_filters = [SpecialistReferral.patient_user_id == patient_user.id]
    if share_field:
        referral_filters.extend(
            [
                SpecialistReferral.is_hidden_by_patient.is_(False),
                getattr(SpecialistReferral, share_field).is_(True),
            ]
        )

    referral_rows = await db.execute(
        select(
            SpecialistReferral,
            referral_provider.full_name.label("provider_name"),
            referral_provider.role.label("provider_role"),
        )
        .join(referral_provider, SpecialistReferral.referred_by_user_id == referral_provider.id)
        .where(*referral_filters)
        .order_by(SpecialistReferral.created_at.desc())
    )

    report_filters = [LabOrder.patient_user_id == patient_user.id]
    if share_field:
        report_filters.append(getattr(LabOrder, share_field).is_(True))

    report_rows = await db.execute(
        select(
            LabReport,
            LabOrder.test_description,
            LabOrder.status,
            report_requester.full_name.label("ordered_by_name"),
            LabOrder.shared_with_gp,
            LabOrder.shared_with_specialist,
        )
        .join(LabOrder, LabReport.lab_order_id == LabOrder.id)
        .join(report_requester, LabOrder.requested_by_user_id == report_requester.id)
        .where(*report_filters)
        .order_by(LabReport.created_at.desc())
    )

    medication_filters = [MedicationOrder.patient_user_id == patient_user.id]
    if share_field:
        medication_filters.append(getattr(MedicationOrder, share_field).is_(True))

    medication_rows = await db.execute(
        select(
            MedicationOrder,
            medication_prescriber.full_name.label("prescribed_by_name"),
        )
        .join(medication_prescriber, MedicationOrder.prescribed_by_user_id == medication_prescriber.id)
        .where(*medication_filters)
        .order_by(MedicationOrder.created_at.desc())
    )

    visits = [
        {
            "id": visit.id,
            "source_kind": HistoryRecordSource.GP_VISIT,
            "patient_user_id": visit.patient_user_id,
            "provider_user_id": visit.gp_user_id,
            "provider_name": provider_name,
            "provider_role": provider_role.value,
            "record_type": "gp_visit",
            "notes": visit.notes,
            "is_hidden_by_patient": visit.is_hidden_by_patient,
            "shared_with_gp": visit.shared_with_gp,
            "shared_with_specialist": visit.shared_with_specialist,
            "created_at": visit.created_at,
        }
        for visit, provider_name, provider_role in visit_rows.all()
    ]
    visits.extend(
        {
            "id": referral.id,
            "source_kind": HistoryRecordSource.SPECIALIST_REFERRAL,
            "patient_user_id": referral.patient_user_id,
            "provider_user_id": referral.referred_by_user_id,
            "provider_name": provider_name,
            "provider_role": provider_role.value,
            "record_type": (
                "specialist_note" if provider_role == UserRole.SPECIALIST else "specialist_referral"
            ),
            "notes": referral.specialist_notes,
            "is_hidden_by_patient": referral.is_hidden_by_patient,
            "shared_with_gp": referral.shared_with_gp,
            "shared_with_specialist": referral.shared_with_specialist,
            "created_at": referral.created_at,
        }
        for referral, provider_name, provider_role in referral_rows.all()
    )
    visits.sort(key=lambda item: item["created_at"], reverse=True)

    return {
        "patient": _build_patient_summary(patient_user, profile),
        "qr_payload": patient_user.nhs_healthcare_id,
        "visits": visits,
        "lab_reports": [
            {
                "id": report.id,
                "lab_order_id": report.lab_order_id,
                "test_description": test_description,
                "ordered_by_name": ordered_by_name,
                "status": status,
                "report_summary": report.report_summary,
                "file_url": report.file_url,
                "shared_with_gp": shared_with_gp,
                "shared_with_specialist": shared_with_specialist,
                "created_at": report.created_at,
            }
            for (
                report,
                test_description,
                status,
                ordered_by_name,
                shared_with_gp,
                shared_with_specialist,
            ) in report_rows.all()
        ],
        "medications": [
            {
                "id": medication.id,
                "patient_user_id": medication.patient_user_id,
                "prescribed_by_user_id": medication.prescribed_by_user_id,
                "prescribed_by_name": prescribed_by_name,
                "medicine_name": medication.medicine_name,
                "dosage_instruction": medication.dosage_instruction,
                "status": medication.status,
                "shared_with_gp": medication.shared_with_gp,
                "shared_with_specialist": medication.shared_with_specialist,
                "created_at": medication.created_at,
            }
            for medication, prescribed_by_name in medication_rows.all()
        ],
    }


def _apply_history_access_update(
    record: GPVisit | SpecialistReferral | LabOrder | MedicationOrder,
    payload: UpdateHistoryAccessRequest | BulkHistoryAccessRequest,
) -> None:
    if payload.shared_with_gp is not None:
        record.shared_with_gp = payload.shared_with_gp
    if payload.shared_with_specialist is not None:
        record.shared_with_specialist = payload.shared_with_specialist
    if isinstance(payload, UpdateHistoryAccessRequest) and payload.is_hidden_by_patient is not None:
        if not hasattr(record, "is_hidden_by_patient"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This record does not support hide/show access",
            )
        record.is_hidden_by_patient = payload.is_hidden_by_patient


def _validate_access_payload(payload: UpdateHistoryAccessRequest | BulkHistoryAccessRequest) -> None:
    if (
        payload.shared_with_gp is None
        and payload.shared_with_specialist is None
        and (
            not isinstance(payload, UpdateHistoryAccessRequest)
            or payload.is_hidden_by_patient is None
        )
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one access field must be provided",
        )


async def update_history_access(
    db: AsyncSession,
    patient_user_id: str,
    record_source: HistoryRecordSource,
    record_id: str,
    payload: UpdateHistoryAccessRequest,
) -> HistoryAccessResponse:
    _validate_access_payload(payload)

    hidden_value: bool | None = None

    if record_source == HistoryRecordSource.GP_VISIT:
        record = await db.scalar(
            select(GPVisit).where(GPVisit.id == record_id, GPVisit.patient_user_id == patient_user_id)
        )
    elif record_source == HistoryRecordSource.SPECIALIST_REFERRAL:
        record = await db.scalar(
            select(SpecialistReferral).where(
                SpecialistReferral.id == record_id,
                SpecialistReferral.patient_user_id == patient_user_id,
            )
        )
    elif record_source == HistoryRecordSource.LAB_REPORT:
        row = (
            await db.execute(
                select(LabReport, LabOrder)
                .join(LabOrder, LabReport.lab_order_id == LabOrder.id)
                .where(LabReport.id == record_id, LabOrder.patient_user_id == patient_user_id)
            )
        ).first()
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")
        _, record = row
    else:
        record = await db.scalar(
            select(MedicationOrder).where(
                MedicationOrder.id == record_id,
                MedicationOrder.patient_user_id == patient_user_id,
            )
        )

    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")

    _apply_history_access_update(record, payload)
    if hasattr(record, "is_hidden_by_patient"):
        hidden_value = record.is_hidden_by_patient

    await db.commit()
    return HistoryAccessResponse(
        record_id=record_id,
        record_source=record_source,
        is_hidden_by_patient=hidden_value,
        shared_with_gp=record.shared_with_gp,
        shared_with_specialist=record.shared_with_specialist,
    )


async def bulk_update_history_access(
    db: AsyncSession,
    patient_user_id: str,
    payload: BulkHistoryAccessRequest,
) -> int:
    _validate_access_payload(payload)

    updated_records = 0
    for model in (GPVisit, SpecialistReferral, LabOrder, MedicationOrder):
        rows = (
            await db.scalars(select(model).where(model.patient_user_id == patient_user_id))
        ).all()
        for record in rows:
            _apply_history_access_update(record, payload)
            updated_records += 1

    await db.commit()
    return updated_records
