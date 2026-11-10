from typing import Any

from moneyflow_api.ai.client import AiInvalidOutputError
from moneyflow_api.ai.guardrails import violates_output_policy
from moneyflow_api.money import format_minor
from moneyflow_api.schemas.common import CategoryAmount


def category_rows(categories: list[CategoryAmount], currency: str) -> list[dict[str, Any]]:
    """Planned vs actual with amounts preformatted and the comparison done in code."""
    return [
        {
            "categoryId": c.categoryId,
            "planned": format_minor(c.planned, currency),
            "actual": format_minor(c.actual, currency),
            "overPlan": c.actual > c.planned,
        }
        for c in categories
    ]


def ensure_policy_compliant(*texts: str) -> None:
    for text in texts:
        if violates_output_policy(text):
            raise AiInvalidOutputError("output mentions financial products, tickers or crypto")
