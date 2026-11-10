"""`responseSchema` objects for the JSON routes, in Gemini's OpenAPI subset.

They steer generation; Pydantic still validates every reply on our side.
"""

from typing import Any

JsonSchema = dict[str, Any]


def _string(max_length: int | None = None, enum: list[str] | None = None) -> JsonSchema:
    schema: JsonSchema = {"type": "STRING"}
    if max_length is not None:
        schema["maxLength"] = max_length
    if enum is not None:
        schema["enum"] = enum
    return schema


def _object(properties: dict[str, JsonSchema], required: list[str] | None = None) -> JsonSchema:
    return {
        "type": "OBJECT",
        "properties": properties,
        "required": required if required is not None else list(properties),
        "propertyOrdering": list(properties),
    }


def _array(
    items: JsonSchema, min_items: int | None = None, max_items: int | None = None
) -> JsonSchema:
    schema: JsonSchema = {"type": "ARRAY", "items": items}
    if min_items is not None:
        schema["minItems"] = min_items
    if max_items is not None:
        schema["maxItems"] = max_items
    return schema


def health_tips_schema(factor_ids: list[str]) -> JsonSchema:
    tip = _object({"factorId": _string(enum=factor_ids), "text": _string(240)})
    count = len(factor_ids)
    return _object({"tips": _array(tip, count, count)})


def categorize_schema(transaction_ids: list[str], category_ids: list[str]) -> JsonSchema:
    suggestion = _object(
        {
            "id": _string(enum=transaction_ids),
            "categoryId": _string(enum=category_ids),
            "confidence": {"type": "NUMBER", "minimum": 0, "maximum": 1},
        }
    )
    return _object({"suggestions": _array(suggestion, max_items=len(transaction_ids))})


def checkin_schema(category_ids: list[str]) -> JsonSchema:
    question = _object({"id": _string(), "text": _string(180)})
    adjustment = _object(
        {
            "id": _string(),
            "categoryId": _string(enum=category_ids),
            "changePercent": {"type": "INTEGER", "minimum": -30, "maximum": 30},
            "reason": _string(180),
        }
    )
    return _object(
        {
            "summary": _string(600),
            "highlights": _array(_string(140), max_items=4),
            "questions": _array(question, 2, 3),
            "adjustments": _array(adjustment, max_items=4),
        }
    )
