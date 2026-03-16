from pydantic import BaseModel


class LabOrderResponse(BaseModel):
    id: str
    patient_user_id: str
    requested_by_user_id: str
    test_description: str
    status: str
