from typing import Any

from moneyflow_api.ai.client import AiUnavailableError
from tests import payloads
from tests.conftest import ALICE, Harness, HarnessFactory
from tests.fakes import json_reply

URL = "/api/ai/checkin"


def model_checkin(**overrides: Any) -> dict[str, Any]:
    value: dict[str, Any] = {
        "summary": "October was steady: income 4,200.00 USD and spending 3,510.00 USD.",
        "highlights": ["Dining went over plan.", "Groceries stayed under plan."],
        "questions": [
            {"id": "x", "text": "What made dining out tempting this month?"},
            {"id": "y", "text": "Which grocery habit worked well?"},
        ],
        "adjustments": [
            {"id": "z", "categoryId": "dining", "changePercent": -10, "reason": "Over plan."}
        ],
    }
    value.update(overrides)
    return value


def test_happy_path(harness: Harness) -> None:
    harness.ai.script(json_reply(model_checkin()))

    response = harness.client.post(URL, json=payloads.checkin(), headers=ALICE)

    assert response.status_code == 200
    body = response.json()
    assert body["source"] == "ai"
    assert [q["id"] for q in body["questions"]] == ["q1", "q2"]
    assert body["adjustments"] == [
        {"id": "a1", "categoryId": "dining", "changePercent": -10, "reason": "Over plan."}
    ]


def test_prompt_gets_formatted_amounts_and_comparisons(harness: Harness) -> None:
    harness.ai.script(json_reply(model_checkin()))

    harness.client.post(URL, json=payloads.checkin(), headers=ALICE)

    prompt = harness.ai.bodies[0]["contents"][0]["parts"][0]["text"]
    assert '"income":"4,200.00 USD"' in prompt
    assert '"savingsRate":"16.4%"' in prompt
    assert '"categoryId":"dining","planned":"200.00 USD","actual":"310.00 USD","overPlan":true' in (
        prompt
    )


def test_normalizes_model_output(harness: Harness) -> None:
    messy = model_checkin(
        highlights=["one", "", "two", "three", "four", "five"],
        questions=[
            {"text": "First?"},
            {"text": "  "},
            "Second?",
            {"text": "Third?"},
            {"text": "Fourth?"},
        ],
        adjustments=[
            {"categoryId": "dining", "changePercent": -10, "reason": "ok"},
            {"categoryId": "dining", "changePercent": -5, "reason": "duplicate"},
            {"categoryId": "travel", "changePercent": -5, "reason": "not in request"},
            {"categoryId": "shopping", "changePercent": 0, "reason": "zero"},
            {"categoryId": "shopping", "changePercent": -45, "reason": "too big"},
            {"categoryId": "shopping", "changePercent": -7.5, "reason": "fraction"},
            {"categoryId": "groceries", "changePercent": 5.0, "reason": "whole float"},
            {"categoryId": "transport", "changePercent": 10},
            "garbage",
        ],
        summary="word " * 300,
    )
    harness.ai.script(json_reply(messy))

    body = harness.client.post(URL, json=payloads.checkin(), headers=ALICE).json()

    assert body["source"] == "ai"
    assert body["highlights"] == ["one", "two", "three", "four"]
    assert [q["text"] for q in body["questions"]] == ["First?", "Second?", "Third?"]
    assert [(a["id"], a["categoryId"], a["changePercent"]) for a in body["adjustments"]] == [
        ("a1", "dining", -10),
        ("a2", "groceries", 5),
    ]
    assert len(body["summary"]) <= 800


def test_too_few_questions_twice_uses_fallback(harness: Harness) -> None:
    bad = model_checkin(questions=[{"text": "Only one?"}])
    harness.ai.script(json_reply(bad), json_reply(bad))

    body = harness.client.post(URL, json=payloads.checkin(), headers=ALICE).json()

    assert body["source"] == "fallback"
    assert [a["categoryId"] for a in body["adjustments"]] == ["shopping", "dining"]
    assert harness.usage_store.records == {}


def test_crypto_in_summary_is_invalid(harness: Harness) -> None:
    bad = model_checkin(summary="Consider moving savings into crypto.")
    harness.ai.script(json_reply(bad), json_reply(model_checkin()))

    body = harness.client.post(URL, json=payloads.checkin(), headers=ALICE).json()

    assert body["source"] == "ai"
    assert "crypto" not in body["summary"]


def test_unavailable_and_disabled_fall_back(make_harness: HarnessFactory) -> None:
    down = make_harness()
    down.ai.script(AiUnavailableError("down"))
    off = make_harness(ai_enabled=False)

    assert down.client.post(URL, json=payloads.checkin(), headers=ALICE).json()["source"] == (
        "fallback"
    )
    arabic = off.client.post(URL, json=payloads.checkin("ar"), headers=ALICE).json()
    assert arabic["source"] == "fallback"
    assert arabic["summary"].startswith("في أكتوبر 2026")
