from pydantic import BaseModel


class DispenseMedicationRequest(BaseModel):
    medication_id: str


class MedicationOrderResponse(BaseModel):
    id: str
    patient_user_id: str
    prescribed_by_user_id: str
    medicine_name: str
    dosage_instruction: str
    status: str
