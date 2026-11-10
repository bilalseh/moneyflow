from moneyflow_api.stores.models import BillingRecord, UsageRecord
from tests.conftest import ALICE, Harness, HarnessFactory


def test_delete_account_removes_everything(harness: Harness) -> None:
    harness.usage_store.records["alice"] = UsageRecord(day="2026-11-10", count=3)
    harness.billing_store.records["alice"] = BillingRecord(
        plan="pro", stripe_customer_id="cus_1", stripe_subscription_id="sub_1"
    )
    harness.usage_store.records["bob"] = UsageRecord(day="2026-11-10", count=1)

    response = harness.client.delete("/api/account", headers=ALICE)

    assert response.status_code == 204
    assert response.content == b""
    assert harness.billing.canceled == ["sub_1"]
    assert harness.account_store.deleted_uids == ["alice"]
    assert "alice" not in harness.usage_store.records
    assert "alice" not in harness.billing_store.records
    assert "bob" in harness.usage_store.records


def test_delete_account_without_subscription_skips_stripe(harness: Harness) -> None:
    response = harness.client.delete("/api/account", headers=ALICE)

    assert response.status_code == 204
    assert harness.billing.canceled == []
    assert harness.account_store.deleted_uids == ["alice"]


def test_delete_account_works_when_billing_is_off(make_harness: HarnessFactory) -> None:
    harness = make_harness(billing_enabled=False)
    harness.billing_store.records["alice"] = BillingRecord(plan="pro", stripe_subscription_id="s")

    assert harness.client.delete("/api/account", headers=ALICE).status_code == 204
    assert harness.account_store.deleted_uids == ["alice"]


def test_stripe_failure_keeps_the_data(harness: Harness) -> None:
    harness.billing_store.records["alice"] = BillingRecord(plan="pro", stripe_subscription_id="s")
    harness.billing.fail = True

    response = harness.client.delete("/api/account", headers=ALICE)

    assert response.status_code == 502
    assert harness.account_store.deleted_uids == []
