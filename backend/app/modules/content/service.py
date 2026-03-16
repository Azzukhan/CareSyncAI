from app.modules.content.schemas import HealthTipResponse


HEALTH_TIPS: list[HealthTipResponse] = [
    HealthTipResponse(
        id="1",
        title="Managing High Blood Pressure Naturally",
        excerpt="Simple lifestyle changes that can help reduce your blood pressure.",
        category="Heart Health",
        read_time="5 min",
        image="🫀",
    ),
    HealthTipResponse(
        id="2",
        title="Understanding Your Blood Test Results",
        excerpt="A practical guide to reading the key values on common blood tests.",
        category="Lab Tests",
        read_time="8 min",
        image="🔬",
    ),
    HealthTipResponse(
        id="3",
        title="Mental Health: When to See Your GP",
        excerpt="Recognising the signs and knowing when to get support early.",
        category="Mental Health",
        read_time="6 min",
        image="🧠",
    ),
    HealthTipResponse(
        id="4",
        title="Asthma Management in Winter",
        excerpt="Tips to keep your asthma under control during colder months.",
        category="Respiratory",
        read_time="4 min",
        image="🌬️",
    ),
    HealthTipResponse(
        id="5",
        title="NHS Health Check: What to Expect",
        excerpt="What happens during a routine health check and how to prepare.",
        category="Prevention",
        read_time="5 min",
        image="✅",
    ),
    HealthTipResponse(
        id="6",
        title="Diabetes Prevention Through Diet",
        excerpt="Evidence-based dietary changes that help reduce Type 2 diabetes risk.",
        category="Nutrition",
        read_time="7 min",
        image="🥗",
    ),
]


def list_health_tips() -> list[HealthTipResponse]:
    return HEALTH_TIPS
