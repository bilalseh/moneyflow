import pytest

from moneyflow_api.billing.gateway import CheckoutParams, StripeGateway, checkout_session_params
from moneyflow_api.stores.models import BillingRecord
from tests.conftest import ALICE, Harness, HarnessFactory
from tests.fakes import paid_session

BILLING_CALLS = [
    ("/api/billing/checkout", {"locale": "en"}),
    ("/api/billing/confirm", {"sessionId": "cs_test_abc"}),
    ("/api/billing/cancel", None),
    ("/api/billing/webhook", {}),
]


@pytest.mark.parametrize(("path", "body"), BILLING_CALLS)
def test_billing_routes_are_503_without_a_test_key(
    make_harness: HarnessFactory, path: str, body: dict[str, str] | None
) -> None:
    harness = make_harness(billing_enabled=False)

    response = harness.client.post(path, json=body, headers=ALICE)

    assert response.status_code == 503
    assert response.json()["error"]["code"] == "billing_not_configured"


def test_stripe_gateway_refuses_live_keys() -> None:
    with pytest.raises(ValueError, match="test keys"):
        StripeGateway("sk_live_123")


def test_checkout_creates_a_test_mode_subscription_session(harness: Harness) -> None:
    response = harness.client.post("/api/billing/checkout", json={"locale": "en"}, headers=ALICE)

    assert response.status_code == 200
    assert response.json() == {"url": "https://checkout.stripe.com/c/pay/cs_test_new"}
    [params] = harness.billing.created
    assert params == CheckoutParams(
        uid="alice",
        price_cents=500,
        product_name="Moneyflow Pro (test mode)",
        success_url="https://moneyflow-coach.web.app/app/billing/success?session_id={CHECKOUT_SESSION_ID}",
        cancel_url="https://moneyflow-coach.web.app/pricing",
        locale="en",
        customer_id=None,
    )


def test_checkout_reuses_the_stored_customer(harness: Harness) -> None:
    harness.billing_store.records["alice"] = BillingRecord(stripe_customer_id="cus_old")

    harness.client.post("/api/billing/checkout", json={"locale": "ar"}, headers=ALICE)

    assert harness.billing.created[0].customer_id == "cus_old"
    assert harness.billing.created[0].locale == "auto"


def test_checkout_session_params_match_the_contract() -> None:
    params = CheckoutParams(
        uid="alice",
        price_cents=500,
        product_name="Moneyflow Pro (test mode)",
        success_url="s",
        cancel_url="c",
        locale="en",
        customer_id="cus_1",
    )

    body = checkout_session_params(params)

    assert body["mode"] == "subscription"
    assert body["client_reference_id"] == "alice"
    assert body["customer"] == "cus_1"
    assert body["line_items"] == [
        {
            "quantity": 1,
            "price_data": {
                "currency": "usd",
                "unit_amount": 500,
                "recurring": {"interval": "month"},
                "product_data": {"name": "Moneyflow Pro (test mode)"},
            },
        }
    ]
    assert body["subscription_data"] == {"metadata": {"uid": "alice"}}
    assert "customer" not in checkout_session_params(CheckoutParams("u", 500, "p", "s", "c", "en"))


def test_confirm_upgrades_to_pro(harness: Harness) -> None:
    harness.billing.sessions["cs_test_ok"] = paid_session("cs_test_ok", "alice")

    response = harness.client.post(
        "/api/billing/confirm", json={"sessionId": "cs_test_ok"}, headers=ALICE
    )

    assert response.json() == {"plan": "pro"}
    assert harness.billing_store.records["alice"] == BillingRecord(
        plan="pro", stripe_customer_id="cus_123", stripe_subscription_id="sub_123"
    )
    assert harness.client.get("/api/me", headers=ALICE).json()["usage"]["limit"] == 200


@pytest.mark.parametrize(
    "session",
    [
        None,
        paid_session("cs_test_x", "bob"),
        paid_session("cs_test_x", "alice", status="open"),
        paid_session("cs_test_x", "alice", payment_status="unpaid"),
        paid_session("cs_test_x", None),
    ],
)
def test_confirm_is_404_unless_complete_paid_and_owned(harness: Harness, session: object) -> None:
    if session is not None:
        harness.billing.sessions["cs_test_x"] = session  # type: ignore[assignment]

    response = harness.client.post(
        "/api/billing/confirm", json={"sessionId": "cs_test_x"}, headers=ALICE
    )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"
    assert "alice" not in harness.billing_store.records


def test_cancel_cancels_the_subscription_and_downgrades(harness: Harness) -> None:
    harness.billing_store.records["alice"] = BillingRecord(
        plan="pro", stripe_customer_id="cus_1", stripe_subscription_id="sub_1"
    )

    response = harness.client.post("/api/billing/cancel", headers=ALICE)

    assert response.json() == {"plan": "free"}
    assert harness.billing.canceled == ["sub_1"]
    assert harness.billing_store.records["alice"] == BillingRecord(
        plan="free", stripe_customer_id="cus_1"
    )


def test_cancel_without_subscription_is_a_no_op(harness: Harness) -> None:
    response = harness.client.post("/api/billing/cancel", headers=ALICE)

    assert response.json() == {"plan": "free"}
    assert harness.billing.canceled == []


@pytest.mark.parametrize(
    ("path", "body"), [("/api/billing/checkout", {"locale": "en"}), ("/api/billing/cancel", None)]
)
def test_provider_errors_are_502(harness: Harness, path: str, body: dict[str, str] | None) -> None:
    harness.billing_store.records["alice"] = BillingRecord(plan="pro", stripe_subscription_id="s")
    harness.billing.fail = True

    response = harness.client.post(path, json=body, headers=ALICE)

    assert response.status_code == 502
    assert response.json()["error"]["code"] == "billing_error"
