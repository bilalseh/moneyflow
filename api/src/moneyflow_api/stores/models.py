from dataclasses import dataclass
from typing import Any

from moneyflow_api.schemas.common import Plan


@dataclass(frozen=True)
class UsageRecord:
    day: str
    count: int


@dataclass(frozen=True)
class BillingRecord:
    plan: Plan = "free"
    stripe_customer_id: str | None = None
    stripe_subscription_id: str | None = None

    def to_document(self) -> dict[str, Any]:
        """Firestore shape without `updatedAt`, which the store adds on write."""
        doc: dict[str, Any] = {"plan": self.plan}
        if self.stripe_customer_id:
            doc["stripeCustomerId"] = self.stripe_customer_id
        if self.stripe_subscription_id:
            doc["stripeSubscriptionId"] = self.stripe_subscription_id
        return doc

    @classmethod
    def from_document(cls, doc: dict[str, Any] | None) -> "BillingRecord":
        if not doc:
            return cls()
        plan: Plan = "pro" if doc.get("plan") == "pro" else "free"
        customer = doc.get("stripeCustomerId")
        subscription = doc.get("stripeSubscriptionId")
        return cls(
            plan=plan,
            stripe_customer_id=customer if isinstance(customer, str) else None,
            stripe_subscription_id=subscription if isinstance(subscription, str) else None,
        )


def next_usage_count(current: dict[str, Any] | None, day: str) -> int:
    """The count after one more request on `day`; a new UTC day starts again at 1."""
    if not current or current.get("day") != day:
        return 1
    count = current.get("count")
    return (count if isinstance(count, int) and count >= 0 else 0) + 1
