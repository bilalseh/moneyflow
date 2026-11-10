"""In-memory stores for tests and offline development."""

import asyncio

from moneyflow_api.stores.models import BillingRecord, UsageRecord, next_usage_count


class InMemoryUsageStore:
    def __init__(self) -> None:
        self.records: dict[str, UsageRecord] = {}
        self._lock = asyncio.Lock()

    async def get(self, uid: str) -> UsageRecord | None:
        return self.records.get(uid)

    async def increment(self, uid: str, day: str) -> int:
        async with self._lock:
            current = self.records.get(uid)
            doc = {"day": current.day, "count": current.count} if current else None
            count = next_usage_count(doc, day)
            self.records[uid] = UsageRecord(day=day, count=count)
            return count


class InMemoryBillingStore:
    def __init__(self) -> None:
        self.records: dict[str, BillingRecord] = {}

    async def get(self, uid: str) -> BillingRecord:
        return self.records.get(uid, BillingRecord())

    async def save(self, uid: str, record: BillingRecord) -> None:
        self.records[uid] = record


class InMemoryAccountStore:
    """Deletes the user's records from the companion in-memory stores."""

    def __init__(self, usage: InMemoryUsageStore, billing: InMemoryBillingStore) -> None:
        self._usage = usage
        self._billing = billing
        self.deleted_uids: list[str] = []

    async def delete_account(self, uid: str) -> None:
        self._usage.records.pop(uid, None)
        self._billing.records.pop(uid, None)
        self.deleted_uids.append(uid)
