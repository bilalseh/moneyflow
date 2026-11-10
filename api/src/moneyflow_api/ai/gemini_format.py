"""Pure functions that build `generateContent` request bodies and parse responses.

Kept free of I/O so they can be unit-tested against recorded response shapes.
"""

from dataclasses import dataclass, field
from typing import Any

JsonObject = dict[str, Any]


@dataclass(frozen=True)
class FunctionCall:
    name: str
    args: JsonObject


@dataclass(frozen=True)
class GeminiReply:
    text: str = ""
    function_calls: list[FunctionCall] = field(default_factory=list)
    finish_reason: str | None = None
    block_reason: str | None = None


@dataclass(frozen=True)
class GenerationOptions:
    temperature: float = 0.4
    max_output_tokens: int = 1024
    response_schema: JsonObject | None = None


def user_text(text: str) -> JsonObject:
    return {"role": "user", "parts": [{"text": text}]}


def model_text(text: str) -> JsonObject:
    return {"role": "model", "parts": [{"text": text}]}


def model_function_call(name: str, args: JsonObject) -> JsonObject:
    return {"role": "model", "parts": [{"functionCall": {"name": name, "args": args}}]}


def function_response(name: str, result: JsonObject) -> JsonObject:
    return {"role": "user", "parts": [{"functionResponse": {"name": name, "response": result}}]}


def build_request(
    *,
    system: list[str],
    contents: list[JsonObject],
    options: GenerationOptions,
    function_declarations: list[JsonObject] | None = None,
) -> JsonObject:
    generation: JsonObject = {
        "temperature": options.temperature,
        "maxOutputTokens": options.max_output_tokens,
    }
    if options.response_schema is not None:
        generation["responseMimeType"] = "application/json"
        generation["responseSchema"] = options.response_schema
    body: JsonObject = {
        "systemInstruction": {"parts": [{"text": part} for part in system]},
        "contents": contents,
        "generationConfig": generation,
    }
    if function_declarations:
        body["tools"] = [{"functionDeclarations": function_declarations}]
    return body


def _as_dict(value: Any) -> JsonObject:
    return value if isinstance(value, dict) else {}


def _as_list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def parse_response(raw: JsonObject) -> GeminiReply:
    """Extract text and function calls from `candidates[0].content.parts`.

    Thought parts are skipped. Missing or blocked candidates yield an empty reply,
    which callers treat as invalid output.
    """
    block_reason = _as_dict(raw.get("promptFeedback")).get("blockReason")
    candidates = _as_list(raw.get("candidates"))
    if not candidates:
        return GeminiReply(block_reason=block_reason if isinstance(block_reason, str) else None)
    candidate = _as_dict(candidates[0])
    finish_reason = candidate.get("finishReason")
    texts: list[str] = []
    calls: list[FunctionCall] = []
    for part in _as_list(_as_dict(candidate.get("content")).get("parts")):
        part = _as_dict(part)
        if part.get("thought") is True:
            continue
        text = part.get("text")
        if isinstance(text, str):
            texts.append(text)
        call = _as_dict(part.get("functionCall"))
        name = call.get("name")
        if isinstance(name, str) and name:
            calls.append(FunctionCall(name=name, args=_as_dict(call.get("args"))))
    return GeminiReply(
        text="".join(texts),
        function_calls=calls,
        finish_reason=finish_reason if isinstance(finish_reason, str) else None,
    )
