import json

import httpx
import pytest

from moneyflow_api.ai.client import AiUnavailableError, GeminiClient


def make_client(handler: httpx.MockTransport) -> GeminiClient:
    return GeminiClient(
        api_key="secret-key",
        model="gemini-2.5-flash",
        timeout_seconds=5,
        http=httpx.AsyncClient(transport=handler),
    )


async def test_posts_to_generate_content_with_api_key_header() -> None:
    seen: list[httpx.Request] = []

    def handle(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        body = {"candidates": [{"content": {"parts": [{"text": "hi"}]}, "finishReason": "STOP"}]}
        return httpx.Response(200, json=body)

    client = make_client(httpx.MockTransport(handle))
    reply = await client.generate({"contents": []})
    await client.aclose()

    assert reply.text == "hi"
    request = seen[0]
    assert str(request.url) == (
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"
    )
    assert request.headers["x-goog-api-key"] == "secret-key"
    assert "key=" not in str(request.url)
    assert json.loads(request.content) == {"contents": []}


@pytest.mark.parametrize("status", [400, 403, 429, 500, 503])
async def test_error_status_is_unavailable(status: int) -> None:
    client = make_client(httpx.MockTransport(lambda _: httpx.Response(status, json={})))

    with pytest.raises(AiUnavailableError):
        await client.generate({})


async def test_timeout_is_unavailable() -> None:
    def handle(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("slow", request=request)

    client = make_client(httpx.MockTransport(handle))

    with pytest.raises(AiUnavailableError):
        await client.generate({})


async def test_connection_error_is_unavailable() -> None:
    def handle(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("refused", request=request)

    client = make_client(httpx.MockTransport(handle))

    with pytest.raises(AiUnavailableError):
        await client.generate({})


@pytest.mark.parametrize("content", [b"not json", b"[1, 2]"])
async def test_non_object_body_is_unavailable(content: bytes) -> None:
    client = make_client(httpx.MockTransport(lambda _: httpx.Response(200, content=content)))

    with pytest.raises(AiUnavailableError):
        await client.generate({})
