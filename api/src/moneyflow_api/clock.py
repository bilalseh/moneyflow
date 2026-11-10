"""UTC time helpers. Quota days roll over at UTC midnight."""

import math
from collections.abc import Callable
from datetime import UTC, datetime, time, timedelta

Clock = Callable[[], datetime]


def utc_now() -> datetime:
    return datetime.now(UTC)


def utc_day(moment: datetime) -> str:
    return moment.astimezone(UTC).date().isoformat()


def next_utc_midnight(moment: datetime) -> datetime:
    tomorrow = moment.astimezone(UTC).date() + timedelta(days=1)
    return datetime.combine(tomorrow, time.min, tzinfo=UTC)


def seconds_until_next_utc_midnight(moment: datetime) -> int:
    remaining = (next_utc_midnight(moment) - moment).total_seconds()
    return max(1, math.ceil(remaining))


def iso_utc(moment: datetime) -> str:
    return moment.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
