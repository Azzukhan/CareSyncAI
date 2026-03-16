from datetime import datetime

from pydantic import BaseModel


class GPDashboardPatientResponse(BaseModel):
    nhs_healthcare_id: str
    full_name: str
    last_visit_at: datetime


class GPVisitCreateRequest(BaseModel):
    patient_nhs_healthcare_id: str
    notes: str


class ReferralCreateRequest(BaseModel):
    patient_nhs_healthcare_id: str
    specialist_notes: str


class LabOrderCreateRequest(BaseModel):
    patient_nhs_healthcare_id: str
    test_description: str


class MedicationCreateRequest(BaseModel):
    patient_nhs_healthcare_id: str
    medicine_name: str
    dosage_instruction: str


class GPDashboardResponse(BaseModel):
    gp_user_id: str
    todays_patient_count: int
    todays_visits: int
    recent_patients: list[GPDashboardPatientResponse]
    generated_at: datetime
