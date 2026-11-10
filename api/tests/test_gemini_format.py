import json
from pathlib import Path
from typing import Any

import pytest

from moneyflow_api.ai.gemini_format import (
    FunctionCall,
    GenerationOptions,
    build_request,
    function_response,
    model_function_call,
    model_text,
    parse_response,
    user_text,
)

FIXTURES = Path(__file__).parent / "fixtures" / "gemini"


def load(name: str) -> dict[str, Any]:
    data: dict[str, Any] = json.loads((FIXTURES / name).read_text(encoding="utf-8"))
    return data


def test_build_request_for_json_route() -> None:
    schema = {"type": "OBJECT", "properties": {}}
    body = build_request(
        system=["rules", "task"],
        contents=[user_text("hello")],
        options=GenerationOptions(temperature=0.3, max_output_tokens=256, response_schema=schema),
    )

    assert body == {
        "systemInstruction": {"parts": [{"text": "rules"}, {"text": "task"}]},
        "contents": [{"role": "user", "parts": [{"text": "hello"}]}],
        "generationConfig": {
            "temperature": 0.3,
            "maxOutputTokens": 256,
            "responseMimeType": "application/json",
            "responseSchema": schema,
        },
    }


def test_build_request_with_tools_has_no_json_mode() -> None:
    declarations = [{"name": "check_affordability", "parameters": {"type": "OBJECT"}}]
    body = build_request(
        system=["rules"],
        contents=[user_text("hi")],
        options=GenerationOptions(),
        function_declarations=declarations,
    )

    assert body["tools"] == [{"functionDeclarations": declarations}]
    assert "responseMimeType" not in body["generationConfig"]


def test_build_request_omits_empty_tools() -> None:
    body = build_request(
        system=["r"], contents=[], options=GenerationOptions(), function_declarations=[]
    )

    assert "tools" not in body


def test_content_helpers_use_gemini_roles() -> None:
    assert model_text("ok") == {"role": "model", "parts": [{"text": "ok"}]}
    assert model_function_call("project_goal", {"goalId": "g1"}) == {
        "role": "model",
        "parts": [{"functionCall": {"name": "project_goal", "args": {"goalId": "g1"}}}],
    }
    assert function_response("project_goal", {"months": 3}) == {
        "role": "user",
        "parts": [{"functionResponse": {"name": "project_goal", "response": {"months": 3}}}],
    }


def test_parse_json_text_reply() -> None:
    reply = parse_response(load("json_text.json"))

    assert json.loads(reply.text) == {"tips": [{"factorId": "savingsRate", "text": "Keep going."}]}
    assert reply.function_calls == []
    assert reply.finish_reason == "STOP"


def test_parse_function_call_reply() -> None:
    reply = parse_response(load("function_call.json"))

    assert reply.function_calls == [
        FunctionCall(
            name="check_affordability",
            args={"amountMajor": 900, "month": "2027-03", "label": "phone"},
        )
    ]
    assert reply.text == ""


def test_parse_skips_thought_parts_and_joins_text() -> None:
    reply = parse_response(load("thought_and_text.json"))

    assert reply.text == "You can afford it based on the simulator result."


def test_parse_blocked_prompt_returns_empty_reply_with_reason() -> None:
    reply = parse_response(load("blocked_prompt.json"))

    assert reply.text == ""
    assert reply.function_calls == []
    assert reply.block_reason == "SAFETY"


def test_parse_candidate_without_content() -> None:
    reply = parse_response(load("safety_stop.json"))

    assert reply.text == ""
    assert reply.finish_reason == "SAFETY"


@pytest.mark.parametrize(
    "raw",
    [
        {},
        {"candidates": "nope"},
        {"candidates": [None]},
        {"candidates": [{"content": {"parts": "x"}}]},
        {"candidates": [{"content": {"parts": [None, 3, {"functionCall": {"args": {}}}]}}]},
        {"candidates": [{"content": {"parts": [{"functionCall": {"name": "x", "args": []}}]}}]},
    ],
)
def test_parse_tolerates_malformed_shapes(raw: dict[str, Any]) -> None:
    reply = parse_response(raw)

    assert reply.text == ""
    assert all(call.args == {} for call in reply.function_calls)
