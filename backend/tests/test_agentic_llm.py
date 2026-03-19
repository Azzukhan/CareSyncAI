from app.modules.agentic.llm import MedicalStructuredResponse, _normalize_structured_response


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
