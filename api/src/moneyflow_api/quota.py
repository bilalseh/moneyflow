"""Daily AI quota per user, by plan, resetting at UTC midnight."""

from dataclasses import dataclass
from datetime import datetime

from moneyflow_api.clock import Clock, next_utc_midnight, seconds_until_next_utc_midnight, utc_day
from moneyflow_api.config import Settings
from moneyflow_api.errors import ApiError
from moneyflow_api.schemas.common import Plan
from moneyflow_api.stores.protocols import BillingStore, UsageStore


@dataclass(frozen=True)
class UsageSnapshot:
    plan: Plan
    used: int
    limit: int
    resets_at: datetime


class QuotaService:
    def __init__(
        self, usage: UsageStore, billing: BillingStore, settings: Settings, clock: Clock
    ) -> None:
        self._usage = usage
        self._billing = billing
        self._settings = settings
        self._clock = clock

    def limit_for(self, plan: Plan) -> int:
        return self._settings.pro_daily_ai if plan == "pro" else self._settings.free_daily_ai

    async def snapshot(self, uid: str) -> UsageSnapshot:
        now = self._clock()
        plan = (await self._billing.get(uid)).plan
        record = await self._usage.get(uid)
        used = record.count if record and record.day == utc_day(now) else 0
        return UsageSnapshot(
            plan=plan, used=used, limit=self.limit_for(plan), resets_at=next_utc_midnight(now)
        )

    async def ensure_available(self, uid: str) -> None:
        """Raise 429 quota_exceeded when today's allowance is used up."""
        snapshot = await self.snapshot(uid)
        if snapshot.used >= snapshot.limit:
            raise ApiError.quota_exceeded(seconds_until_next_utc_midnight(self._clock()))

    async def record(self, uid: str) -> None:
        await self._usage.increment(uid, utc_day(self._clock()))
