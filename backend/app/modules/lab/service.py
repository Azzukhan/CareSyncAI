from fastapi import HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.storage import save_lab_report_file
from app.models import LabOrder, LabReport, User


async def upload_lab_report(
    db: AsyncSession,
    lab_user: User,
    *,
    lab_order_id: str,
    report_summary: str,
    report_file: UploadFile | None,
) -> LabReport:
    order = await db.scalar(select(LabOrder).where(LabOrder.id == lab_order_id))
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lab order not found")

    stored_file_url = await save_lab_report_file(report_file) if report_file else None
    report = LabReport(
        lab_order_id=lab_order_id,
        uploaded_by_user_id=lab_user.id,
        report_summary=report_summary,
        file_url=stored_file_url,
    )
    order.status = "completed"
    db.add(report)
    await db.commit()
    await db.refresh(report)
    return report


async def list_lab_orders(db: AsyncSession) -> list[LabOrder]:
    result = await db.scalars(select(LabOrder).order_by(LabOrder.created_at.desc()))
    return list(result.all())
