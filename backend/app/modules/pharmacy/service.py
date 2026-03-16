from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import MedicationOrder


async def list_medication_orders(db: AsyncSession) -> list[MedicationOrder]:
    result = await db.scalars(select(MedicationOrder).order_by(MedicationOrder.created_at.desc()))
    return list(result.all())


async def mark_dispensed(db: AsyncSession, medication_id: str) -> MedicationOrder:
    medication = await db.scalar(select(MedicationOrder).where(MedicationOrder.id == medication_id))
    if not medication:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Medication not found")

    medication.status = "dispensed"
    await db.commit()
    await db.refresh(medication)
    return medication
