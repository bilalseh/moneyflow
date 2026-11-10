from typing import Any

from pydantic import BaseModel, ValidationError

from moneyflow_api.ai.gemini_format import (
    GeminiReply,
    GenerationOptions,
    JsonObject,
    build_request,
    user_text,
)
from moneyflow_api.ai.prompts import CATEGORIZE_TASK, data_block, system_parts
from moneyflow_api.ai.response_schemas import categorize_schema
from moneyflow_api.ai.runner import parse_json_reply
from moneyflow_api.money import format_minor
from moneyflow_api.schemas.categorize import CategorizeRequest, CategorizeResponse, Suggestion


class _RawSuggestions(BaseModel):
    suggestions: list[Any]


def build_body(request: CategorizeRequest) -> JsonObject:
    transactions = [
        {
            "id": tx.id,
            "description": tx.description,
            "type": tx.type,
            "amount": format_minor(tx.amount, tx.currency),
        }
        for tx in request.transactions
    ]
    return build_request(
        system=system_parts(request.locale, CATEGORIZE_TASK),
        contents=[
            user_text(
                data_block("allowedCategories", list(request.categories))
                + "\n"
                + data_block("transactions", transactions)
            )
        ],
        options=GenerationOptions(
            temperature=0.2,
            max_output_tokens=8192,
            response_schema=categorize_schema(
                [tx.id for tx in request.transactions], list(request.categories)
            ),
        ),
    )


def parse_reply(request: CategorizeRequest, reply: GeminiReply) -> CategorizeResponse:
    """Keep only well-formed suggestions for requested ids and allowed categories.

    A malformed item is dropped rather than failing the batch; a reply that is not
    the expected JSON object at all is invalid.
    """
    raw = parse_json_reply(reply, _RawSuggestions)
    requested = {tx.id for tx in request.transactions}
    allowed = set(request.categories)
    kept: dict[str, Suggestion] = {}
    for item in raw.suggestions:
        try:
            suggestion = Suggestion.model_validate(item)
        except ValidationError:
            continue
        if suggestion.id in requested and suggestion.categoryId in allowed:
            kept.setdefault(suggestion.id, suggestion)
    return CategorizeResponse(suggestions=list(kept.values()), source="ai")
