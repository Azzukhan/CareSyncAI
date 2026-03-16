from fastapi import APIRouter

from app.modules.content.schemas import HealthTipResponse
from app.modules.content.service import list_health_tips

router = APIRouter(prefix="/content", tags=["content"])


@router.get("/health-tips", response_model=list[HealthTipResponse])
async def health_tips() -> list[HealthTipResponse]:
    return list_health_tips()
