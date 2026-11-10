"""The AI client Protocol and its Gemini REST implementation."""

import logging
from typing import Protocol

import httpx

from moneyflow_api.ai.gemini_format import GeminiReply, JsonObject, parse_response

logger = logging.getLogger(__name__)

GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta"


class AiUnavailableError(Exception):
    """Gemini could not be reached or answered with an error status."""


class AiInvalidOutputError(Exception):
    """Gemini answered, but the output failed validation."""


class AiClient(Protocol):
    async def generate(self, body: JsonObject) -> GeminiReply: ...

    async def aclose(self) -> None: ...


class GeminiClient:
    def __init__(
        self,
        *,
        api_key: str,
        model: str,
        timeout_seconds: float,
        http: httpx.AsyncClient | None = None,
    ) -> None:
        self._api_key = api_key
        self._url = f"{GEMINI_BASE_URL}/models/{model}:generateContent"
        self._timeout = timeout_seconds
        self._http = http

    def _client(self) -> httpx.AsyncClient:
        if self._http is None:
            self._http = httpx.AsyncClient()
        return self._http

    async def generate(self, body: JsonObject) -> GeminiReply:
        try:
            response = await self._client().post(
                self._url,
                json=body,
                headers={"x-goog-api-key": self._api_key},
                timeout=self._timeout,
            )
        except httpx.HTTPError as exc:
            logger.warning("Gemini request failed: %s", type(exc).__name__)
            raise AiUnavailableError(type(exc).__name__) from exc
        if response.status_code != httpx.codes.OK:
            logger.warning("Gemini returned HTTP %s", response.status_code)
            raise AiUnavailableError(f"HTTP {response.status_code}")
        try:
            data = response.json()
        except ValueError as exc:
            raise AiUnavailableError("response is not JSON") from exc
        if not isinstance(data, dict):
            raise AiUnavailableError("response is not a JSON object")
        return parse_response(data)

    async def aclose(self) -> None:
        if self._http is not None:
            await self._http.aclose()
