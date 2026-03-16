from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.deps import DbSession, require_roles
from app.models import User, UserRole
from app.modules.ai_assistant.schemas import (
    ChatHistoryResponse,
    ChatMessageRequest,
    ChatMessageResponse,
    DietMealResponse,
    DietPlanRequest,
    DietPlanResponse,
    ExerciseItemResponse,
    ExercisePlanRequest,
    ExercisePlanResponse,
)
from app.modules.ai_assistant.service import (
    clear_chat_history,
    generate_diet_plan,
    generate_exercise_plan,
    get_chat_history,
    send_chat_message,
)

router = APIRouter(prefix="/ai", tags=["ai-assistant"])


@router.post("/chat", response_model=ChatMessageResponse)
async def chat(
    payload: ChatMessageRequest,
    db: DbSession,
    current_user: Annotated[User, Depends(require_roles(UserRole.PATIENT))],
) -> ChatMessageResponse:
    msg = await send_chat_message(
        db,
        current_user,
        payload.message,
        payload.include_medical_history,
        payload.include_medications,
        payload.include_health_metrics,
    )
    return ChatMessageResponse(
        id=msg.id,
        role=msg.role,
        content=msg.content,
        created_at=msg.created_at,
    )


@router.get("/chat/history", response_model=ChatHistoryResponse)
async def chat_history(
    db: DbSession,
    current_user: Annotated[User, Depends(require_roles(UserRole.PATIENT))],
) -> ChatHistoryResponse:
    messages = await get_chat_history(db, current_user.id)
    return ChatHistoryResponse(
        messages=[
            ChatMessageResponse(
                id=m.id, role=m.role, content=m.content, created_at=m.created_at
            )
            for m in messages
        ]
    )


@router.delete("/chat/history")
async def delete_chat_history(
    db: DbSession,
    current_user: Annotated[User, Depends(require_roles(UserRole.PATIENT))],
) -> dict[str, str]:
    await clear_chat_history(db, current_user.id)
    return {"message": "Chat history cleared"}


@router.post("/exercise-plan", response_model=ExercisePlanResponse)
async def create_exercise_plan(
    payload: ExercisePlanRequest,
    db: DbSession,
    current_user: Annotated[User, Depends(require_roles(UserRole.PATIENT))],
) -> ExercisePlanResponse:
    schedules, summary = await generate_exercise_plan(
        db,
        current_user,
        payload.fitness_level,
        payload.goals,
        payload.available_days,
        payload.session_duration_minutes,
    )
    return ExercisePlanResponse(
        items=[
            ExerciseItemResponse(
                id=s.id,
                day_of_week=s.day_of_week,
                exercise_name=s.exercise_name,
                duration_minutes=s.duration_minutes,
                intensity=s.intensity,
                notes=s.notes,
            )
            for s in schedules
        ],
        ai_summary=summary,
    )


@router.post("/diet-plan", response_model=DietPlanResponse)
async def create_diet_plan(
    payload: DietPlanRequest,
    db: DbSession,
    current_user: Annotated[User, Depends(require_roles(UserRole.PATIENT))],
) -> DietPlanResponse:
    plans, summary = await generate_diet_plan(
        db,
        current_user,
        payload.dietary_restrictions,
        payload.target_calories,
        payload.meals_per_day,
        payload.include_snacks,
    )
    return DietPlanResponse(
        items=[
            DietMealResponse(
                id=p.id,
                meal_type=p.meal_type,
                food_items=p.food_items,
                calories=p.calories,
                protein_g=p.protein_g,
                carbs_g=p.carbs_g,
                fat_g=p.fat_g,
                notes=p.notes,
            )
            for p in plans
        ],
        total_calories=sum(p.calories for p in plans),
        ai_summary=summary,
    )
