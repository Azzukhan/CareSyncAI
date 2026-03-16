from pydantic import BaseModel


class SpecialistReferralCreateRequest(BaseModel):
    patient_nhs_healthcare_id: str
    specialist_notes: str


class SpecialistLabOrderRequest(BaseModel):
    patient_nhs_healthcare_id: str
    test_description: str


class SpecialistMedicationRequest(BaseModel):
    patient_nhs_healthcare_id: str
    medicine_name: str
    dosage_instruction: str
