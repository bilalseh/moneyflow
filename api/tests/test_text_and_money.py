from decimal import Decimal

import pytest

from moneyflow_api.ai.text import ELLIPSIS, allowed_numbers, clip, numbers_in, unknown_numbers
from moneyflow_api.money import format_bps, format_decimal, format_minor, format_percent


def test_clip_keeps_short_text() -> None:
    assert clip("  short  ", 10) == "short"


def test_clip_cuts_at_word_boundary_and_respects_limit() -> None:
    text = "one two three four five six seven"
    clipped = clip(text, 16)

    assert clipped == "one two three" + ELLIPSIS
    assert len(clipped) <= 16


def test_clip_hard_cuts_a_single_long_word() -> None:
    clipped = clip("x" * 50, 10)

    assert clipped == "x" * 9 + ELLIPSIS


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("Save 20% or more", [Decimal(20)]),
        ("2.4 months and 3 to 6", [Decimal("2.4"), Decimal(3), Decimal(6)]),
        ("You spent 3,510.00 USD", [Decimal(3510)]),
        ("rate 0,12", [Decimal("0.12")]),
        ("\u0662\u0660\u066a \u0623\u0648 \u0623\u0643\u062b\u0631", [Decimal(20)]),
        ("\u0662\u066b\u0664 \u0623\u0634\u0647\u0631", [Decimal("2.4")]),
        ("no digits here", []),
    ],
)
def test_numbers_in(text: str, expected: list[Decimal]) -> None:
    assert numbers_in(text) == expected


def test_unknown_numbers_compares_by_value() -> None:
    allowed = allowed_numbers([62, "12%", 0.12, "20% or more"])

    assert unknown_numbers("Your score is 62 and you save 12.0%, aim for 20%.", allowed) == []
    assert unknown_numbers("Save 15% more", allowed) == [Decimal(15)]


@pytest.mark.parametrize(
    ("amount", "currency", "expected"),
    [
        (351000, "USD", "3,510.00 USD"),
        (5, "USD", "0.05 USD"),
        (-4520, "EUR", "-45.20 EUR"),
        (1234567, "JOD", "1,234.567 JOD"),
        (150000, "LBP", "150,000 LBP"),
        (0, "KWD", "0.000 KWD"),
    ],
)
def test_format_minor(amount: int, currency: str, expected: str) -> None:
    assert format_minor(amount, currency) == expected


@pytest.mark.parametrize(
    ("ratio", "expected"),
    [(0.164, "16.4%"), (0.12, "12%"), (0.2, "20%"), (-0.05, "-5%"), (0.1234, "12.3%")],
)
def test_format_percent(ratio: float, expected: str) -> None:
    assert format_percent(ratio) == expected


def test_format_bps_and_decimal() -> None:
    assert format_bps(2400) == "24%"
    assert format_bps(1999) == "20%"
    assert format_decimal(2.43) == "2.4"
    assert format_decimal(3.0) == "3"
