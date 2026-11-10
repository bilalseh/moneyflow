from typing import Any

from moneyflow_api.ai.history import build_contents
from moneyflow_api.schemas.coach import CoachRequest
from tests import payloads


def contents_for(*messages: dict[str, Any]) -> list[dict[str, Any]]:
    return build_contents(CoachRequest.model_validate(payloads.coach(*messages)).messages)


def test_tool_round_trip_maps_to_gemini_roles() -> None:
    request = CoachRequest.model_validate(payloads.tool_round_trip())

    contents = build_contents(request.messages)

    assert [c["role"] for c in contents] == ["user", "model", "user"]
    assert contents[0]["parts"][0]["text"].startswith("<user_message>")
    assert contents[1]["parts"] == [
        {
            "functionCall": {
                "name": "check_affordability",
                "args": {"amountMajor": 900, "month": "2027-03"},
            }
        }
    ]
    assert contents[2]["parts"] == [
        {
            "functionResponse": {
                "name": "check_affordability",
                "response": {"affordable": True},
            }
        }
    ]


def test_assistant_text_becomes_model_turn() -> None:
    contents = contents_for(
        {"role": "user", "text": "hi"},
        {"role": "assistant", "text": "Hello!"},
        {"role": "user", "text": "thanks"},
    )

    assert contents[1] == {"role": "model", "parts": [{"text": "Hello!"}]}


def test_unanswered_tool_call_is_skipped() -> None:
    contents = contents_for(
        {"role": "user", "text": "phone?"},
        {
            "role": "assistant",
            "toolCall": {"id": "c9", "name": "simulate_scenario", "args": {}},
        },
        {"role": "user", "text": "never mind"},
    )

    assert [c["role"] for c in contents] == ["user", "user"]


def test_leading_assistant_greeting_is_dropped() -> None:
    contents = contents_for(
        {"role": "assistant", "text": "Hi, I am your coach."},
        {"role": "user", "text": "hello"},
    )

    assert [c["role"] for c in contents] == ["user"]
