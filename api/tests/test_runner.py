import pytest
from pydantic import BaseModel

from moneyflow_api.ai.client import AiInvalidOutputError, AiUnavailableError
from moneyflow_api.ai.gemini_format import GeminiReply
from moneyflow_api.ai.runner import generate_validated, parse_json_reply
from tests.fakes import FakeAiClient, json_reply, text_reply


class Answer(BaseModel):
    value: int


def parse(reply: GeminiReply) -> Answer:
    return parse_json_reply(reply, Answer)


def test_parse_json_reply_accepts_plain_and_fenced_json() -> None:
    assert parse(text_reply('{"value": 1}')).value == 1
    assert parse(text_reply('```json\n{"value": 2}\n```')).value == 2


@pytest.mark.parametrize(
    "reply",
    [
        GeminiReply(),
        GeminiReply(block_reason="SAFETY"),
        text_reply("not json"),
        text_reply('{"value": "many"}'),
        text_reply("[1]"),
    ],
)
def test_parse_json_reply_rejects_bad_output(reply: GeminiReply) -> None:
    with pytest.raises(AiInvalidOutputError):
        parse(reply)


async def test_first_valid_reply_wins() -> None:
    client = FakeAiClient(json_reply({"value": 7}))

    result = await generate_validated(client, {"b": 1}, parse, task="t")

    assert result.value == 7
    assert len(client.bodies) == 1


async def test_retries_once_after_invalid_output() -> None:
    client = FakeAiClient(text_reply("oops"), json_reply({"value": 8}))

    result = await generate_validated(client, {"b": 1}, parse, task="t")

    assert result.value == 8
    assert client.bodies == [{"b": 1}, {"b": 1}]


async def test_gives_up_after_two_invalid_outputs() -> None:
    client = FakeAiClient(text_reply("oops"), text_reply("again"), json_reply({"value": 9}))

    with pytest.raises(AiInvalidOutputError):
        await generate_validated(client, {}, parse, task="t")
    assert len(client.bodies) == 2


async def test_unavailable_propagates_without_retry() -> None:
    client = FakeAiClient(AiUnavailableError("down"), json_reply({"value": 1}))

    with pytest.raises(AiUnavailableError):
        await generate_validated(client, {}, parse, task="t")
    assert len(client.bodies) == 1
