"""Shared field types and base models. Field names mirror the contract (camelCase)."""

import json
from collections.abc import Hashable, Iterable
from datetime import date
from typing import Annotated, Any, Literal

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, StringConstraints

Locale = Literal["en", "ar"]
Source = Literal["ai", "fallback"]
Plan = Literal["free", "pro"]

CurrencyCode = Literal[
    "USD", "EUR", "GBP", "LBP", "AED", "SAR", "JOD", "KWD", "EGP", "TRY", "CAD", "AUD"
]  # fmt: skip

CategoryId = Literal[
    "housing", "utilities", "groceries", "transport", "health", "insurance", "education",
    "debt", "dining", "shopping", "entertainment", "travel", "subscriptions", "personal",
    "gifts", "savings", "income", "other",
]  # fmt: skip

MAX_MINOR = 10**15
MAX_JSON_BYTES = 8 * 1024


def _real_date(value: str) -> str:
    date.fromisoformat(value)
    return value


def json_size(value: Any) -> int:
    return len(json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode("utf-8"))


def _json_size_limited(value: dict[str, Any]) -> dict[str, Any]:
    if json_size(value) > MAX_JSON_BYTES:
        raise ValueError(f"must be at most {MAX_JSON_BYTES} bytes when serialized")
    return value


MonthKey = Annotated[str, StringConstraints(pattern=r"^\d{4}-(0[1-9]|1[0-2])$")]
DateKey = Annotated[
    str,
    StringConstraints(pattern=r"^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$"),
    AfterValidator(_real_date),
]
Identifier = Annotated[str, StringConstraints(min_length=1, max_length=64)]
DisplayName = Annotated[str, StringConstraints(min_length=1, max_length=100)]
Minor = Annotated[int, Field(ge=0, le=MAX_MINOR)]
SignedMinor = Annotated[int, Field(ge=-MAX_MINOR, le=MAX_MINOR)]
Ratio = Annotated[float, Field(ge=-1000, le=1000, allow_inf_nan=False)]
JsonObject = Annotated[dict[str, Any], AfterValidator(_json_size_limited)]


class RequestModel(BaseModel):
    """Base for request bodies: unknown keys and type coercion are rejected."""

    model_config = ConfigDict(extra="forbid", strict=True)


class ResponseModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class CategoryAmount(RequestModel):
    categoryId: CategoryId
    planned: Minor
    actual: Minor


def ensure_unique(values: Iterable[Hashable], what: str) -> None:
    seen: set[Hashable] = set()
    for value in values:
        if value in seen:
            raise ValueError(f"duplicate {what}: {value}")
        seen.add(value)
