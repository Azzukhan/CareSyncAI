from datetime import datetime

from pydantic import BaseModel


class ChatMessageRequest(BaseModel):
    message: str
    include_medical_history: bool = True
    include_medications: bool = True
    include_health_metrics: bool = True


class ChatMessageResponse(BaseModel):
    id: str
    role: str
    content: str
    created_at: datetime


class ChatHistoryResponse(BaseModel):
    messages: list[ChatMessageResponse]


class ExercisePlanRequest(BaseModel):
    fitness_level: str = "beginner"  # beginner, intermediate, advanced
    goals: str = ""  # e.g. "weight loss", "muscle gain", "general fitness"
    available_days: list[str] = ["monday", "tuesday", "wednesday", "thursday", "friday"]
    session_duration_minutes: int = 30


class ExerciseItemResponse(BaseModel):
    id: str
    day_of_week: str
    exercise_name: str
    duration_minutes: int
    intensity: str
    notes: str | None = None


class ExercisePlanResponse(BaseModel):
    items: list[ExerciseItemResponse]
    ai_summary: str = ""


class DietPlanRequest(BaseModel):
    dietary_restrictions: list[str] = []  # vegetarian, vegan, gluten-free, etc.
    target_calories: int = 2000
    meals_per_day: int = 3
    include_snacks: bool = True


class DietMealResponse(BaseModel):
    id: str
    meal_type: str
    food_items: str
    calories: float
    protein_g: float
    carbs_g: float
    fat_g: float
    notes: str | None = None


class DietPlanResponse(BaseModel):
    items: list[DietMealResponse]
    total_calories: float = 0.0
    ai_summary: str = ""
