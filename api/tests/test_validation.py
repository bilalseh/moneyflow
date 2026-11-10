"""Every limit in the contract, enforced as 422 invalid_request."""

from collections.abc import Callable
from typing import Any

import pytest
from fastapi.testclient import TestClient

from tests import payloads
from tests.conftest import ALICE

Mutation = Callable[[dict[str, Any]], None]


def factor(factor_id: str) -> dict[str, Any]:
    return {**payloads.health_tips()["factors"][0], "id": factor_id}


def tx(index: int) -> dict[str, Any]:
    return {**payloads.categorize()["transactions"][0], "id": f"row-{index}"}


def set_key(path: list[Any], value: Any) -> Mutation:
    def mutate(body: dict[str, Any]) -> None:
        target: Any = body
        for key in path[:-1]:
            target = target[key]
        target[path[-1]] = value

    return mutate


def drop_key(key: str) -> Mutation:
    return lambda body: body.pop(key)


HEALTH_TIPS_CASES: dict[str, Mutation] = {
    "locale not supported": set_key(["locale"], "fr"),
    "unknown currency": set_key(["currency"], "XYZ"),
    "score above 100": set_key(["score"], 101),
    "score as string": set_key(["score"], "62"),
    "no factors": set_key(["factors"], []),
    "five factors": set_key(["factors"], [factor("savingsRate")] * 5),
    "duplicate factor id": set_key(["factors"], [factor("savingsRate"), factor("savingsRate")]),
    "unknown factor id": set_key(["factors", 0, "id"], "netWorth"),
    "unknown status": set_key(["factors", 0, "status"], "great"),
    "healthy too long": set_key(["factors", 0, "healthy"], "x" * 61),
    "points above max": set_key(["factors", 0, "points"], 30),
    "extra key": set_key(["extra"], True),
    "missing score": drop_key("score"),
}

CATEGORIZE_CASES: dict[str, Mutation] = {
    "no transactions": set_key(["transactions"], []),
    "101 transactions": set_key(["transactions"], [tx(i) for i in range(101)]),
    "duplicate transaction ids": set_key(["transactions"], [tx(1), tx(1)]),
    "id too long": set_key(["transactions", 0, "id"], "x" * 65),
    "description too long": set_key(["transactions", 0, "description"], "x" * 201),
    "fractional amount": set_key(["transactions", 0, "amount"], 45.2),
    "unknown type": set_key(["transactions", 0, "type"], "transfer"),
    "no categories": set_key(["categories"], []),
    "unknown category": set_key(["categories"], ["groceries", "yachts"]),
    "duplicate category": set_key(["categories"], ["groceries", "groceries"]),
}

CHECKIN_CASES: dict[str, Mutation] = {
    "bad month": set_key(["month"], "2026-13"),
    "month with day": set_key(["month"], "2026-10-01"),
    "negative income": set_key(["income"], -1),
    "no categories": set_key(["categories"], []),
    "duplicate category": set_key(["categories"], [payloads.checkin()["categories"][0]] * 2),
    "eleven goals": set_key(
        ["goals"], [{**payloads.checkin()["goals"][0], "id": f"g{i}"} for i in range(11)]
    ),
    "goal name empty": set_key(["goals", 0, "name"], ""),
    "fractional scoreChange": set_key(["scoreChange"], 1.5),
    "nan-like savings rate": set_key(["savingsRate"], "NaN"),
}


def message(role: str, **fields: Any) -> dict[str, Any]:
    return {"role": role, **fields}


CALL = {"id": "c1", "name": "check_affordability", "args": {"amountMajor": 1, "month": "2027-01"}}
RESULT = {"id": "c1", "name": "check_affordability", "result": {"ok": True}}

COACH_CASES: dict[str, Mutation] = {
    "no messages": set_key(["messages"], []),
    "25 messages": set_key(["messages"], [message("user", text="hi")] * 25),
    "text too long": set_key(["messages", 0, "text"], "x" * 2001),
    "empty text": set_key(["messages", 0, "text"], ""),
    "ends with assistant": set_key(
        ["messages"], [message("user", text="hi"), message("assistant", text="hello")]
    ),
    "tool without call": set_key(
        ["messages"], [message("user", text="hi"), message("tool", toolResult=RESULT)]
    ),
    "tool id mismatch": set_key(
        ["messages"],
        [
            message("user", text="hi"),
            message("assistant", toolCall=CALL),
            message("tool", toolResult={**RESULT, "id": "c2"}),
        ],
    ),
    "tool result too large": set_key(
        ["messages"],
        [
            message("user", text="hi"),
            message("assistant", toolCall=CALL),
            message("tool", toolResult={**RESULT, "result": {"blob": "x" * 9000}}),
        ],
    ),
    "assistant with text and toolCall": set_key(
        ["messages"],
        [message("user", text="hi"), message("assistant", text="x", toolCall=CALL)],
    ),
    "unknown role": set_key(["messages", 0, "role"], "system"),
    "unknown tool": set_key(
        ["messages"],
        [
            message("user", text="hi"),
            message("assistant", toolCall={**CALL, "name": "buy_stock"}),
            message("tool", toolResult={**RESULT, "name": "buy_stock"}),
        ],
    ),
    "impossible targetDate": set_key(["context", "goals", 0, "targetDate"], "2027-02-30"),
    "negative balance": set_key(["context", "debts", 0, "balance"], -5),
    "missing context": drop_key("context"),
}

CASES = (
    [("/api/ai/health-tips", payloads.health_tips, n, m) for n, m in HEALTH_TIPS_CASES.items()]
    + [("/api/ai/categorize", payloads.categorize, n, m) for n, m in CATEGORIZE_CASES.items()]
    + [("/api/ai/checkin", payloads.checkin, n, m) for n, m in CHECKIN_CASES.items()]
    + [("/api/ai/coach", payloads.coach, n, m) for n, m in COACH_CASES.items()]
)


@pytest.mark.parametrize(
    ("path", "factory", "mutate"),
    [(path, factory, mutate) for path, factory, _, mutate in CASES],
    ids=[f"{path.rsplit('/', 1)[-1]}: {name}" for path, _, name, _ in CASES],
)
def test_invalid_bodies_are_rejected(
    client: TestClient, path: str, factory: Callable[[], dict[str, Any]], mutate: Mutation
) -> None:
    body = factory()
    mutate(body)

    response = client.post(path, json=body, headers=ALICE)

    assert response.status_code == 422, response.text
    error = response.json()["error"]
    assert error["code"] == "invalid_request"
    assert error["message"]
    assert "retryAfterSeconds" not in error


@pytest.mark.parametrize(
    ("path", "body"),
    [
        ("/api/billing/checkout", {"locale": "fr"}),
        ("/api/billing/checkout", {}),
        ("/api/billing/confirm", {"sessionId": "cs_live_abc"}),
        ("/api/billing/confirm", {"sessionId": "cs_test_../../x"}),
        ("/api/billing/confirm", {"sessionId": "cs_test_" + "a" * 201}),
    ],
)
def test_invalid_billing_bodies_are_rejected(
    client: TestClient, path: str, body: dict[str, Any]
) -> None:
    response = client.post(path, json=body, headers=ALICE)

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_request"


def test_validation_message_names_the_field(client: TestClient) -> None:
    body = payloads.health_tips()
    body["score"] = 101

    response = client.post("/api/ai/health-tips", json=body, headers=ALICE)

    assert response.json()["error"]["message"].startswith("score:")
