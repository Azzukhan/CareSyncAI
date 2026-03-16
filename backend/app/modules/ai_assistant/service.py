"""AI assistant service with 3 dedicated models: Health Chat, Exercise Planner, Diet Planner."""

import json
from datetime import date

from fastapi import HTTPException, status
from openai import APIError, AsyncOpenAI, AuthenticationError, RateLimitError
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models import (
    ChatMessage,
    DietPlan,
    ExerciseSchedule,
    HealthMetric,
    MedicationOrder,
    PatientProfile,
    User,
)

# ── Dedicated System Prompts ────────────────────────────────────────

def _health_chat_prompt() -> str:
    return f"""You are CareSync Health Assistant — a professional, empathetic AI health advisor.
Today's date is {date.today().isoformat()}.

STRICT RULES you MUST follow without exception:
1. ONLY discuss health, wellness, exercise, nutrition, and medical-information topics.
2. NEVER recommend, prescribe, or suggest any medication the user has NOT explicitly shared with you. You may only reference medications the user is currently taking.
3. You may provide GENERAL information about medications the user asks about — ALWAYS cite a valid source URL:
   • NHS: https://www.nhs.uk
   • WHO: https://www.who.int
   • Mayo Clinic: https://www.mayoclinic.org
   • WebMD: https://www.webmd.com
   • MedlinePlus: https://medlineplus.gov
4. NEVER diagnose conditions — always recommend consulting a qualified healthcare professional.
5. If asked about NON-HEALTH topics, politely decline: "I'm your health assistant — I can only help with health and wellness topics."
6. Be empathetic, concise, and encouraging.
7. Use markdown formatting: **bold** for key terms, bullet points for lists, ### for section headers.
8. When discussing exercises or diet, include estimated duration/calories where relevant.
9. Consider the user's medical conditions, allergies, and current medications when giving any advice.
10. End responses with a supportive note or relevant follow-up question to encourage engagement."""


def _exercise_planner_prompt() -> str:
    return f"""You are CareSync Exercise Planner — an AI-powered fitness coach specializing in medically-aware exercise programming.
Today's date is {date.today().isoformat()}.

YOUR ROLE:
- Create personalized, safe weekly exercise schedules based on the user's medical history, current fitness level, and goals.
- You MUST consider the user's chronic conditions, allergies, medications, and physical limitations.
- Start conservatively for beginners or users with medical conditions, then progressively increase intensity.

STRICT RULES:
1. NEVER suggest exercises that conflict with the user's medical conditions (e.g., no high-impact for joint problems, no intense cardio for heart conditions without doctor approval).
2. Include warm-up and cool-down recommendations.
3. Vary exercise types: cardio, strength, flexibility, balance.
4. For each exercise, provide: name, duration (minutes), intensity (low/moderate/high), and practical notes.
5. Always recommend consulting a doctor before starting any new exercise program, especially with medical conditions.
6. If the user has conditions you're concerned about, flag them and suggest modifications.

OUTPUT FORMAT — respond ONLY in valid JSON:
{{
  "exercises": [
    {{"day": "monday", "exercise_name": "...", "duration_minutes": 30, "intensity": "low", "notes": "..."}},
    ...
  ],
  "summary": "A 2-3 sentence summary explaining why these exercises suit the user's profile.",
  "safety_notes": "Any medical precautions or warnings relevant to this user.",
  "progression_tips": "How to gradually increase intensity over the coming weeks."
}}"""


def _diet_planner_prompt() -> str:
    return f"""You are CareSync Diet Planner — an AI-powered nutritionist specializing in medically-aware meal planning.
Today's date is {date.today().isoformat()}.

YOUR ROLE:
- Create personalized daily meal plans considering the user's medical history, allergies, dietary restrictions, and calorie targets.
- Balance macronutrients (protein, carbs, fat) according to health guidelines and any condition-specific needs.
- Suggest practical, accessible meals with common ingredients.

STRICT RULES:
1. NEVER include foods the user is allergic to.
2. Respect all dietary restrictions (vegetarian, vegan, gluten-free, halal, kosher, etc.).
3. For diabetic users, focus on low-glycemic foods and balanced blood sugar management.
4. For heart condition users, limit saturated fat and sodium.
5. Include hydration recommendations.
6. Provide approximate macro breakdown for each meal.
7. Suggest realistic portion sizes.

OUTPUT FORMAT — respond ONLY in valid JSON:
{{
  "meals": [
    {{"meal_type": "breakfast", "food_items": "Descriptive meal with portions", "calories": 350, "protein_g": 15, "carbs_g": 45, "fat_g": 10, "notes": "Why this meal suits the user"}},
    ...
  ],
  "summary": "A 2-3 sentence nutritional rationale for the plan.",
  "hydration_tip": "Daily water intake recommendation.",
  "important_notes": "Any dietary warnings or medical considerations."
}}"""


# ── User Context Builder ────────────────────────────────────────────

def _build_user_context(
    profile: PatientProfile | None,
    medications: list[MedicationOrder],
    recent_metrics: list[HealthMetric],
    exercise_schedules: list[ExerciseSchedule] | None = None,
    diet_plans: list[DietPlan] | None = None,
) -> str:
    """Build a rich context string from the user's medical history and data."""
    parts: list[str] = []

    if profile:
        if profile.chronic_conditions:
            parts.append(f"**Chronic conditions**: {profile.chronic_conditions}")
        if profile.allergies:
            parts.append(f"**Allergies**: {profile.allergies}")
        if profile.blood_group:
            parts.append(f"**Blood group**: {profile.blood_group}")
        if profile.date_of_birth:
            age = (date.today() - profile.date_of_birth).days // 365
            parts.append(f"**Age**: {age} years (DOB: {profile.date_of_birth})")

    if medications:
        med_list = "\n".join(
            f"  - {m.medicine_name} ({m.dosage_instruction})" for m in medications
        )
        parts.append(f"**Current medications**:\n{med_list}")

    if recent_metrics:
        metric_lines = []
        for m in recent_metrics:
            metric_lines.append(f"  - {m.metric_type.value}: {m.value} {m.unit} (on {m.recorded_date})")
        parts.append("**Recent health metrics**:\n" + "\n".join(metric_lines))

    if exercise_schedules:
        ex_lines = []
        for ex in exercise_schedules:
            ex_lines.append(f"  - {ex.day_of_week}: {ex.exercise_name} ({ex.duration_minutes} min, {ex.intensity})")
        parts.append("**Current exercise schedule**:\n" + "\n".join(ex_lines))

    if diet_plans:
        diet_lines = []
        for dp in diet_plans:
            diet_lines.append(f"  - {dp.meal_type}: {dp.food_items} ({dp.calories} kcal)")
        parts.append("**Current diet plan**:\n" + "\n".join(diet_lines))

    if not parts:
        return "No medical history or health data available."

    return "\n\n".join(parts)


async def get_user_context(
    db: AsyncSession,
    user: User,
    include_exercise: bool = False,
    include_diet: bool = False,
) -> str:
    """Fetch user profile, medications, metrics, and optionally exercise/diet data."""
    profile = await db.scalar(
        select(PatientProfile).where(PatientProfile.user_id == user.id)
    )
    med_rows = await db.execute(
        select(MedicationOrder)
        .where(MedicationOrder.patient_user_id == user.id)
        .order_by(MedicationOrder.created_at.desc())
        .limit(20)
    )
    medications = list(med_rows.scalars().all())

    metric_rows = await db.execute(
        select(HealthMetric)
        .where(HealthMetric.user_id == user.id)
        .order_by(HealthMetric.recorded_date.desc())
        .limit(30)
    )
    recent_metrics = list(metric_rows.scalars().all())

    exercise_schedules = None
    if include_exercise:
        ex_rows = await db.execute(
            select(ExerciseSchedule).where(
                ExerciseSchedule.user_id == user.id,
                ExerciseSchedule.is_active.is_(True),
            )
        )
        exercise_schedules = list(ex_rows.scalars().all())

    diet_plans_list = None
    if include_diet:
        diet_rows = await db.execute(
            select(DietPlan).where(
                DietPlan.user_id == user.id,
                DietPlan.is_active.is_(True),
            )
        )
        diet_plans_list = list(diet_rows.scalars().all())

    return _build_user_context(profile, medications, recent_metrics, exercise_schedules, diet_plans_list)


# ── OpenAI Call Helper ──────────────────────────────────────────────

async def _call_openai(
    system_prompt: str,
    messages: list[dict[str, str]],
    *,
    max_tokens: int = 1500,
    json_mode: bool = False,
) -> str:
    """Centralised OpenAI call with error handling."""
    settings = get_settings()
    client = AsyncOpenAI(api_key=settings.openai_api_key)

    kwargs: dict = {
        "model": "gpt-4o-mini",
        "messages": [{"role": "system", "content": system_prompt}, *messages],
        "temperature": 0.7,
        "max_tokens": max_tokens,
    }
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}

    try:
        response = await client.chat.completions.create(**kwargs)
    except (AuthenticationError, RateLimitError, APIError) as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"AI service unavailable: {exc.message}",
        ) from exc

    return response.choices[0].message.content or ""


# ── Chat Service ────────────────────────────────────────────────────

async def send_chat_message(
    db: AsyncSession,
    user: User,
    message: str,
    include_medical_history: bool = True,
    include_medications: bool = True,
    include_health_metrics: bool = True,
) -> ChatMessage:
    """Send a message to the Health Chat assistant."""
    # Save user message
    user_msg = ChatMessage(user_id=user.id, role="user", content=message)
    db.add(user_msg)
    await db.flush()

    # Build selective context
    context_parts: list[str] = []
    if include_medical_history or include_medications or include_health_metrics:
        profile = await db.scalar(
            select(PatientProfile).where(PatientProfile.user_id == user.id)
        )
        if include_medical_history and profile:
            if profile.chronic_conditions:
                context_parts.append(f"Chronic conditions: {profile.chronic_conditions}")
            if profile.allergies:
                context_parts.append(f"Allergies: {profile.allergies}")
            if profile.blood_group:
                context_parts.append(f"Blood group: {profile.blood_group}")
            if profile.date_of_birth:
                age = (date.today() - profile.date_of_birth).days // 365
                context_parts.append(f"Age: {age} years")

        if include_medications:
            med_rows = await db.execute(
                select(MedicationOrder)
                .where(MedicationOrder.patient_user_id == user.id)
                .order_by(MedicationOrder.created_at.desc())
                .limit(20)
            )
            meds = list(med_rows.scalars().all())
            if meds:
                med_list = ", ".join(f"{m.medicine_name} ({m.dosage_instruction})" for m in meds)
                context_parts.append(f"Current medications: {med_list}")

        if include_health_metrics:
            metric_rows = await db.execute(
                select(HealthMetric)
                .where(HealthMetric.user_id == user.id)
                .order_by(HealthMetric.recorded_date.desc())
                .limit(15)
            )
            metrics = list(metric_rows.scalars().all())
            if metrics:
                metric_lines = [f"  - {m.metric_type.value}: {m.value} {m.unit} ({m.recorded_date})" for m in metrics]
                context_parts.append("Recent health metrics:\n" + "\n".join(metric_lines))

    user_context = "\n".join(context_parts) if context_parts else "No medical data shared."

    # Load chat history
    history_rows = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.user_id == user.id)
        .order_by(ChatMessage.created_at.desc())
        .limit(20)
    )
    history = list(reversed(list(history_rows.scalars().all())))

    prompt = _health_chat_prompt() + f"\n\nUSER MEDICAL CONTEXT:\n{user_context}"
    messages_list = [{"role": msg.role, "content": msg.content} for msg in history]

    assistant_content = await _call_openai(prompt, messages_list)
    if not assistant_content:
        assistant_content = "I'm sorry, I couldn't generate a response. Please try again."

    assistant_msg = ChatMessage(user_id=user.id, role="assistant", content=assistant_content)
    db.add(assistant_msg)
    await db.commit()
    await db.refresh(assistant_msg)
    return assistant_msg


async def get_chat_history(db: AsyncSession, user_id: str) -> list[ChatMessage]:
    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.user_id == user_id)
        .order_by(ChatMessage.created_at.asc())
    )
    return list(result.scalars().all())


async def clear_chat_history(db: AsyncSession, user_id: str) -> None:
    await db.execute(delete(ChatMessage).where(ChatMessage.user_id == user_id))
    await db.commit()


# ── Exercise Plan Service ───────────────────────────────────────────

async def generate_exercise_plan(
    db: AsyncSession,
    user: User,
    fitness_level: str,
    goals: str,
    available_days: list[str],
    session_duration_minutes: int,
) -> tuple[list[ExerciseSchedule], str]:
    """Generate a personalized exercise plan using the Exercise Planner model."""
    user_context = await get_user_context(db, user, include_exercise=True)

    prompt = f"""Create a personalized weekly exercise plan for this user.

USER MEDICAL CONTEXT:
{user_context}

PREFERENCES:
- Fitness level: {fitness_level}
- Goals: {goals or 'general fitness and wellbeing'}
- Available days: {', '.join(available_days)}
- Session duration: {session_duration_minutes} minutes per session
- Today's date: {date.today().isoformat()}

Generate a safe, effective plan. Consider ALL medical conditions listed above."""

    content = await _call_openai(
        _exercise_planner_prompt(),
        [{"role": "user", "content": prompt}],
        max_tokens=2000,
        json_mode=True,
    )

    data = json.loads(content) if content else {}
    exercises_data = data.get("exercises", [])
    summary_parts: list[str] = []
    if data.get("summary"):
        summary_parts.append(str(data["summary"]))
    if data.get("safety_notes"):
        summary_parts.append(f"⚠️ Safety: {data['safety_notes']}")
    if data.get("progression_tips"):
        summary_parts.append(f"📈 Progression: {data['progression_tips']}")
    summary = "\n\n".join(summary_parts)

    # Replace old schedule
    await db.execute(
        delete(ExerciseSchedule).where(ExerciseSchedule.user_id == user.id)
    )

    schedules: list[ExerciseSchedule] = []
    for ex in exercises_data:
        schedule = ExerciseSchedule(
            user_id=user.id,
            day_of_week=ex.get("day", "monday"),
            exercise_name=ex.get("exercise_name", "Exercise"),
            duration_minutes=ex.get("duration_minutes", session_duration_minutes),
            intensity=ex.get("intensity", "moderate"),
            notes=ex.get("notes"),
            is_active=True,
        )
        db.add(schedule)
        schedules.append(schedule)

    await db.commit()
    for s in schedules:
        await db.refresh(s)

    return schedules, summary


# ── Diet Plan Service ───────────────────────────────────────────────

async def generate_diet_plan(
    db: AsyncSession,
    user: User,
    dietary_restrictions: list[str],
    target_calories: int,
    meals_per_day: int,
    include_snacks: bool,
) -> tuple[list[DietPlan], str]:
    """Generate a personalized diet plan using the Diet Planner model."""
    user_context = await get_user_context(db, user, include_diet=True)

    prompt = f"""Create a personalized daily diet plan for this user.

USER MEDICAL CONTEXT:
{user_context}

PREFERENCES:
- Dietary restrictions: {', '.join(dietary_restrictions) if dietary_restrictions else 'None'}
- Target calories: {target_calories} kcal per day
- Meals per day: {meals_per_day}
- Include snacks: {'yes' if include_snacks else 'no'}
- Today's date: {date.today().isoformat()}

Generate a nutritionally balanced plan. Account for ALL allergies and conditions listed above."""

    content = await _call_openai(
        _diet_planner_prompt(),
        [{"role": "user", "content": prompt}],
        max_tokens=2000,
        json_mode=True,
    )

    data = json.loads(content) if content else {}
    meals_data = data.get("meals", [])
    summary_parts: list[str] = []
    if data.get("summary"):
        summary_parts.append(str(data["summary"]))
    if data.get("hydration_tip"):
        summary_parts.append(f"💧 Hydration: {data['hydration_tip']}")
    if data.get("important_notes"):
        summary_parts.append(f"⚠️ Important: {data['important_notes']}")
    summary = "\n\n".join(summary_parts)

    # Replace old diet plan
    await db.execute(delete(DietPlan).where(DietPlan.user_id == user.id))

    plans: list[DietPlan] = []
    for meal in meals_data:
        plan = DietPlan(
            user_id=user.id,
            meal_type=meal.get("meal_type", "lunch"),
            food_items=meal.get("food_items", ""),
            calories=float(meal.get("calories", 0)),
            protein_g=float(meal.get("protein_g", 0)),
            carbs_g=float(meal.get("carbs_g", 0)),
            fat_g=float(meal.get("fat_g", 0)),
            notes=meal.get("notes"),
            is_active=True,
        )
        db.add(plan)
        plans.append(plan)

    await db.commit()
    for p in plans:
        await db.refresh(p)

    return plans, summary
