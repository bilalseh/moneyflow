from typing import Any

from moneyflow_api.ai.client import AiUnavailableError
from tests import payloads
from tests.conftest import ALICE, Harness, HarnessFactory
from tests.fakes import json_reply, text_reply

URL = "/api/ai/health-tips"


def tips(*items: tuple[str, str]) -> dict[str, Any]:
    return {"tips": [{"factorId": f, "text": t} for f, t in items]}


GOOD = tips(
    ("savingsRate", "You save 12% today. Nudging it toward 20% or more builds a cushion."),
    ("emergencyFund", "You have 2.4 months covered. Aim for 3 to 6 months over time."),
)


def test_happy_path_returns_one_tip_per_factor(harness: Harness) -> None:
    harness.ai.script(json_reply(GOOD))

    response = harness.client.post(URL, json=payloads.health_tips(), headers=ALICE)

    assert response.status_code == 200
    body = response.json()
    assert body["source"] == "ai"
    assert [t["factorId"] for t in body["tips"]] == ["savingsRate", "emergencyFund"]


def test_request_to_gemini_is_json_mode_with_schema_and_delimited_data(harness: Harness) -> None:
    harness.ai.script(json_reply(GOOD))

    harness.client.post(URL, json=payloads.health_tips("ar"), headers=ALICE)

    [body] = harness.ai.bodies
    config = body["generationConfig"]
    assert config["responseMimeType"] == "application/json"
    tips_schema = config["responseSchema"]["properties"]["tips"]
    assert tips_schema["minItems"] == tips_schema["maxItems"] == 2
    assert "Modern Standard Arabic" in body["systemInstruction"]["parts"][0]["text"]
    user_text = body["contents"][0]["parts"][0]["text"]
    assert user_text.startswith('<data name="factors">')
    assert '"valueLabel":"12%"' in user_text
    assert '"valueLabel":"2.4 months"' in user_text


def test_order_follows_the_request_not_the_model(harness: Harness) -> None:
    reordered = {"tips": list(reversed(GOOD["tips"]))}
    harness.ai.script(json_reply(reordered))

    body = harness.client.post(URL, json=payloads.health_tips(), headers=ALICE).json()

    assert [t["factorId"] for t in body["tips"]] == ["savingsRate", "emergencyFund"]


def test_invented_number_triggers_retry(harness: Harness) -> None:
    invented = tips(
        ("savingsRate", "Save 37% more each month."),
        ("emergencyFund", "Keep building it."),
    )
    harness.ai.script(json_reply(invented), json_reply(GOOD))

    body = harness.client.post(URL, json=payloads.health_tips(), headers=ALICE).json()

    assert body["source"] == "ai"
    assert len(harness.ai.bodies) == 2


def test_missing_factor_twice_falls_back(harness: Harness) -> None:
    partial = tips(("savingsRate", "Keep going."))
    harness.ai.script(json_reply(partial), text_reply("not json"))

    body = harness.client.post(URL, json=payloads.health_tips(), headers=ALICE).json()

    assert body["source"] == "fallback"
    assert len(body["tips"]) == 2
    assert harness.usage_store.records == {}


def test_product_recommendation_is_rejected(harness: Harness) -> None:
    pushy = tips(("savingsRate", "Put it in index funds."), ("emergencyFund", "Buy bitcoin."))
    harness.ai.script(json_reply(pushy), json_reply(pushy))

    body = harness.client.post(URL, json=payloads.health_tips(), headers=ALICE).json()

    assert body["source"] == "fallback"


def test_long_tip_is_clipped_to_280(harness: Harness) -> None:
    long = tips(("savingsRate", "word " * 100), ("emergencyFund", "Fine."))
    harness.ai.script(json_reply(long))

    body = harness.client.post(URL, json=payloads.health_tips(), headers=ALICE).json()

    assert body["source"] == "ai"
    assert len(body["tips"][0]["text"]) <= 280


def test_gemini_down_falls_back_without_quota(harness: Harness) -> None:
    harness.ai.script(AiUnavailableError("down"))

    body = harness.client.post(URL, json=payloads.health_tips(), headers=ALICE).json()

    assert body["source"] == "fallback"
    assert harness.usage_store.records == {}


def test_ai_disabled_serves_localized_fallback(make_harness: HarnessFactory) -> None:
    harness = make_harness(ai_enabled=False)

    english = harness.client.post(URL, json=payloads.health_tips(), headers=ALICE).json()
    arabic = harness.client.post(URL, json=payloads.health_tips("ar"), headers=ALICE).json()

    assert english["source"] == arabic["source"] == "fallback"
    assert "healthy range: 20% or more" in english["tips"][0]["text"]
    assert "النطاق الصحي" in arabic["tips"][0]["text"]
