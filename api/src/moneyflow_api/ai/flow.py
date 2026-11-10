"""The one place that decides between AI, fallback and error, and charges quota.

Quota rules (see docs/api-contract.md):
- checked before any Gemini call, only for counted requests;
- charged only when the response served came from the model (`source == "ai"`),
  or when the model answered but no fallback exists (502 ai_invalid);
- never charged for fallbacks, refusals or uncounted coach continuations.
"""

import logging
from collections.abc import Awaitable, Callable
from typing import Literal, Protocol

from moneyflow_api.ai.client import AiClient, AiInvalidOutputError, AiUnavailableError
from moneyflow_api.errors import ApiError
from moneyflow_api.quota import QuotaService

logger = logging.getLogger(__name__)

FallbackReason = Literal["disabled", "unavailable", "invalid"]


class HasSource(Protocol):
    @property
    def source(self) -> str: ...


async def run_ai_request[T: HasSource](
    *,
    client: AiClient | None,
    quota: QuotaService,
    uid: str,
    counted: bool,
    call: Callable[[AiClient], Awaitable[T]],
    fallback: Callable[[FallbackReason], T] | None,
) -> T:
    if client is None:
        if fallback is None:
            raise ApiError.ai_unavailable()
        return fallback("disabled")
    if counted:
        await quota.ensure_available(uid)
    try:
        result = await call(client)
    except AiUnavailableError:
        if fallback is None:
            raise ApiError.ai_unavailable() from None
        return fallback("unavailable")
    except AiInvalidOutputError:
        if fallback is not None:
            return fallback("invalid")
        if counted:
            await quota.record(uid)
        raise ApiError.ai_invalid() from None
    if counted and result.source == "ai":
        await quota.record(uid)
    return result
