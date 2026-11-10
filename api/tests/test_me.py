from datetime import UTC, datetime

from moneyflow_api.stores.models import BillingRecord, UsageRecord
from tests.conftest import ALICE, Harness, HarnessFactory


def test_me_for_a_new_free_user(harness: Harness) -> None:
    response = harness.client.get("/api/me", headers=ALICE)

    assert response.status_code == 200
    assert response.json() == {
        "uid": "alice",
        "plan": "free",
        "usage": {"used": 0, "limit": 20, "resetsAt": "2026-11-11T00:00:00Z"},
        "features": {"ai": True, "billing": True},
    }


def test_me_reports_todays_usage_and_pro_limit(harness: Harness) -> None:
    harness.usage_store.records["alice"] = UsageRecord(day="2026-11-10", count=3)
    harness.billing_store.records["alice"] = BillingRecord(plan="pro")

    usage = harness.client.get("/api/me", headers=ALICE).json()

    assert usage["plan"] == "pro"
    assert usage["usage"] == {"used": 3, "limit": 200, "resetsAt": "2026-11-11T00:00:00Z"}


def test_usage_from_a_previous_day_counts_as_zero(harness: Harness) -> None:
    harness.usage_store.records["alice"] = UsageRecord(day="2026-11-09", count=20)

    assert harness.client.get("/api/me", headers=ALICE).json()["usage"]["used"] == 0


def test_resets_at_is_the_next_utc_midnight(harness: Harness) -> None:
    harness.clock.now = datetime(2026, 12, 31, 23, 59, 59, tzinfo=UTC)

    usage = harness.client.get("/api/me", headers=ALICE).json()["usage"]

    assert usage["resetsAt"] == "2027-01-01T00:00:00Z"


def test_features_reflect_configuration(make_harness: HarnessFactory) -> None:
    harness = make_harness(ai_enabled=False, billing_enabled=False)

    features = harness.client.get("/api/me", headers=ALICE).json()["features"]

    assert features == {"ai": False, "billing": False}
