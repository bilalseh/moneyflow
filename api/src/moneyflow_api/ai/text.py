"""Deterministic text checks applied to model output."""

import re
from collections.abc import Iterable
from decimal import Decimal, InvalidOperation

ELLIPSIS = "…"

_DIGIT_TRANSLATION = str.maketrans(
    "\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669"  # Arabic-Indic digits
    "\u06f0\u06f1\u06f2\u06f3\u06f4\u06f5\u06f6\u06f7\u06f8\u06f9"  # Extended (Persian) digits
    "\u066b\u066c",  # Arabic decimal and thousands separators
    "0123456789" "0123456789" ".,",
)  # fmt: skip
_NUMBER = re.compile(r"\d+(?:[.,]\d+)*")
_THOUSANDS_GROUP = re.compile(r"^\d{1,3}(?:,\d{3})+(?:\.\d+)?$")


def clip(text: str, limit: int) -> str:
    """Shorten `text` to at most `limit` characters, cutting at a word boundary."""
    text = text.strip()
    if len(text) <= limit:
        return text
    cut = text[: limit - 1]
    space = cut.rfind(" ")
    if space >= limit // 2:
        cut = cut[:space]
    return cut.rstrip(" ,;:.") + ELLIPSIS


def normalize_digits(text: str) -> str:
    """Map Arabic-Indic and Persian digits and separators to ASCII."""
    return text.translate(_DIGIT_TRANSLATION)


def _to_decimal(token: str) -> Decimal | None:
    # "1,000" groups thousands; any other comma is a decimal separator ("0,5").
    token = token.replace(",", "") if _THOUSANDS_GROUP.match(token) else token.replace(",", ".")
    try:
        return Decimal(token).normalize()
    except InvalidOperation:
        return None


def numbers_in(text: str) -> list[Decimal]:
    found: list[Decimal] = []
    for token in _NUMBER.findall(normalize_digits(text)):
        value = _to_decimal(token)
        if value is not None:
            found.append(value)
    return found


def allowed_numbers(sources: Iterable[str | float | int]) -> set[Decimal]:
    """Every number that appears in the given values, as normalized decimals."""
    allowed: set[Decimal] = set()
    for source in sources:
        allowed.update(numbers_in(str(source)))
    return allowed


def unknown_numbers(text: str, allowed: set[Decimal]) -> list[Decimal]:
    """Numbers in `text` that were not provided to the model."""
    return [number for number in numbers_in(text) if number not in allowed]
