"""Thin wrapper over the official `stripe` package.

The rest of the app sees plain dataclasses, so tests use a fake gateway and never
touch the network. The wrapper refuses to start with anything but a test key.
"""

from dataclasses import dataclass
from typing import Any, Protocol

import stripe
from starlette.concurrency import run_in_threadpool

from moneyflow_api.config import STRIPE_TEST_KEY_PREFIX


class BillingProviderError(Exception):
    """Stripe failed or rejected a request."""


class InvalidWebhookError(Exception):
    """Bad payload or signature on a webhook delivery."""


@dataclass(frozen=True)
class CheckoutParams:
    uid: str
    price_cents: int
    product_name: str
    success_url: str
    cancel_url: str
    locale: str
    customer_id: str | None = None


@dataclass(frozen=True)
class CheckoutSession:
    id: str
    status: str | None
    payment_status: str | None
    client_reference_id: str | None
    customer_id: str | None
    subscription_id: str | None
    url: str | None = None


@dataclass(frozen=True)
class WebhookEvent:
    type: str
    data_object: dict[str, Any]


class BillingGateway(Protocol):
    async def create_checkout_session(self, params: CheckoutParams) -> CheckoutSession: ...

    async def retrieve_checkout_session(self, session_id: str) -> CheckoutSession | None: ...

    async def cancel_subscription(self, subscription_id: str) -> None: ...

    def construct_event(self, payload: bytes, signature: str, secret: str) -> WebhookEvent: ...


def _id_of(value: Any) -> str | None:
    if isinstance(value, str):
        return value
    identifier = getattr(value, "id", None)
    return identifier if isinstance(identifier, str) else None


def _to_session(session: Any) -> CheckoutSession:
    return CheckoutSession(
        id=session.id,
        status=session.status,
        payment_status=session.payment_status,
        client_reference_id=session.client_reference_id,
        customer_id=_id_of(session.customer),
        subscription_id=_id_of(session.subscription),
        url=session.url,
    )


def checkout_session_params(params: CheckoutParams) -> dict[str, Any]:
    body: dict[str, Any] = {
        "mode": "subscription",
        "line_items": [
            {
                "quantity": 1,
                "price_data": {
                    "currency": "usd",
                    "unit_amount": params.price_cents,
                    "recurring": {"interval": "month"},
                    "product_data": {"name": params.product_name},
                },
            }
        ],
        "client_reference_id": params.uid,
        "metadata": {"uid": params.uid},
        "subscription_data": {"metadata": {"uid": params.uid}},
        "success_url": params.success_url,
        "cancel_url": params.cancel_url,
        "locale": params.locale,
    }
    if params.customer_id:
        body["customer"] = params.customer_id
    return body


class StripeGateway:
    def __init__(self, api_key: str) -> None:
        if not api_key.startswith(STRIPE_TEST_KEY_PREFIX):
            raise ValueError("Only Stripe test keys (sk_test_...) are allowed")
        self._client = stripe.StripeClient(api_key, max_network_retries=2)

    async def create_checkout_session(self, params: CheckoutParams) -> CheckoutSession:
        body = checkout_session_params(params)
        try:
            session = await run_in_threadpool(
                self._client.v1.checkout.sessions.create,
                params=body,  # type: ignore[arg-type]
            )
        except stripe.StripeError as exc:
            raise BillingProviderError(type(exc).__name__) from exc
        return _to_session(session)

    async def retrieve_checkout_session(self, session_id: str) -> CheckoutSession | None:
        try:
            session = await run_in_threadpool(
                self._client.v1.checkout.sessions.retrieve, session_id
            )
        except stripe.InvalidRequestError:
            return None
        except stripe.StripeError as exc:
            raise BillingProviderError(type(exc).__name__) from exc
        return _to_session(session)

    async def cancel_subscription(self, subscription_id: str) -> None:
        try:
            await run_in_threadpool(self._client.v1.subscriptions.cancel, subscription_id)
        except stripe.InvalidRequestError:
            return  # already canceled or unknown: the goal state is reached
        except stripe.StripeError as exc:
            raise BillingProviderError(type(exc).__name__) from exc

    def construct_event(self, payload: bytes, signature: str, secret: str) -> WebhookEvent:
        try:
            event = stripe.Webhook.construct_event(payload, signature, secret)
        except (ValueError, stripe.SignatureVerificationError) as exc:
            raise InvalidWebhookError(type(exc).__name__) from exc
        data_object = event.data.object
        as_dict = data_object.to_dict() if hasattr(data_object, "to_dict") else dict(data_object)
        return WebhookEvent(type=event.type, data_object=as_dict)
