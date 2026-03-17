import logging
from datetime import date, timedelta

from openai import AsyncOpenAI
from pydantic import BaseModel, Field

from app.core.config import get_settings
from app.models import AgentPreferredPanel

logger = logging.getLogger(__name__)


class MedicalStructuredResponse(BaseModel):
    summary: str
    highlights: list[str] = Field(default_factory=list)
    suggested_follow_ups: list[str] = Field(default_factory=list)
    preferred_panel: AgentPreferredPanel = AgentPreferredPanel.SUMMARY


class ExerciseStructuredItem(BaseModel):
    title: str
    scheduled_day: str
    target_time: str | None = None
    duration_minutes: int = 30
    intensity: str = "moderate"
    instructions: str | None = None
    details: list[str] = Field(default_factory=list)


class ExerciseStructuredResponse(BaseModel):
    summary: str
    highlights: list[str] = Field(default_factory=list)
    suggested_follow_ups: list[str] = Field(default_factory=list)
    preferred_panel: AgentPreferredPanel = AgentPreferredPanel.PLAN
    plan_title: str = "Exercise Plan"
    start_date: date
    end_date: date
    items: list[ExerciseStructuredItem] = Field(default_factory=list)


class DietStructuredItem(BaseModel):
    title: str
    meal_slot: str
    scheduled_day: str
    target_time: str | None = None
    calories: float | None = None
    protein_g: float | None = None
    carbs_g: float | None = None
    fat_g: float | None = None
    instructions: str | None = None
    details: list[str] = Field(default_factory=list)


class DietStructuredResponse(BaseModel):
    summary: str
    highlights: list[str] = Field(default_factory=list)
    suggested_follow_ups: list[str] = Field(default_factory=list)
    preferred_panel: AgentPreferredPanel = AgentPreferredPanel.PLAN
    plan_title: str = "Diet Plan"
    start_date: date
    end_date: date
    items: list[DietStructuredItem] = Field(default_factory=list)


class AgenticLLMService:
    def __init__(self) -> None:
        self._settings = get_settings()
        self._client = (
            AsyncOpenAI(api_key=self._settings.openai_api_key)
            if self._settings.openai_api_key
            else None
        )

    async def run_medical(
        self,
        *,
        user_id: str,
        prompt: str,
        context_messages: list[dict[str, str]],
        context_snapshot: str,
    ) -> MedicalStructuredResponse:
        if not self._client:
            return _fallback_medical(prompt)

        instructions = (
            "You are CareSyncAI Medical, a concise healthcare support assistant.\n"
            f"Today is {date.today().isoformat()}.\n"
            "Use the supplied patient context and active care plans.\n"
            "If lab reports are present in context, analyze their summaries carefully and explain what the patient may want to improve or discuss with a clinician.\n"
            "If exact values, units, or reference ranges are missing, say that explicitly instead of over-claiming.\n"
            "Do not diagnose, prescribe new medication, or expose hidden/private data.\n"
            "Ask follow-up questions when details are missing.\n"
            "Prefer actionable self-management guidance, safety cautions, and plan-aware coaching.\n"
            "Output structured JSON matching the schema.\n"
            f"Patient context:\n{context_snapshot}"
        )
        return await self._parse(
            user_id=user_id,
            prompt=prompt,
            context_messages=context_messages,
            instructions=instructions,
            response_type=MedicalStructuredResponse,
        )

    async def run_exercise(
        self,
        *,
        user_id: str,
        prompt: str,
        context_messages: list[dict[str, str]],
        context_snapshot: str,
    ) -> ExerciseStructuredResponse:
        if not self._client:
            return _fallback_exercise(prompt)

        instructions = (
            "You are CareSyncAI Exercise, a medically-aware exercise planner.\n"
            f"Today is {date.today().isoformat()}.\n"
            "Use the supplied patient context, current exercise plan, and adherence details.\n"
            "Always account for pain, mobility limits, motivation, available time, and missed sessions.\n"
            "Return a revised weekly exercise plan when the user asks for planning or changes.\n"
            "Keep exercise names clear, durations realistic, and instructions short.\n"
            "Output structured JSON matching the schema.\n"
            f"Patient context:\n{context_snapshot}"
        )
        return await self._parse(
            user_id=user_id,
            prompt=prompt,
            context_messages=context_messages,
            instructions=instructions,
            response_type=ExerciseStructuredResponse,
        )

    async def run_diet(
        self,
        *,
        user_id: str,
        prompt: str,
        context_messages: list[dict[str, str]],
        context_snapshot: str,
    ) -> DietStructuredResponse:
        if not self._client:
            return _fallback_diet(prompt)

        instructions = (
            "You are CareSyncAI Diet, a medically-aware meal planning assistant.\n"
            f"Today is {date.today().isoformat()}.\n"
            "Use the supplied patient context, current diet plan, allergies, and adherence details.\n"
            "Always respect allergies, dietary constraints, and schedule preferences.\n"
            "Return a revised weekly meal plan when the user asks for planning or changes.\n"
            "Keep meals practical and explain why they fit the patient's goals.\n"
            "Output structured JSON matching the schema.\n"
            f"Patient context:\n{context_snapshot}"
        )
        return await self._parse(
            user_id=user_id,
            prompt=prompt,
            context_messages=context_messages,
            instructions=instructions,
            response_type=DietStructuredResponse,
        )

    async def _parse(
        self,
        *,
        user_id: str,
        prompt: str,
        context_messages: list[dict[str, str]],
        instructions: str,
        response_type: type[BaseModel],
    ) -> BaseModel:
        assert self._client is not None
        input_items = [
            {"role": item["role"], "content": item["content"]}
            for item in context_messages
            if item.get("role") in {"user", "assistant"} and item.get("content")
        ]
        input_items.append({"role": "user", "content": prompt})

        try:
            response = await self._client.responses.parse(
                model=self._settings.openai_model,
                input=input_items,
                instructions=instructions,
                text_format=response_type,
                store=False,
                temperature=0.3,
                truncation="auto",
                safety_identifier=user_id,
            )
        except Exception:
            logger.exception("OpenAI Responses API call failed")
            return _fallback_for_type(response_type, prompt)

        parsed = response.output_parsed
        if parsed is None:
            logger.warning("OpenAI returned no parsed output")
            return _fallback_for_type(response_type, prompt)
        return parsed


def _fallback_for_type(response_type: type[BaseModel], prompt: str) -> BaseModel:
    if response_type is MedicalStructuredResponse:
        return _fallback_medical(prompt)
    if response_type is ExerciseStructuredResponse:
        return _fallback_exercise(prompt)
    return _fallback_diet(prompt)


def _fallback_medical(prompt: str) -> MedicalStructuredResponse:
    return MedicalStructuredResponse(
        summary=(
            f"I've noted your question about '{prompt}'. Share symptoms, timing, pain, "
            "or recent changes and I can help you think through safe next steps."
        ),
        highlights=[
            "I can comment on your current exercise and diet plans.",
            "I will avoid hidden records and unshared data.",
            "If symptoms feel urgent or severe, contact a clinician promptly.",
        ],
        suggested_follow_ups=[
            "Summarize my current exercise and diet routine",
            "What details should I track before speaking to a GP?",
            "How might my current routine affect how I feel?",
        ],
        preferred_panel=AgentPreferredPanel.SUMMARY,
    )


def _fallback_exercise(prompt: str) -> ExerciseStructuredResponse:
    today = date.today()
    return ExerciseStructuredResponse(
        summary=(
            f"I created a starter exercise plan based on '{prompt}'. Tell me about pain, "
            "equipment, missed sessions, or energy levels and I can refine it."
        ),
        highlights=[
            "Low-impact sessions are safer as a baseline.",
            "Recovery and mobility work are included.",
            "Use check-ins to improve tomorrow's recommendations.",
        ],
        suggested_follow_ups=[
            "Change Wednesday to a lighter session",
            "I had knee pain yesterday",
            "Make the plan 20 minutes per session",
        ],
        plan_title="Weekly Exercise Reset",
        start_date=today,
        end_date=today + timedelta(days=6),
        items=[
            ExerciseStructuredItem(
                title="Mobility and Stretching",
                scheduled_day="monday",
                target_time="07:30",
                duration_minutes=20,
                intensity="low",
                instructions="Gentle full-body mobility with breathing work.",
                details=["Warm up for 5 minutes", "Stop if sharp pain appears"],
            ),
            ExerciseStructuredItem(
                title="Brisk Walk",
                scheduled_day="wednesday",
                target_time="18:00",
                duration_minutes=30,
                intensity="moderate",
                instructions="Steady walking pace with posture focus.",
                details=["Optional light hills", "Log pain and energy after session"],
            ),
            ExerciseStructuredItem(
                title="Bodyweight Strength",
                scheduled_day="friday",
                target_time="07:30",
                duration_minutes=25,
                intensity="moderate",
                instructions="Chair squats, wall push-ups, and band rows if available.",
                details=["Rest as needed", "Reduce reps if fatigue rises"],
            ),
        ],
    )


def _fallback_diet(prompt: str) -> DietStructuredResponse:
    today = date.today()
    weekday_names = [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
    ]
    items: list[DietStructuredItem] = []
    for index, weekday in enumerate(weekday_names):
        items.extend(
            [
                DietStructuredItem(
                    title="Greek yogurt, berries, and oats",
                    meal_slot="breakfast",
                    scheduled_day=weekday,
                    target_time="08:00",
                    calories=360,
                    protein_g=24,
                    carbs_g=42,
                    fat_g=9,
                    instructions="Adjust dairy choice if needed for tolerance or allergy.",
                    details=["Add seeds for fiber", "Drink water with breakfast"],
                ),
                DietStructuredItem(
                    title="Chicken, rice, and mixed vegetables",
                    meal_slot="lunch",
                    scheduled_day=weekday,
                    target_time="13:00",
                    calories=540,
                    protein_g=38,
                    carbs_g=56,
                    fat_g=14,
                    instructions="Swap protein source based on dietary preference.",
                    details=["Keep portion moderate", "Use lower-sodium seasoning"],
                ),
                DietStructuredItem(
                    title="Salmon, potatoes, and greens",
                    meal_slot="dinner",
                    scheduled_day=weekday,
                    target_time="19:00",
                    calories=610,
                    protein_g=36,
                    carbs_g=48,
                    fat_g=24,
                    instructions="Use an alternative protein if fish is unsuitable.",
                    details=["Plate vegetables first", "Log fullness after dinner"],
                ),
            ]
        )
        if index >= 2:
            break

    return DietStructuredResponse(
        summary=(
            f"I created a starter diet plan based on '{prompt}'. Tell me what you skipped, "
            "what caused cravings, or any allergies so I can improve it."
        ),
        highlights=[
            "Meals are balanced around protein, fiber, and consistent timing.",
            "You can edit single meals without replacing the whole plan.",
            "Yesterday's adherence can be used to revise future meals.",
        ],
        suggested_follow_ups=[
            "Replace one dinner with a vegetarian option",
            "I skipped breakfast yesterday",
            "Reduce calories and add a higher-protein lunch",
        ],
        plan_title="Weekly Diet Reset",
        start_date=today,
        end_date=today + timedelta(days=6),
        items=items,
    )


agentic_llm_service = AgenticLLMService()
