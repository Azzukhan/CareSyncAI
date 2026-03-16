from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.deps import DbSession, require_roles
from app.models import User, UserRole
from app.modules.pharmacy.schemas import DispenseMedicationRequest, MedicationOrderResponse
from app.modules.pharmacy.service import list_medication_orders, mark_dispensed

router = APIRouter(prefix="/pharmacy", tags=["pharmacy"])


@router.get("/medications")
async def list_medications(
    db: DbSession,
    _: Annotated[User, Depends(require_roles(UserRole.PHARMACY))],
) -> dict:
    data = await list_medication_orders(db)
    items = [MedicationOrderResponse.model_validate(item, from_attributes=True) for item in data]
    return {"items": items}


@router.post("/medications/dispense")
async def dispense(
    payload: DispenseMedicationRequest,
    db: DbSession,
    _: Annotated[User, Depends(require_roles(UserRole.PHARMACY))],
) -> dict:
    item = await mark_dispensed(db, payload.medication_id)
    return {"message": "Medication dispensed", "medication_id": item.id}
