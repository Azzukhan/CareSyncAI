from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.deps import DbSession, require_roles
from app.models import User, UserRole
from app.modules.gp.schemas import (
    GPDashboardResponse,
    GPVisitCreateRequest,
    LabOrderCreateRequest,
    MedicationCreateRequest,
    ReferralCreateRequest,
)
from app.modules.gp.service import (
    create_gp_visit,
    create_lab_order,
    create_specialist_referral,
    gp_dashboard_stats,
    prescribe_medication,
)

router = APIRouter(prefix="/gp", tags=["gp"])


@router.get("/dashboard", response_model=GPDashboardResponse)
async def dashboard(
    db: DbSession,
    current_user: Annotated[User, Depends(require_roles(UserRole.GP))],
) -> GPDashboardResponse:
    stats = await gp_dashboard_stats(db, current_user.id)
    return GPDashboardResponse.model_validate(stats)


@router.post("/visits")
async def add_visit(
    payload: GPVisitCreateRequest,
    db: DbSession,
    current_user: Annotated[User, Depends(require_roles(UserRole.GP))],
) -> dict:
    visit = await create_gp_visit(db, current_user, payload)
    return {"message": "Visit saved", "visit_id": visit.id}


@router.post("/referrals/specialist")
async def refer_specialist(
    payload: ReferralCreateRequest,
    db: DbSession,
    current_user: Annotated[User, Depends(require_roles(UserRole.GP))],
) -> dict:
    referral = await create_specialist_referral(db, current_user, payload)
    return {"message": "Specialist referral created", "referral_id": referral.id}


@router.post("/referrals/lab")
async def refer_lab(
    payload: LabOrderCreateRequest,
    db: DbSession,
    current_user: Annotated[User, Depends(require_roles(UserRole.GP))],
) -> dict:
    order = await create_lab_order(db, current_user, payload)
    return {"message": "Lab order created", "lab_order_id": order.id}


@router.post("/medications")
async def add_medication(
    payload: MedicationCreateRequest,
    db: DbSession,
    current_user: Annotated[User, Depends(require_roles(UserRole.GP))],
) -> dict:
    medication = await prescribe_medication(db, current_user, payload)
    return {"message": "Medication added", "medication_id": medication.id}
