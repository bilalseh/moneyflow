from datetime import UTC, datetime

from moneyflow_api.ai.client import AiUnavailableError
from moneyflow_api.stores.models import BillingRecord, UsageRecord
from tests import payloads
from tests.conftest import ALICE, BOB, HarnessFactory
from tests.fakes import json_reply, text_reply

TIPS = "/api/ai/health-tips"
COACH = "/api/ai/coach"
GOOD_TIPS = {
    "tips": [
        {"factorId": "savingsRate", "text": "Keep saving."},
        {"factorId": "emergencyFund", "text": "Keep building."},
    ]
}


def test_successful_ai_requests_are_counted(make_harness: HarnessFactory) -> None:
    harness = make_harness()
    harness.ai.script(json_reply(GOOD_TIPS), json_reply(GOOD_TIPS))

    for _ in range(2):
        harness.client.post(TIPS, json=payloads.health_tips(), headers=ALICE)

    assert harness.usage_store.records["alice"] == UsageRecord(day="2026-11-10", count=2)
    assert harness.client.get("/api/me", headers=ALICE).json()["usage"]["used"] == 2


def test_exhausted_quota_is_429_before_calling_gemini(make_harness: HarnessFactory) -> None:
    harness = make_harness(free_daily_ai=2)
    harness.usage_store.records["alice"] = UsageRecord(day="2026-11-10", count=2)
    harness.clock.now = datetime(2026, 11, 10, 23, 0, 0, tzinfo=UTC)

    response = harness.client.post(TIPS, json=payloads.health_tips(), headers=ALICE)

    assert response.status_code == 429
    assert response.json() == {
        "error": {
            "code": "quota_exceeded",
            "message": "Daily AI quota used up. It resets at midnight UTC.",
            "retryAfterSeconds": 3600,
        }
    }
    assert harness.ai.bodies == []
    harness.ai.script(json_reply(GOOD_TIPS))
    assert harness.client.post(TIPS, json=payloads.health_tips(), headers=BOB).status_code == 200


def test_quota_resets_on_a_new_utc_day(make_harness: HarnessFactory) -> None:
    harness = make_harness(free_daily_ai=1)
    harness.ai.script(json_reply(GOOD_TIPS), json_reply(GOOD_TIPS))
    harness.client.post(TIPS, json=payloads.health_tips(), headers=ALICE)
    assert harness.client.post(TIPS, json=payloads.health_tips(), headers=ALICE).status_code == 429

    harness.clock.now = datetime(2026, 11, 11, 0, 0, 1, tzinfo=UTC)

    assert harness.client.post(TIPS, json=payloads.health_tips(), headers=ALICE).status_code == 200
    assert harness.usage_store.records["alice"] == UsageRecord(day="2026-11-11", count=1)


def test_pro_plan_gets_the_pro_limit(make_harness: HarnessFactory) -> None:
    harness = make_harness(free_daily_ai=1, pro_daily_ai=5)
    harness.billing_store.records["alice"] = BillingRecord(plan="pro")
    harness.usage_store.records["alice"] = UsageRecord(day="2026-11-10", count=4)
    harness.ai.script(json_reply(GOOD_TIPS))

    assert harness.client.post(TIPS, json=payloads.health_tips(), headers=ALICE).status_code == 200
    assert harness.client.post(TIPS, json=payloads.health_tips(), headers=ALICE).status_code == 429


def test_fallbacks_are_not_counted(make_harness: HarnessFactory) -> None:
    harness = make_harness()
    harness.ai.script(AiUnavailableError("down"), text_reply("bad"), text_reply("bad"))

    harness.client.post(TIPS, json=payloads.health_tips(), headers=ALICE)
    harness.client.post(TIPS, json=payloads.health_tips(), headers=ALICE)

    assert harness.usage_store.records == {}


def test_ai_disabled_serves_fallback_even_when_quota_is_used(make_harness: HarnessFactory) -> None:
    harness = make_harness(ai_enabled=False, free_daily_ai=0)

    response = harness.client.post(TIPS, json=payloads.health_tips(), headers=ALICE)

    assert response.status_code == 200
    assert response.json()["source"] == "fallback"


def test_coach_tool_continuation_is_free_and_allowed_at_the_limit(
    make_harness: HarnessFactory,
) -> None:
    harness = make_harness(free_daily_ai=1)
    harness.usage_store.records["alice"] = UsageRecord(day="2026-11-10", count=1)
    harness.ai.script(text_reply("The result says yes."))

    continuation = harness.client.post(COACH, json=payloads.tool_round_trip(), headers=ALICE)
    new_question = harness.client.post(COACH, json=payloads.coach(), headers=ALICE)

    assert continuation.status_code == 200
    assert new_question.status_code == 429
    assert harness.usage_store.records["alice"].count == 1


def test_refusals_are_free(make_harness: HarnessFactory) -> None:
    harness = make_harness(free_daily_ai=0)
    body = payloads.coach({"role": "user", "text": "Which stocks should I buy?"})

    response = harness.client.post(COACH, json=body, headers=ALICE)

    assert response.status_code == 200
    assert response.json()["refusal"] is True
    assert harness.usage_store.records == {}
