"""Call the model, validate the output, retry once on invalid output."""

import json
import logging
import re
from collections.abc import Callable
from typing import Any

from pydantic import BaseModel, ValidationError

from moneyflow_api.ai.client import AiClient, AiInvalidOutputError
from moneyflow_api.ai.gemini_format import GeminiReply, JsonObject

logger = logging.getLogger(__name__)

MAX_ATTEMPTS = 2

_FENCE = re.compile(r"^```(?:json)?\s*(.*?)\s*```$", re.DOTALL)


async def generate_validated[T](
    client: AiClient,
    body: JsonObject,
    parse: Callable[[GeminiReply], T],
    *,
    task: str,
) -> T:
    """Return the first reply that `parse` accepts.

    Raises AiInvalidOutputError after MAX_ATTEMPTS invalid replies. AiUnavailableError
    from the client propagates unchanged.
    """
    last_error: AiInvalidOutputError | None = None
    for attempt in range(1, MAX_ATTEMPTS + 1):
        reply = await client.generate(body)
        try:
            return parse(reply)
        except AiInvalidOutputError as exc:
            logger.warning("Invalid %s output on attempt %d: %s", task, attempt, exc)
            last_error = exc
    raise AiInvalidOutputError(f"{task}: output invalid after {MAX_ATTEMPTS} attempts") from (
        last_error
    )


def parse_json_reply[M: BaseModel](reply: GeminiReply, model: type[M]) -> M:
    """Parse a JSON-mode reply into `model`, converting every failure to AiInvalidOutputError."""
    text = reply.text.strip()
    fenced = _FENCE.match(text)
    if fenced:
        text = fenced.group(1)
    if not text:
        reason = reply.block_reason or reply.finish_reason or "empty"
        raise AiInvalidOutputError(f"no text in reply ({reason})")
    try:
        data: Any = json.loads(text)
    except json.JSONDecodeError as exc:
        raise AiInvalidOutputError("reply is not valid JSON") from exc
    try:
        return model.model_validate(data)
    except ValidationError as exc:
        raise AiInvalidOutputError(f"reply failed schema validation ({exc.error_count()})") from exc
