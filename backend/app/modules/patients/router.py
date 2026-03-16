from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from app.api.deps import DbSession, require_roles
from app.models import User, UserRole
from app.modules.patients.schemas import (
    BulkHistoryAccessRequest,
    BulkHistoryAccessResponse,
    DashboardResponse,
    HistoryAccessResponse,
    HistoryRecordSource,
    LabReportResponse,
    MedicationResponse,
    PatientProfileResponse,
    PatientSummaryResponse,
    PatientProfileUpsertRequest,
    UpdateHistoryAccessRequest,
    UpdateVisitVisibilityRequest,
    VisitResponse,
)
from app.modules.patients.service import (
    bulk_update_history_access,
    get_patient_summary,
    patient_dashboard,
    update_history_access,
    upsert_patient_profile,
)

router = APIRouter(prefix="/patients", tags=["patients"])


@router.put("/me/profile", response_model=PatientProfileResponse)
async def upsert_my_profile(
    payload: PatientProfileUpsertRequest,
    db: DbSession,
    current_user: Annotated[User, Depends(require_roles(UserRole.PATIENT))],
) -> PatientProfileResponse:
    profile = await upsert_patient_profile(db, current_user.id, payload)
    return PatientProfileResponse.model_validate(profile, from_attributes=True)


@router.get("/me/profile", response_model=PatientSummaryResponse)
async def get_my_profile(
    db: DbSession,
    current_user: Annotated[User, Depends(require_roles(UserRole.PATIENT))],
) -> PatientSummaryResponse:
    return PatientSummaryResponse.model_validate(await get_patient_summary(db, current_user))


@router.get("/{nhs_healthcare_id}/dashboard", response_model=DashboardResponse)
async def get_patient_dashboard(
    nhs_healthcare_id: str,
    db: DbSession,
    current_user: Annotated[
        User,
        Depends(
            require_roles(
                UserRole.PATIENT,
                UserRole.GP,
                UserRole.SPECIALIST,
                UserRole.LAB,
                UserRole.PHARMACY,
            )
        ),
    ],
) -> DashboardResponse:
    patient = await db.scalar(
        select(User).where(
            User.nhs_healthcare_id == nhs_healthcare_id,
            User.role == UserRole.PATIENT,
        )
    )
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")

    if current_user.role == UserRole.PATIENT and current_user.id != patient.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    data = await patient_dashboard(db, patient, current_user.role)
    return DashboardResponse(
        patient=PatientSummaryResponse.model_validate(data["patient"]),
        qr_payload=data["qr_payload"],
        visits=[VisitResponse.model_validate(v) for v in data["visits"]],
        lab_reports=[LabReportResponse.model_validate(r) for r in data["lab_reports"]],
        medications=[
            MedicationResponse.model_validate(m) for m in data["medications"]
        ],
    )


@router.patch("/me/visits/{visit_id}/visibility")
async def update_visit_visibility(
    visit_id: str,
    payload: UpdateVisitVisibilityRequest,
    db: DbSession,
    current_user: Annotated[User, Depends(require_roles(UserRole.PATIENT))],
) -> dict[str, str]:
    await update_history_access(
        db,
        patient_user_id=current_user.id,
        record_source=HistoryRecordSource.GP_VISIT,
        record_id=visit_id,
        payload=UpdateHistoryAccessRequest(is_hidden_by_patient=payload.is_hidden_by_patient),
    )
    return {"message": "Visit visibility updated"}


@router.patch(
    "/me/history/{record_source}/{record_id}/access",
    response_model=HistoryAccessResponse,
)
async def update_my_history_access(
    record_source: HistoryRecordSource,
    record_id: str,
    payload: UpdateHistoryAccessRequest,
    db: DbSession,
    current_user: Annotated[User, Depends(require_roles(UserRole.PATIENT))],
) -> HistoryAccessResponse:
    return await update_history_access(
        db,
        patient_user_id=current_user.id,
        record_source=record_source,
        record_id=record_id,
        payload=payload,
    )


@router.patch("/me/history/access", response_model=BulkHistoryAccessResponse)
async def bulk_update_my_history_access(
    payload: BulkHistoryAccessRequest,
    db: DbSession,
    current_user: Annotated[User, Depends(require_roles(UserRole.PATIENT))],
) -> BulkHistoryAccessResponse:
    updated_records = await bulk_update_history_access(
        db,
        patient_user_id=current_user.id,
        payload=payload,
    )
    return BulkHistoryAccessResponse(updated_records=updated_records)
