from app.models import LabOrder, MedicationOrder, SpecialistReferral, User
from app.modules.gp.schemas import LabOrderCreateRequest, MedicationCreateRequest, ReferralCreateRequest
from app.modules.gp.service import create_lab_order, create_specialist_referral, prescribe_medication
from sqlalchemy.ext.asyncio import AsyncSession


async def create_specialist_note(
    db: AsyncSession, specialist_user: User, patient_nhs_healthcare_id: str, specialist_notes: str
) -> SpecialistReferral:
    payload = ReferralCreateRequest(
        patient_nhs_healthcare_id=patient_nhs_healthcare_id,
        specialist_notes=specialist_notes,
    )
    return await create_specialist_referral(db, specialist_user, payload)


async def specialist_order_lab(
    db: AsyncSession, specialist_user: User, patient_nhs_healthcare_id: str, test_description: str
) -> LabOrder:
    payload = LabOrderCreateRequest(
        patient_nhs_healthcare_id=patient_nhs_healthcare_id,
        test_description=test_description,
    )
    return await create_lab_order(db, specialist_user, payload)


async def specialist_add_medication(
    db: AsyncSession,
    specialist_user: User,
    patient_nhs_healthcare_id: str,
    medicine_name: str,
    dosage_instruction: str,
) -> MedicationOrder:
    payload = MedicationCreateRequest(
        patient_nhs_healthcare_id=patient_nhs_healthcare_id,
        medicine_name=medicine_name,
        dosage_instruction=dosage_instruction,
    )
    return await prescribe_medication(db, specialist_user, payload)
