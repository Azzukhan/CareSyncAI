import logging
import re
from collections import Counter
from datetime import date, timedelta
from typing import TypeVar

from openai import AsyncOpenAI
from pydantic import BaseModel, Field

from app.core.config import get_settings
from app.models import AgentPreferredPanel

logger = logging.getLogger(__name__)
DAY_COUNT_PATTERN = re.compile(r"\b(\d{1,3})\s*[- ]?day(?:s)?\b", re.IGNORECASE)
DAY_SEQUENCE_PATTERN = re.compile(r"\bday\s*([1-9]\d*)\b", re.IGNORECASE)
PLACEHOLDER_TEXT_PATTERN = re.compile(
    r"(repeat similar|similar structure|remaining days|same as above|and so on|etc\.?|continue similarly|\.\.\.)",
    re.IGNORECASE,
)


class IncompletePlanError(ValueError):
    pass


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


StructuredResponseT = TypeVar(
    "StructuredResponseT",
    MedicalStructuredResponse,
    ExerciseStructuredResponse,
    DietStructuredResponse,
)


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
            return _normalize_structured_response(_fallback_medical(prompt))

        instructions = (
            "You are CareSyncAI Medical, a concise healthcare support assistant.\n"
            f"Today is {date.today().isoformat()}.\n"
            "Use the supplied patient context and active care plans.\n"
            "Base the answer on the latest canonical activity data and on the exact values and dates provided in context.\n"
            "If synced activity data is present, use steps, active minutes, distance, sleep, and calorie patterns when answering questions about fitness, recovery, safe increases in activity, or symptom context.\n"
            "When both lab reports and activity data are present, connect them carefully and explain what to discuss with a clinician before recommending increases in training load.\n"
            "If lab reports are present in context, analyze their summaries carefully and explain what the patient may want to improve or discuss with a clinician.\n"
            "If exact values, units, or reference ranges are missing, say that explicitly instead of over-claiming.\n"
            "Do not call something a concern in the summary unless you explain it with actual data in the summary or highlights.\n"
            "If the context identifies Apple Health or Google Fitness as the source of truth for a date range, mention that source when it materially affects the answer.\n"
            "When mentioning sleep, include the recorded hours and compare them to the usual adult target of 7 to 9 hours if that metric is available.\n"
            "When asked about water or hydration, say clearly whether hydration is tracked. If it is not tracked, give a practical whole-day fluid estimate in liters or cups and explain that it is a general estimate, not a measured target.\n"
            "If the user asks for analysis, identify the top 2 to 4 useful findings and prioritize the most important gap instead of repeating similar points.\n"
            "Keep the summary short and specific. Highlights must add new information and must not restate the summary sentence.\n"
            "If hydration is not tracked, do not imply that you measured it.\n"
            "Avoid repeating the same numeric fact across the summary and highlights unless it is necessary for clarity.\n"
            "Do not diagnose, prescribe new medication, or expose hidden/private data.\n"
            "Ask follow-up questions when details are missing.\n"
            "Prefer actionable self-management guidance, safety cautions, and plan-aware coaching.\n"
            "Output structured JSON matching the schema.\n"
            f"Patient context:\n{context_snapshot}"
        )
        parsed = await self._parse(
            user_id=user_id,
            prompt=prompt,
            context_messages=context_messages,
            instructions=instructions,
            response_type=MedicalStructuredResponse,
        )
        return _normalize_structured_response(MedicalStructuredResponse.model_validate(parsed))

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
            "Use the supplied patient context, current exercise plan, adherence details, and any synced activity metrics.\n"
            "Always account for pain, mobility limits, motivation, available time, and missed sessions.\n"
            "If steps, active minutes, distance, calories, or sleep trends are available, use the exact values and dates to suggest realistic increases or reductions instead of generic exercise jumps.\n"
            "When activity source provenance is available, mention whether the recommendation is based on Apple Health or Google Fitness data when that helps explain the advice.\n"
            "If sleep is relevant, include the recorded hours explicitly.\n"
            "If the user asks about hydration but hydration is not tracked, say that clearly before giving general exercise hydration guidance.\n"
            "Return a revised weekly exercise plan when the user asks for planning or changes.\n"
            "Every exercise item must map to a real calendar day. Prefer monday through sunday in scheduled_day, or use Day 1, Day 2, and so on for consecutive multi-day plans.\n"
            "Keep exercise names clear, durations realistic, and instructions short.\n"
            "Do not repeat the same metric in both the summary and highlights unless needed for safety.\n"
            "Output structured JSON matching the schema.\n"
            f"Patient context:\n{context_snapshot}"
        )
        parsed = await self._parse(
            user_id=user_id,
            prompt=prompt,
            context_messages=context_messages,
            instructions=instructions,
            response_type=ExerciseStructuredResponse,
        )
        return _normalize_structured_response(ExerciseStructuredResponse.model_validate(parsed))

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
            "Use the supplied patient context, current diet plan, allergies, adherence details, and any synced activity metrics.\n"
            "Always respect allergies, dietary constraints, and schedule preferences.\n"
            "If activity data is present, use the exact values and dates when discussing energy balance, fueling, hydration, recovery, and meal timing.\n"
            "When activity source provenance is available, mention whether the recommendation is based on Apple Health or Google Fitness data when useful.\n"
            "If hydration is asked about and hydration is not tracked, say that clearly before giving general guidance.\n"
            "Return a revised weekly meal plan when the user asks for planning or changes.\n"
            "If the user asks for N days, start_date and end_date must cover exactly N calendar days inclusively.\n"
            "Every meal item must map to a real calendar day.\n"
            "For plans longer than 7 days, every item must use scheduled_day as Day 1, Day 2, Day 3, and so on. Do not rely on weekday names alone for long plans.\n"
            "If the user does not specify otherwise, provide breakfast, lunch, dinner, and a practical snack for each day.\n"
            "Do not use shorthand such as 'repeat similar structure', 'same as above', 'etc.', or summaries for remaining days. Output every day explicitly.\n"
            "Keep meals practical and explain why they fit the patient's goals.\n"
            "Do not repeat the same fact across summary and highlights.\n"
            "Output structured JSON matching the schema.\n"
            f"Patient context:\n{context_snapshot}"
        )
        parsed = await self._parse(
            user_id=user_id,
            prompt=prompt,
            context_messages=context_messages,
            instructions=instructions,
            response_type=DietStructuredResponse,
        )
        response = _normalize_structured_response(DietStructuredResponse.model_validate(parsed))
        feedback = _diet_response_validation_feedback(prompt, response)
        if feedback is None:
            return response

        logger.warning("Diet plan response was incomplete; retrying with stricter guidance: %s", feedback)
        retry_instructions = (
            instructions
            + "\nThe previous output was invalid for the following reasons:\n"
            + feedback
            + "\nReturn a complete replacement now. Every day must be explicit. Do not use placeholders or shorthand.\n"
        )
        retry_parsed = await self._parse(
            user_id=user_id,
            prompt=prompt,
            context_messages=context_messages,
            instructions=retry_instructions,
            response_type=DietStructuredResponse,
        )
        retry_response = _normalize_structured_response(
            DietStructuredResponse.model_validate(retry_parsed)
        )
        retry_feedback = _diet_response_validation_feedback(prompt, retry_response)
        if retry_feedback is None:
            return retry_response

        logger.warning("Diet plan response remained incomplete after retry: %s", retry_feedback)
        raise IncompletePlanError(
            "I couldn't generate a complete day-by-day diet plan yet. Ask again and I will rebuild it without shorthand like 'repeat similar structure'."
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
            f"I couldn't generate a structured exercise plan for '{prompt}' without the live AI planner. "
            "Ask again in a moment and I will sync the real plan into your calendar once it is available."
        ),
        highlights=[
            "No placeholder exercise sessions were inserted into your calendar.",
            "When the planner responds, the active exercise plan will replace the previous one automatically.",
            "You can still ask for lighter sessions, shorter durations, or injury-safe swaps.",
        ],
        suggested_follow_ups=[
            "Create a gentler plan for this week",
            "Shorten all sessions to 20 minutes",
            "Replace one session with a knee-safe option",
        ],
        plan_title="Exercise Plan Pending",
        start_date=today,
        end_date=today + timedelta(days=6),
        items=[],
    )


def _fallback_diet(prompt: str) -> DietStructuredResponse:
    today = date.today()

    return DietStructuredResponse(
        summary=(
            f"I couldn't generate a structured diet plan for '{prompt}' without the live AI planner. "
            "Ask again shortly and I will sync the real meal plan into your calendar once it is available."
        ),
        highlights=[
            "No placeholder meals were inserted into your calendar.",
            "When the planner responds, the active diet plan will replace the previous one automatically.",
            "You can still ask for simpler meals, time changes, or higher-protein swaps.",
        ],
        suggested_follow_ups=[
            "Create a simpler meal plan for this week",
            "Adjust meal timing for my work schedule",
            "Replace one dinner with a higher-protein option",
        ],
        plan_title="Diet Plan Pending",
        start_date=today,
        end_date=today + timedelta(days=6),
        items=[],
    )


agentic_llm_service = AgenticLLMService()


def _normalize_structured_response(response: StructuredResponseT) -> StructuredResponseT:
    normalized = response.model_copy(deep=True)
    normalized.summary = " ".join(normalized.summary.split())
    normalized.highlights = _dedupe_strings(normalized.highlights)
    normalized.suggested_follow_ups = _dedupe_strings(normalized.suggested_follow_ups)
    normalized.highlights = _dedupe_strings(normalized.highlights)[:4]
    normalized.suggested_follow_ups = normalized.suggested_follow_ups[:3]
    return normalized


def _dedupe_strings(items: list[str]) -> list[str]:
    deduped: list[str] = []
    seen: set[str] = set()
    for item in items:
        normalized = " ".join(item.split())
        if not normalized:
            continue
        key = normalized.lower()
        if key in seen:
            continue
        seen.add(key)
        deduped.append(normalized)
    return deduped


def _extract_requested_plan_days(prompt: str) -> int | None:
    match = DAY_COUNT_PATTERN.search(prompt)
    if match is None:
        return None
    requested_days = int(match.group(1))
    return requested_days if 1 <= requested_days <= 365 else None


def _plan_span_days(start_date: date, end_date: date) -> int:
    return max(1, (end_date - start_date).days + 1)


def _contains_placeholder_text(value: str | None) -> bool:
    if not value:
        return False
    return PLACEHOLDER_TEXT_PATTERN.search(" ".join(value.split())) is not None


def _weekday_to_date(label: str, *, start_date: date, span_days: int) -> date | None:
    weekday_names = [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
    ]
    lowered = label.strip().lower()
    if lowered not in weekday_names:
        return None
    if span_days > 7:
        return None
    target_weekday = weekday_names.index(lowered)
    for offset in range(span_days):
        candidate = start_date + timedelta(days=offset)
        if candidate.weekday() == target_weekday:
            return candidate
    return None


def _resolve_diet_item_date(item: DietStructuredItem, *, start_date: date, span_days: int) -> date | None:
    label = item.scheduled_day.strip()
    if not label:
        return None
    lowered = label.lower()
    if lowered == "today":
        return start_date
    if lowered == "tomorrow":
        return start_date + timedelta(days=1)
    if lowered == "day after tomorrow":
        return start_date + timedelta(days=2)
    try:
        return date.fromisoformat(label)
    except ValueError:
        pass
    match = DAY_SEQUENCE_PATTERN.search(lowered.replace("-", " "))
    if match is not None:
        offset = int(match.group(1)) - 1
        if offset < 0:
            return None
        return start_date + timedelta(days=offset)
    return _weekday_to_date(label, start_date=start_date, span_days=span_days)


def _diet_response_validation_feedback(
    prompt: str, response: DietStructuredResponse
) -> str | None:
    issues: list[str] = []
    requested_days = _extract_requested_plan_days(prompt)
    span_days = _plan_span_days(response.start_date, response.end_date)
    if requested_days is not None and span_days != requested_days:
        issues.append(
            f"The plan range spans {span_days} days, but the user asked for {requested_days} days."
        )

    placeholder_count = 0
    if _contains_placeholder_text(response.summary):
        placeholder_count += 1
    for item in response.items:
        if (
            _contains_placeholder_text(item.title)
            or _contains_placeholder_text(item.instructions)
            or any(_contains_placeholder_text(detail) for detail in item.details)
            or item.meal_slot.strip().lower() == "all"
        ):
            placeholder_count += 1
    if placeholder_count:
        issues.append(
            f"The plan contains {placeholder_count} placeholder or shorthand entries instead of explicit day-by-day meals."
        )

    counts_by_date: Counter[date] = Counter()
    unresolved_items = 0
    for item in response.items:
        resolved_date = _resolve_diet_item_date(
            item, start_date=response.start_date, span_days=span_days
        )
        if resolved_date is None:
            unresolved_items += 1
            continue
        counts_by_date[resolved_date] += 1

    if span_days > 7 and unresolved_items > 0:
        issues.append(
            f"{unresolved_items} meal items are missing explicit Day N or ISO date scheduling for a long plan."
        )

    non_zero_counts = [count for count in counts_by_date.values() if count > 0]
    expected_daily_count = (
        Counter(non_zero_counts).most_common(1)[0][0] if non_zero_counts else 0
    )
    minimum_daily_count = max(1, expected_daily_count - 1) if expected_daily_count else 1

    missing_days = 0
    underfilled_days = 0
    for offset in range(span_days):
        current_date = response.start_date + timedelta(days=offset)
        current_count = counts_by_date.get(current_date, 0)
        if current_count == 0:
            missing_days += 1
        elif current_count < minimum_daily_count:
            underfilled_days += 1

    if missing_days:
        issues.append(
            f"The plan leaves {missing_days} day(s) in the requested range without any meals."
        )
    if underfilled_days:
        issues.append(
            f"{underfilled_days} day(s) have too few explicit meals compared with the rest of the plan."
        )

    return " ".join(issues) if issues else None
