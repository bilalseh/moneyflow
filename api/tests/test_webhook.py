import hashlib
import hmac
import json
import time
from typing import Any

import pytest

from moneyflow_api.billing.gateway import InvalidWebhookError, StripeGateway
from moneyflow_api.stores.models import BillingRecord
from tests.conftest import Harness, HarnessFactory
from tests.fakes import VALID_SIGNATURE

URL = "/api/billing/webhook"


def event(event_type: str, data_object: dict[str, Any]) -> bytes:
    return json.dumps(
        {"id": "evt_1", "object": "event", "type": event_type, "data": {"object": data_object}}
    ).encode()


def post(harness: Harness, payload: bytes, signature: str | None = VALID_SIGNATURE) -> Any:
    headers = {"Content-Type": "application/json"}
    if signature is not None:
        headers["Stripe-Signature"] = signature
    return harness.client.post(URL, content=payload, headers=headers)


def test_checkout_completed_sets_pro(harness: Harness) -> None:
    payload = event(
        "checkout.session.completed",
        {
            "client_reference_id": "alice",
            "payment_status": "paid",
            "customer": "cus_1",
            "subscription": "sub_1",
        },
    )

    response = post(harness, payload)

    assert response.status_code == 200
    assert response.json() == {"received": True}
    assert harness.billing_store.records["alice"] == BillingRecord(
        plan="pro", stripe_customer_id="cus_1", stripe_subscription_id="sub_1"
    )


def test_unpaid_checkout_is_ignored(harness: Harness) -> None:
    payload = event(
        "checkout.session.completed", {"client_reference_id": "alice", "payment_status": "unpaid"}
    )

    post(harness, payload)

    assert "alice" not in harness.billing_store.records


def test_subscription_deleted_sets_free(harness: Harness) -> None:
    harness.billing_store.records["alice"] = BillingRecord(
        plan="pro", stripe_customer_id="cus_1", stripe_subscription_id="sub_1"
    )

    post(
        harness,
        event("customer.subscription.deleted", {"id": "sub_1", "metadata": {"uid": "alice"}}),
    )

    assert harness.billing_store.records["alice"] == BillingRecord(
        plan="free", stripe_customer_id="cus_1"
    )


@pytest.mark.parametrize(
    "data_object",
    [{"id": "sub_old", "metadata": {"uid": "alice"}}, {"id": "sub_1", "metadata": {}}],
)
def test_stale_or_anonymous_deletions_are_ignored(
    harness: Harness, data_object: dict[str, Any]
) -> None:
    harness.billing_store.records["alice"] = BillingRecord(
        plan="pro", stripe_subscription_id="sub_1"
    )

    post(harness, event("customer.subscription.deleted", data_object))

    assert harness.billing_store.records["alice"].plan == "pro"


def test_unknown_events_are_acknowledged(harness: Harness) -> None:
    assert post(harness, event("invoice.paid", {})).status_code == 200


@pytest.mark.parametrize("signature", ["t=1,v1=forged", "", None])
def test_bad_or_missing_signature_is_400(harness: Harness, signature: str | None) -> None:
    response = post(harness, event("checkout.session.completed", {}), signature)

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "invalid_signature"


def test_missing_webhook_secret_is_503(make_harness: HarnessFactory) -> None:
    harness = make_harness(stripe_webhook_secret="")

    response = post(harness, event("invoice.paid", {}))

    assert response.status_code == 503
    assert response.json()["error"]["code"] == "billing_not_configured"


def sign(payload: bytes, secret: str, timestamp: int) -> str:
    signed = f"{timestamp}.".encode() + payload
    digest = hmac.new(secret.encode(), signed, hashlib.sha256).hexdigest()
    return f"t={timestamp},v1={digest}"


def test_stripe_gateway_verifies_real_signatures_offline() -> None:
    gateway = StripeGateway("sk_test_123")
    payload = event("checkout.session.completed", {"client_reference_id": "alice"})
    now = int(time.time())

    parsed = gateway.construct_event(payload, sign(payload, "whsec_abc", now), "whsec_abc")

    assert parsed.type == "checkout.session.completed"
    assert parsed.data_object["client_reference_id"] == "alice"
    with pytest.raises(InvalidWebhookError):
        gateway.construct_event(payload, sign(payload, "whsec_other", now), "whsec_abc")
    with pytest.raises(InvalidWebhookError):
        gateway.construct_event(payload, sign(payload, "whsec_abc", now - 3600), "whsec_abc")
    with pytest.raises(InvalidWebhookError):
        gateway.construct_event(b"not json", sign(b"not json", "whsec_abc", now), "whsec_abc")
