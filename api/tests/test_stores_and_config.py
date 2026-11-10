import logging

import pytest
from pydantic import ValidationError

from moneyflow_api.config import warn_about_rejected_keys
from moneyflow_api.stores.memory import InMemoryUsageStore
from moneyflow_api.stores.models import BillingRecord, next_usage_count
from tests.conftest import make_settings


def test_next_usage_count_starts_and_resets_per_day() -> None:
    assert next_usage_count(None, "2026-11-10") == 1
    assert next_usage_count({"day": "2026-11-10", "count": 4}, "2026-11-10") == 5
    assert next_usage_count({"day": "2026-11-09", "count": 19}, "2026-11-10") == 1
    assert next_usage_count({"day": "2026-11-10", "count": "x"}, "2026-11-10") == 1


async def test_in_memory_usage_store_increments_atomically_per_day() -> None:
    store = InMemoryUsageStore()

    assert await store.increment("u", "2026-11-10") == 1
    assert await store.increment("u", "2026-11-10") == 2
    assert await store.increment("u", "2026-11-11") == 1
    record = await store.get("u")
    assert record is not None
    assert (record.day, record.count) == ("2026-11-11", 1)


def test_billing_record_document_round_trip() -> None:
    record = BillingRecord(plan="pro", stripe_customer_id="cus_1", stripe_subscription_id="sub_1")

    doc = record.to_document()

    assert doc == {"plan": "pro", "stripeCustomerId": "cus_1", "stripeSubscriptionId": "sub_1"}
    assert BillingRecord.from_document(doc) == record
    assert BillingRecord().to_document() == {"plan": "free"}


@pytest.mark.parametrize(
    "doc", [None, {}, {"plan": "gold"}, {"plan": "pro", "stripeCustomerId": 5}]
)
def test_billing_record_from_unexpected_documents(doc: dict[str, object] | None) -> None:
    record = BillingRecord.from_document(doc)

    assert record.plan in ("free", "pro")
    assert record.stripe_customer_id is None


def test_ai_enabled_follows_the_gemini_key() -> None:
    assert make_settings().ai_enabled
    assert not make_settings(gemini_api_key="").ai_enabled
    assert not make_settings(gemini_api_key="   ").ai_enabled


@pytest.mark.parametrize(
    ("key", "enabled", "rejected"),
    [
        ("sk_test_abc", True, False),
        ("", False, False),
        ("sk_live_abc", False, True),
        ("rk_live_abc", False, True),
        ("pk_test_abc", False, True),
    ],
)
def test_only_stripe_test_keys_enable_billing(key: str, enabled: bool, rejected: bool) -> None:
    settings = make_settings(stripe_secret_key=key)

    assert settings.billing_enabled is enabled
    assert settings.stripe_key_rejected is rejected


def test_live_key_is_logged_without_leaking_it(caplog: pytest.LogCaptureFixture) -> None:
    with caplog.at_level(logging.ERROR):
        warn_about_rejected_keys(make_settings(stripe_secret_key="sk_live_supersecret"))

    assert "not a test key" in caplog.text
    assert "supersecret" not in caplog.text


def test_defaults_match_the_contract() -> None:
    settings = make_settings(free_daily_ai=20, pro_daily_ai=200)

    assert settings.gemini_model == "gemini-2.5-flash"
    assert settings.gemini_timeout_seconds == 20
    assert settings.pro_price_cents == 500
    assert settings.app_url == "https://moneyflow-coach.web.app"


def test_app_url_trailing_slash_is_removed() -> None:
    assert make_settings(app_url="http://localhost:5173/").app_url == "http://localhost:5173"


@pytest.mark.parametrize("model", ["../evil", "gemini 2.5", "a/b"])
def test_gemini_model_must_be_a_plain_name(model: str) -> None:
    with pytest.raises(ValidationError):
        make_settings(gemini_model=model)


def test_webhook_secret_is_optional() -> None:
    assert make_settings().webhook_secret == "whsec_test"
    assert make_settings(stripe_webhook_secret="").webhook_secret is None
