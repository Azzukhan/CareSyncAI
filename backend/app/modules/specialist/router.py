from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.deps import DbSession, require_roles
from app.models import User, UserRole
from app.modules.specialist.schemas import (
    SpecialistLabOrderRequest,
    SpecialistMedicationRequest,
    SpecialistReferralCreateRequest,
)
from app.modules.specialist.service import (
    create_specialist_note,
    specialist_add_medication,
    specialist_order_lab,
)

router = APIRouter(prefix="/specialist", tags=["specialist"])


@router.post("/notes")
async def add_specialist_note(
    payload: SpecialistReferralCreateRequest,
    db: DbSession,
    current_user: Annotated[User, Depends(require_roles(UserRole.SPECIALIST))],
) -> dict:
    referral = await create_specialist_note(
        db,
        current_user,
        payload.patient_nhs_healthcare_id,
        payload.specialist_notes,
    )
    return {"message": "Specialist note added", "referral_id": referral.id}


@router.post("/referrals/lab")
async def specialist_refer_lab(
    payload: SpecialistLabOrderRequest,
    db: DbSession,
    current_user: Annotated[User, Depends(require_roles(UserRole.SPECIALIST))],
) -> dict:
    order = await specialist_order_lab(
        db,
        current_user,
        payload.patient_nhs_healthcare_id,
        payload.test_description,
    )
    return {"message": "Lab order created", "lab_order_id": order.id}


@router.post("/medications")
async def specialist_prescribe(
    payload: SpecialistMedicationRequest,
    db: DbSession,
    current_user: Annotated[User, Depends(require_roles(UserRole.SPECIALIST))],
) -> dict:
    medication = await specialist_add_medication(
        db,
        current_user,
        payload.patient_nhs_healthcare_id,
        payload.medicine_name,
        payload.dosage_instruction,
    )
    return {"message": "Medication added", "medication_id": medication.id}
