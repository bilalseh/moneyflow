"""Valid request bodies from docs/api-contract.md. Each call returns a fresh copy."""

from typing import Any


def health_tips(locale: str = "en") -> dict[str, Any]:
    return {
        "locale": locale,
        "currency": "USD",
        "score": 62,
        "factors": [
            {
                "id": "savingsRate",
                "value": 0.12,
                "points": 15,
                "maxPoints": 25,
                "status": "fair",
                "healthy": "20% or more",
            },
            {
                "id": "emergencyFund",
                "value": 2.4,
                "points": 10,
                "maxPoints": 25,
                "status": "poor",
                "healthy": "3 to 6 months",
            },
        ],
    }


def categorize() -> dict[str, Any]:
    return {
        "locale": "en",
        "categories": ["groceries", "dining", "transport", "other"],
        "transactions": [
            {
                "id": "row-1",
                "description": "CARREFOUR CITY 123",
                "amount": 4520,
                "currency": "USD",
                "type": "expense",
            },
            {
                "id": "row-2",
                "description": "UBER TRIP",
                "amount": 1200,
                "currency": "USD",
                "type": "expense",
            },
        ],
    }


def checkin(locale: str = "en") -> dict[str, Any]:
    return {
        "locale": locale,
        "currency": "USD",
        "month": "2026-10",
        "income": 420000,
        "spending": 351000,
        "savingsRate": 0.164,
        "categories": [
            {"categoryId": "dining", "planned": 20000, "actual": 31000},
            {"categoryId": "groceries", "planned": 60000, "actual": 52000},
            {"categoryId": "shopping", "planned": 15000, "actual": 40000},
            {"categoryId": "transport", "planned": 10000, "actual": 12000},
        ],
        "goals": [
            {
                "id": "g1",
                "name": "Car",
                "target": 1000000,
                "saved": 250000,
                "onTrack": False,
                "projectedMonth": "2028-03",
            }
        ],
        "scoreChange": 4,
    }


def coach_context() -> dict[str, Any]:
    return {
        "month": "2026-11",
        "monthlyIncome": 420000,
        "monthlySpending": 351000,
        "savingsRate": 0.164,
        "savingsBalance": 800000,
        "emergencyFund": 600000,
        "emergencyMonths": 2.4,
        "healthScore": 62,
        "categories": [{"categoryId": "dining", "planned": 20000, "actual": 31000}],
        "goals": [
            {
                "id": "g1",
                "name": "Car",
                "target": 1000000,
                "saved": 250000,
                "targetDate": "2027-12-01",
                "projectedMonth": "2028-03",
            }
        ],
        "debts": [
            {"id": "d1", "name": "Card", "balance": 250000, "aprBps": 2400, "minPayment": 7500}
        ],
    }


def coach(*messages: dict[str, Any], locale: str = "en") -> dict[str, Any]:
    if not messages:
        messages = ({"role": "user", "text": "Can I afford a $900 phone in March?"},)
    return {
        "locale": locale,
        "currency": "USD",
        "context": coach_context(),
        "messages": list(messages),
    }


def tool_round_trip() -> dict[str, Any]:
    return coach(
        {"role": "user", "text": "Can I afford a $900 phone in March?"},
        {
            "role": "assistant",
            "toolCall": {
                "id": "c1",
                "name": "check_affordability",
                "args": {"amountMajor": 900, "month": "2027-03"},
            },
        },
        {
            "role": "tool",
            "toolResult": {
                "id": "c1",
                "name": "check_affordability",
                "result": {"affordable": True},
            },
        },
    )
