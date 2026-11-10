"""Test doubles. None of them touch the network."""

import json
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

from moneyflow_api.ai.gemini_format import FunctionCall, GeminiReply, JsonObject
from moneyflow_api.auth import AuthUnavailableError, CurrentUser, InvalidTokenError
from moneyflow_api.billing.gateway import (
    BillingProviderError,
    CheckoutParams,
    CheckoutSession,
    InvalidWebhookError,
    WebhookEvent,
)

VALID_SIGNATURE = "t=1,v1=valid"


def json_reply(payload: Any) -> GeminiReply:
    return GeminiReply(text=json.dumps(payload), finish_reason="STOP")


def text_reply(text: str) -> GeminiReply:
    return GeminiReply(text=text, finish_reason="STOP")


def call_reply(name: str, args: JsonObject) -> GeminiReply:
    return GeminiReply(function_calls=[FunctionCall(name=name, args=args)], finish_reason="STOP")


class FakeAiClient:
    """Returns scripted replies in order; raises if called more often than scripted."""

    def __init__(self, *replies: GeminiReply | Exception) -> None:
        self.replies: list[GeminiReply | Exception] = list(replies)
        self.bodies: list[JsonObject] = []
        self.closed = False

    def script(self, *replies: GeminiReply | Exception) -> None:
        self.replies.extend(replies)

    async def generate(self, body: JsonObject) -> GeminiReply:
        self.bodies.append(body)
        if not self.replies:
            raise AssertionError("unexpected Gemini call")
        reply = self.replies.pop(0)
        if isinstance(reply, Exception):
            raise reply
        return reply

    async def aclose(self) -> None:
        self.closed = True


class FakeTokenVerifier:
    def __init__(self) -> None:
        self.users = {
            "token-alice": CurrentUser("alice"),
            "token-bob": CurrentUser("bob"),
            "token-anon": CurrentUser("anon-1", is_anonymous=True),
        }

    async def verify(self, token: str) -> CurrentUser:
        if token == "token-certs-down":
            raise AuthUnavailableError
        user = self.users.get(token)
        if user is None:
            raise InvalidTokenError
        return user


@dataclass
class FakeBillingGateway:
    sessions: dict[str, CheckoutSession] = field(default_factory=dict)
    created: list[CheckoutParams] = field(default_factory=list)
    canceled: list[str] = field(default_factory=list)
    fail: bool = False

    async def create_checkout_session(self, params: CheckoutParams) -> CheckoutSession:
        if self.fail:
            raise BillingProviderError("down")
        self.created.append(params)
        return CheckoutSession(
            id="cs_test_new",
            status="open",
            payment_status="unpaid",
            client_reference_id=params.uid,
            customer_id=params.customer_id,
            subscription_id=None,
            url="https://checkout.stripe.com/c/pay/cs_test_new",
        )

    async def retrieve_checkout_session(self, session_id: str) -> CheckoutSession | None:
        if self.fail:
            raise BillingProviderError("down")
        return self.sessions.get(session_id)

    async def cancel_subscription(self, subscription_id: str) -> None:
        if self.fail:
            raise BillingProviderError("down")
        self.canceled.append(subscription_id)

    def construct_event(self, payload: bytes, signature: str, secret: str) -> WebhookEvent:
        if signature != VALID_SIGNATURE or not secret:
            raise InvalidWebhookError("bad signature")
        event = json.loads(payload)
        return WebhookEvent(type=event["type"], data_object=event["data"]["object"])


def paid_session(session_id: str, uid: str | None, **overrides: Any) -> CheckoutSession:
    values: dict[str, Any] = {
        "id": session_id,
        "status": "complete",
        "payment_status": "paid",
        "client_reference_id": uid,
        "customer_id": "cus_123",
        "subscription_id": "sub_123",
    }
    values.update(overrides)
    return CheckoutSession(**values)


class MutableClock:
    def __init__(self, now: datetime | None = None) -> None:
        self.now = now or datetime(2026, 11, 10, 15, 0, 0, tzinfo=UTC)

    def __call__(self) -> datetime:
        return self.now


class SteppingClock:
    """Monotonic clock for the rate limiter."""

    def __init__(self) -> None:
        self.value = 1000.0

    def __call__(self) -> float:
        return self.value
