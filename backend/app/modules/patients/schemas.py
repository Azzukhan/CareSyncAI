import enum
from datetime import datetime

from pydantic import BaseModel


class HistoryRecordSource(str, enum.Enum):
    GP_VISIT = "gp_visit"
    SPECIALIST_REFERRAL = "specialist_referral"
    LAB_REPORT = "lab_report"
    MEDICATION_ORDER = "medication_order"


class PatientSummaryResponse(BaseModel):
    user_id: str
    nhs_healthcare_id: str
    full_name: str
    email: str
    date_of_birth: str | None
    phone_number: str | None
    address: str | None
    blood_group: str | None
    allergies: list[str]
    chronic_conditions: list[str]


class PatientProfileUpsertRequest(BaseModel):
    date_of_birth: str | None = None
    phone_number: str | None = None
    address: str | None = None
    blood_group: str | None = None
    allergies: str | None = None
    chronic_conditions: str | None = None


class PatientProfileResponse(PatientProfileUpsertRequest):
    id: str
    user_id: str


class VisitResponse(BaseModel):
    id: str
    source_kind: HistoryRecordSource
    patient_user_id: str
    provider_user_id: str
    provider_name: str
    provider_role: str
    record_type: str
    notes: str
    is_hidden_by_patient: bool
    shared_with_gp: bool
    shared_with_specialist: bool
    created_at: datetime


class LabReportResponse(BaseModel):
    id: str
    lab_order_id: str
    test_description: str
    ordered_by_name: str
    status: str
    report_summary: str
    file_url: str | None
    shared_with_gp: bool
    shared_with_specialist: bool
    created_at: datetime


class MedicationResponse(BaseModel):
    id: str
    patient_user_id: str
    prescribed_by_user_id: str
    prescribed_by_name: str
    medicine_name: str
    dosage_instruction: str
    status: str
    shared_with_gp: bool
    shared_with_specialist: bool
    created_at: datetime


class DashboardResponse(BaseModel):
    patient: PatientSummaryResponse
    qr_payload: str
    visits: list[VisitResponse]
    lab_reports: list[LabReportResponse]
    medications: list[MedicationResponse]


class UpdateHistoryAccessRequest(BaseModel):
    is_hidden_by_patient: bool | None = None
    shared_with_gp: bool | None = None
    shared_with_specialist: bool | None = None


class HistoryAccessResponse(BaseModel):
    record_id: str
    record_source: HistoryRecordSource
    is_hidden_by_patient: bool | None = None
    shared_with_gp: bool
    shared_with_specialist: bool


class BulkHistoryAccessRequest(BaseModel):
    shared_with_gp: bool | None = None
    shared_with_specialist: bool | None = None


class BulkHistoryAccessResponse(BaseModel):
    updated_records: int


class UpdateVisitVisibilityRequest(BaseModel):
    is_hidden_by_patient: bool
