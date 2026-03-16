from fastapi import APIRouter

from app.modules.agentic.router import router as agentic_router
from app.modules.ai_assistant.router import router as ai_assistant_router
from app.modules.auth.router import router as auth_router
from app.modules.calendar.router import router as calendar_router
from app.modules.content.router import router as content_router
from app.modules.gp.router import router as gp_router
from app.modules.health_data.router import router as health_data_router
from app.modules.lab.router import router as lab_router
from app.modules.patients.router import router as patients_router
from app.modules.pharmacy.router import router as pharmacy_router
from app.modules.specialist.router import router as specialist_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(content_router)
api_router.include_router(patients_router)
api_router.include_router(gp_router)
api_router.include_router(specialist_router)
api_router.include_router(lab_router)
api_router.include_router(pharmacy_router)
api_router.include_router(health_data_router)
api_router.include_router(agentic_router)
api_router.include_router(ai_assistant_router)
api_router.include_router(calendar_router)
