from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, UploadFile

from app.api.deps import DbSession, require_roles
from app.models import User, UserRole
from app.modules.lab.schemas import LabOrderResponse
from app.modules.lab.service import list_lab_orders, upload_lab_report

router = APIRouter(prefix="/lab", tags=["lab"])


@router.get("/orders")
async def orders(
    db: DbSession,
    _: Annotated[User, Depends(require_roles(UserRole.LAB))],
) -> dict:
    data = await list_lab_orders(db)
    items = [LabOrderResponse.model_validate(item, from_attributes=True) for item in data]
    return {"items": items}


@router.post("/reports")
async def upload_report(
    lab_order_id: Annotated[str, Form()],
    report_summary: Annotated[str, Form()],
    db: DbSession,
    current_user: Annotated[User, Depends(require_roles(UserRole.LAB))],
    report_file: UploadFile | None = File(default=None),
) -> dict:
    report = await upload_lab_report(
        db,
        current_user,
        lab_order_id=lab_order_id,
        report_summary=report_summary,
        report_file=report_file,
    )
    return {"message": "Report uploaded", "report_id": report.id}
