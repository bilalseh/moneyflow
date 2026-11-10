"""Deterministic formatting of server-provided numbers for prompts and fallbacks.

Formatting is not math: amounts are only shifted by the currency's minor units
so the model can restate them verbatim instead of converting them itself.
"""

from decimal import ROUND_HALF_UP, Decimal

MINOR_UNITS: dict[str, int] = {
    "USD": 2,
    "EUR": 2,
    "GBP": 2,
    "LBP": 0,
    "AED": 2,
    "SAR": 2,
    "JOD": 3,
    "KWD": 3,
    "EGP": 2,
    "TRY": 2,
    "CAD": 2,
    "AUD": 2,
}


def format_minor(amount: int, currency: str) -> str:
    """Format integer minor units, e.g. 351000 USD -> "3,510.00 USD"."""
    digits = MINOR_UNITS[currency]
    major = Decimal(amount).scaleb(-digits)
    return f"{major:,.{digits}f} {currency}"


def format_percent(ratio: float) -> str:
    """Format a ratio as a percent with at most one decimal, e.g. 0.164 -> "16.4%"."""
    value = (Decimal(str(ratio)) * 100).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)
    text = f"{value:f}"
    if text.endswith(".0"):
        text = text[:-2]
    return f"{text}%"


def format_bps(bps: int) -> str:
    """Format basis points as a percent, e.g. 2400 -> "24%"."""
    return format_percent(bps / 10_000)


def format_decimal(value: float) -> str:
    """Format a plain number with at most one decimal, e.g. 2.43 -> "2.4"."""
    rounded = Decimal(str(value)).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)
    text = f"{rounded:f}"
    return text[:-2] if text.endswith(".0") else text
