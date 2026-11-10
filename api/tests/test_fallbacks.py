from typing import Any, get_args

import pytest

from moneyflow_api.ai.fallbacks.checkin import checkin_fallback, most_over_budget
from moneyflow_api.ai.fallbacks.coach import coach_fallback
from moneyflow_api.ai.fallbacks.health_tips import health_tips_fallback
from moneyflow_api.ai.fallbacks.labels import month_label
from moneyflow_api.schemas.checkin import CheckinRequest
from moneyflow_api.schemas.common import CategoryAmount
from moneyflow_api.schemas.health_tips import FactorId, FactorStatus, HealthTipsRequest
from tests import payloads


def tips_request(locale: str, factor: str, status: str) -> HealthTipsRequest:
    body: dict[str, Any] = {
        "locale": locale,
        "currency": "USD",
        "score": 50,
        "factors": [
            {
                "id": factor,
                "value": 0.1,
                "points": 5,
                "maxPoints": 25,
                "status": status,
                "healthy": "20% or more",
            }
        ],
    }
    return HealthTipsRequest.model_validate(body)


@pytest.mark.parametrize("locale", ["en", "ar"])
@pytest.mark.parametrize("factor", get_args(FactorId))
@pytest.mark.parametrize("status", get_args(FactorStatus))
def test_health_tip_fallback_exists_for_every_case(locale: str, factor: str, status: str) -> None:
    response = health_tips_fallback(tips_request(locale, factor, status))

    assert response.source == "fallback"
    [tip] = response.tips
    assert tip.factorId == factor
    assert 0 < len(tip.text) <= 280
    if status != "unknown":
        assert "20% or more" in tip.text


def test_health_tip_fallback_keeps_factor_order() -> None:
    request = HealthTipsRequest.model_validate(payloads.health_tips())

    response = health_tips_fallback(request)

    assert [t.factorId for t in response.tips] == ["savingsRate", "emergencyFund"]


def test_most_over_budget_ranks_by_overspend() -> None:
    categories = [
        CategoryAmount(categoryId="dining", planned=20000, actual=31000),
        CategoryAmount(categoryId="shopping", planned=15000, actual=40000),
        CategoryAmount(categoryId="transport", planned=10000, actual=12000),
        CategoryAmount(categoryId="groceries", planned=60000, actual=52000),
    ]

    ranked = most_over_budget(categories)

    assert [c.categoryId for c in ranked] == ["shopping", "dining"]


def test_checkin_fallback_in_english() -> None:
    response = checkin_fallback(CheckinRequest.model_validate(payloads.checkin()))

    assert response.source == "fallback"
    assert response.summary.startswith("In October 2026, your income was 4,200.00 USD")
    assert "3,510.00 USD" in response.summary
    assert "16.4%" in response.summary
    assert "went up by 4 points" in response.summary
    assert "Shopping and Dining out went over plan" in response.summary
    assert [(a.categoryId, a.changePercent) for a in response.adjustments] == [
        ("shopping", -10),
        ("dining", -10),
    ]
    assert [a.id for a in response.adjustments] == ["a1", "a2"]
    assert [q.id for q in response.questions] == ["q1", "q2"]
    assert response.highlights[0] == "Shopping: 400.00 USD spent against 150.00 USD planned."
    assert "Car is behind plan, now projected for March 2028." in response.highlights


def test_checkin_fallback_in_arabic() -> None:
    response = checkin_fallback(CheckinRequest.model_validate(payloads.checkin("ar")))

    assert response.summary.startswith("في أكتوبر 2026")
    assert "التسوق" in response.summary
    assert len(response.questions) == 2


def test_checkin_fallback_when_everything_is_within_plan() -> None:
    body = payloads.checkin()
    body["categories"] = [{"categoryId": "dining", "planned": 20000, "actual": 20000}]
    body["scoreChange"] = -3
    body["goals"] = []

    response = checkin_fallback(CheckinRequest.model_validate(body))

    assert response.adjustments == []
    assert response.highlights == []
    assert "Every category stayed within plan" in response.summary
    assert "went down by 3 points" in response.summary


def test_checkin_fallback_caps_highlights() -> None:
    body = payloads.checkin()
    body["goals"] = [
        {"id": f"g{i}", "name": f"Goal {i}", "target": 1, "saved": 0, "onTrack": True}
        for i in range(10)
    ]

    response = checkin_fallback(CheckinRequest.model_validate(body))

    assert len(response.highlights) == 4


@pytest.mark.parametrize("locale", ["en", "ar"])
def test_coach_fallbacks_point_to_the_simulator(locale: str) -> None:
    unavailable = coach_fallback(locale, "unavailable")  # type: ignore[arg-type]
    invalid = coach_fallback(locale, "invalid")  # type: ignore[arg-type]

    assert unavailable.source == invalid.source == "fallback"
    assert unavailable.refusal is False
    assert unavailable.text != invalid.text
    marker = "simulator" if locale == "en" else "المحاكي"
    assert marker in unavailable.text
    assert marker in invalid.text


def test_month_label() -> None:
    assert month_label("2026-01", "en") == "January 2026"
    assert month_label("2026-12", "ar") == "ديسمبر 2026"
