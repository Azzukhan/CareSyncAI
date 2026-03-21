from datetime import date, timedelta

import pytest

from app.modules.agentic.llm import (
    AgenticLLMService,
    DietStructuredItem,
    DietStructuredResponse,
    IncompletePlanError,
    MedicalStructuredResponse,
    _normalize_structured_response,
)


def test_normalize_structured_response_only_dedupes_and_trims() -> None:
    response = MedicalStructuredResponse(
        summary="  Review   your activity and sleep.  ",
        highlights=[
            "Sleep was lower than target.",
            "Sleep was lower than target.",
            "Steps were below your usual range.",
            "Active minutes were strong.",
            "Hydration is not tracked.",
            "Extra point that should be trimmed.",
        ],
        suggested_follow_ups=[
            "Review my steps and sleep together",
            "Review my steps and sleep together",
            "How much should I increase walking?",
            "Should I change my bedtime?",
        ],
    )

    normalized = _normalize_structured_response(response)

    assert normalized.summary == "Review your activity and sleep."
    assert normalized.highlights == [
        "Sleep was lower than target.",
        "Steps were below your usual range.",
        "Active minutes were strong.",
        "Hydration is not tracked.",
    ]
    assert normalized.suggested_follow_ups == [
        "Review my steps and sleep together",
        "How much should I increase walking?",
        "Should I change my bedtime?",
    ]


@pytest.mark.asyncio
async def test_run_diet_retries_when_first_response_uses_placeholder_days(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = AgenticLLMService()
    service._client = object()
    start_date = date(2026, 3, 20)

    invalid = DietStructuredResponse(
        summary="A 3 day plan.",
        highlights=[],
        suggested_follow_ups=[],
        start_date=start_date,
        end_date=start_date + timedelta(days=2),
        items=[
            DietStructuredItem(
                title="Breakfast",
                meal_slot="Breakfast",
                scheduled_day="Day 1",
                target_time="08:00",
            ),
            DietStructuredItem(
                title="Lunch",
                meal_slot="Lunch",
                scheduled_day="Day 1",
                target_time="12:30",
            ),
            DietStructuredItem(
                title="Dinner",
                meal_slot="Dinner",
                scheduled_day="Day 1",
                target_time="19:00",
            ),
            DietStructuredItem(
                title="(Repeat similar structure for the remaining days)",
                meal_slot="All",
                scheduled_day="Day 2",
            ),
        ],
    )
    valid = DietStructuredResponse(
        summary="A complete 3 day plan.",
        highlights=[],
        suggested_follow_ups=[],
        start_date=start_date,
        end_date=start_date + timedelta(days=2),
        items=[
            DietStructuredItem(
                title=f"{meal} day {day}",
                meal_slot=meal,
                scheduled_day=f"Day {day}",
                target_time="08:00" if meal == "Breakfast" else "12:30" if meal == "Lunch" else "19:00",
            )
            for day in range(1, 4)
            for meal in ["Breakfast", "Lunch", "Dinner"]
        ],
    )

    responses = iter([invalid, valid])

    async def fake_parse(**_: object) -> DietStructuredResponse:
        return next(responses)

    monkeypatch.setattr(service, "_parse", fake_parse)

    result = await service.run_diet(
        user_id="user-1",
        prompt="Create a complete 3 day diet plan",
        context_messages=[],
        context_snapshot="{}",
    )

    assert len(result.items) == 9
    assert all("repeat similar" not in item.title.lower() for item in result.items)


@pytest.mark.asyncio
async def test_run_diet_raises_when_retry_is_still_incomplete(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = AgenticLLMService()
    service._client = object()
    start_date = date(2026, 3, 20)
    invalid = DietStructuredResponse(
        summary="A 30 day plan.",
        highlights=[],
        suggested_follow_ups=[],
        start_date=start_date,
        end_date=start_date + timedelta(days=29),
        items=[
            DietStructuredItem(
                title="Breakfast",
                meal_slot="Breakfast",
                scheduled_day="Day 1",
                target_time="08:00",
            ),
            DietStructuredItem(
                title="(Repeat similar structure for the remaining days)",
                meal_slot="All",
                scheduled_day="Day 2",
            ),
        ],
    )

    responses = iter([invalid, invalid])

    async def fake_parse(**_: object) -> DietStructuredResponse:
        return next(responses)

    monkeypatch.setattr(service, "_parse", fake_parse)

    with pytest.raises(IncompletePlanError):
        await service.run_diet(
            user_id="user-2",
            prompt="Create a complete 30 day diet plan",
            context_messages=[],
            context_snapshot="{}",
        )
