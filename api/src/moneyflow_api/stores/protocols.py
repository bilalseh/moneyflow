from typing import Protocol

from moneyflow_api.stores.models import BillingRecord, UsageRecord


class UsageStore(Protocol):
    async def get(self, uid: str) -> UsageRecord | None: ...

    async def increment(self, uid: str, day: str) -> int:
        """Atomically add one request for `day` (resetting on a new day); returns the count."""
        ...


class BillingStore(Protocol):
    async def get(self, uid: str) -> BillingRecord: ...

    async def save(self, uid: str, record: BillingRecord) -> None: ...


class AccountStore(Protocol):
    async def delete_account(self, uid: str) -> None:
        """Delete `users/{uid}` recursively, `billing/{uid}`, `usage/{uid}` and the auth user."""
        ...
