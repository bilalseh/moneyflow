import re

import pytest

from moneyflow_api.ai.client import AiUnavailableError
from tests import payloads
from tests.conftest import ALICE, Harness, HarnessFactory
from tests.fakes import call_reply, text_reply

URL = "/api/ai/coach"


def test_text_answer(harness: Harness) -> None:
    harness.ai.script(text_reply("Happy to help with your budget."))

    response = harness.client.post(
        URL, json=payloads.coach({"role": "user", "text": "hello"}), headers=ALICE
    )

    assert response.status_code == 200
    assert response.json() == {
        "type": "message",
        "text": "Happy to help with your budget.",
        "refusal": False,
        "source": "ai",
    }


def test_tool_call_gets_server_id_and_defaults(harness: Harness) -> None:
    harness.ai.script(call_reply("check_affordability", {"amountMajor": 900, "month": "2027-03"}))

    body = harness.client.post(URL, json=payloads.coach(), headers=ALICE).json()

    assert body["type"] == "tool_call"
    assert body["source"] == "ai"
    assert re.fullmatch(r"call_[0-9a-f]{12}", body["toolCall"]["id"])
    assert body["toolCall"]["name"] == "check_affordability"
    assert body["toolCall"]["args"] == {"amountMajor": 900, "month": "2027-03"}
    assert harness.usage_store.records["alice"].count == 1


def test_request_carries_tools_system_instruction_and_context(harness: Harness) -> None:
    harness.ai.script(text_reply("ok"))

    harness.client.post(URL, json=payloads.coach(), headers=ALICE)

    [body] = harness.ai.bodies
    names = {d["name"] for d in body["tools"][0]["functionDeclarations"]}
    assert names == {
        "check_affordability",
        "simulate_scenario",
        "project_goal",
        "compare_debt_strategies",
    }
    system = [part["text"] for part in body["systemInstruction"]["parts"]]
    assert "must call a tool" in system[1]
    assert system[2].startswith('<data name="context">')
    assert '"monthlyIncome":"4,200.00 USD"' in system[2]
    assert '"apr":"24%"' in system[2]
    assert body["contents"][0]["parts"][0]["text"].startswith("<user_message>")


def test_tool_round_trip_continuation_is_explained_and_not_counted(harness: Harness) -> None:
    harness.ai.script(text_reply("Yes, the simulator says the phone fits your March budget."))

    response = harness.client.post(URL, json=payloads.tool_round_trip(), headers=ALICE)

    assert response.json()["type"] == "message"
    roles = [c["role"] for c in harness.ai.bodies[0]["contents"]]
    assert roles == ["user", "model", "user"]
    assert "functionResponse" in harness.ai.bodies[0]["contents"][2]["parts"][0]
    assert "alice" not in harness.usage_store.records


def test_invalid_tool_args_are_retried(harness: Harness) -> None:
    harness.ai.script(
        call_reply("check_affordability", {"amountMajor": -1, "month": "2027-03"}),
        call_reply(
            "simulate_scenario", {"categoryCuts": [{"categoryId": "dining", "percent": 20}]}
        ),
    )

    body = harness.client.post(URL, json=payloads.coach(), headers=ALICE).json()

    assert body["toolCall"]["name"] == "simulate_scenario"
    assert body["toolCall"]["args"] == {
        "extraSavingsMajor": 0,
        "categoryCuts": [{"categoryId": "dining", "percent": 20}],
        "incomeChangeMajor": 0,
    }
    assert len(harness.ai.bodies) == 2


def test_unknown_goal_twice_falls_back(harness: Harness) -> None:
    bad = call_reply("project_goal", {"goalId": "nope"})
    harness.ai.script(bad, bad)

    body = harness.client.post(URL, json=payloads.coach(), headers=ALICE).json()

    assert body["type"] == "message"
    assert body["source"] == "fallback"
    assert "reliable answer" in body["text"]
    assert "alice" not in harness.usage_store.records


def test_post_filter_replaces_product_pushing_text(harness: Harness) -> None:
    harness.ai.script(text_reply("You should put your savings into Bitcoin and $TSLA."))

    body = harness.client.post(
        URL,
        json=payloads.coach({"role": "user", "text": "how can I grow my savings?"}),
        headers=ALICE,
    ).json()

    assert body["refusal"] is True
    assert body["source"] == "fallback"
    assert "Bitcoin" not in body["text"]


@pytest.mark.parametrize(
    ("locale", "text", "marker"),
    [
        ("en", "Should I buy Bitcoin?", "cryptocurrency"),
        ("en", "How do I reduce my taxes?", "tax advice"),
        ("ar", "هل أستثمر في الذهب؟", "النصائح الاستثمارية"),
    ],
)
def test_pre_filter_refuses_without_calling_gemini(
    make_harness: HarnessFactory, locale: str, text: str, marker: str
) -> None:
    harness = make_harness(free_daily_ai=0)

    body = harness.client.post(
        URL, json=payloads.coach({"role": "user", "text": text}, locale=locale), headers=ALICE
    ).json()

    assert body == {"type": "message", "text": body["text"], "refusal": True, "source": "fallback"}
    assert marker in body["text"]
    assert harness.ai.bodies == []


def test_pre_filter_ignores_old_messages_on_tool_continuation(harness: Harness) -> None:
    request = payloads.tool_round_trip()
    request["messages"][0]["text"] = "Can I afford bitcoin worth $900?"
    harness.ai.script(text_reply("The simulator result says yes."))

    body = harness.client.post(URL, json=request, headers=ALICE).json()

    assert body["source"] == "ai"


def test_long_answer_is_clipped(harness: Harness) -> None:
    harness.ai.script(text_reply("budget " * 400))

    body = harness.client.post(URL, json=payloads.coach(), headers=ALICE).json()

    assert body["source"] == "ai"
    assert len(body["text"]) <= 2000


def test_empty_reply_twice_falls_back(harness: Harness) -> None:
    harness.ai.script(text_reply(""), text_reply("   "))

    body = harness.client.post(URL, json=payloads.coach(), headers=ALICE).json()

    assert body["source"] == "fallback"


@pytest.mark.parametrize("ai_enabled", [True, False])
def test_unavailable_or_disabled_points_to_simulator(
    make_harness: HarnessFactory, ai_enabled: bool
) -> None:
    harness = make_harness(ai_enabled=ai_enabled)
    harness.ai.script(AiUnavailableError("down"))

    body = harness.client.post(URL, json=payloads.coach(locale="ar"), headers=ALICE).json()

    assert body["source"] == "fallback"
    assert body["refusal"] is False
    assert "المحاكي" in body["text"]
