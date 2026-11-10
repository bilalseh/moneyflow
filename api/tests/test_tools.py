from typing import Any

import pytest

from moneyflow_api.ai.client import AiInvalidOutputError
from moneyflow_api.ai.tools import function_declarations, validate_tool_args

GOALS = {"g1"}


def test_affordability_args_are_kept() -> None:
    args = validate_tool_args(
        "check_affordability", {"amountMajor": 900, "month": "2027-03", "label": "phone"}, GOALS
    )

    assert args == {"amountMajor": 900.0, "month": "2027-03", "label": "phone"}


def test_defaults_are_filled_in() -> None:
    assert validate_tool_args("simulate_scenario", {}, GOALS) == {
        "extraSavingsMajor": 0.0,
        "categoryCuts": [],
        "incomeChangeMajor": 0.0,
    }
    assert validate_tool_args("compare_debt_strategies", {}, GOALS) == {"extraPerMonthMajor": 0.0}


def test_optional_label_is_omitted_when_absent() -> None:
    args = validate_tool_args("check_affordability", {"amountMajor": 1, "month": "2027-01"}, GOALS)

    assert "label" not in args


@pytest.mark.parametrize(
    ("name", "args"),
    [
        ("check_affordability", {"amountMajor": 0, "month": "2027-03"}),
        ("check_affordability", {"amountMajor": -5, "month": "2027-03"}),
        ("check_affordability", {"amountMajor": 900, "month": "March"}),
        ("check_affordability", {"amountMajor": 900}),
        ("check_affordability", {"amountMajor": 900, "month": "2027-03", "label": "x" * 61}),
        ("check_affordability", {"amountMajor": 900, "month": "2027-03", "extra": 1}),
        ("simulate_scenario", {"extraSavingsMajor": -1}),
        ("simulate_scenario", {"categoryCuts": [{"categoryId": "dining", "percent": 0}]}),
        ("simulate_scenario", {"categoryCuts": [{"categoryId": "dining", "percent": 101}]}),
        ("simulate_scenario", {"categoryCuts": [{"categoryId": "yachts", "percent": 10}]}),
        (
            "simulate_scenario",
            {"categoryCuts": [{"categoryId": "dining", "percent": 5}] * 2},
        ),
        (
            "simulate_scenario",
            {"categoryCuts": [{"categoryId": c, "percent": 5} for c in ["a"] * 6]},
        ),
        ("project_goal", {"goalId": "missing"}),
        ("project_goal", {}),
        ("compare_debt_strategies", {"extraPerMonthMajor": -10}),
        ("buy_stocks", {}),
    ],
)
def test_invalid_args_are_rejected(name: str, args: dict[str, Any]) -> None:
    with pytest.raises(AiInvalidOutputError):
        validate_tool_args(name, args, GOALS)


def test_project_goal_accepts_known_goal() -> None:
    assert validate_tool_args("project_goal", {"goalId": "g1"}, GOALS) == {"goalId": "g1"}


def test_declarations_offer_project_goal_only_with_goals() -> None:
    with_goals = {d["name"] for d in function_declarations(["g1"])}
    without_goals = {d["name"] for d in function_declarations([])}

    assert with_goals == {
        "check_affordability",
        "simulate_scenario",
        "project_goal",
        "compare_debt_strategies",
    }
    assert "project_goal" not in without_goals


def test_project_goal_declaration_enumerates_goal_ids() -> None:
    declaration = next(
        d for d in function_declarations(["g1", "g2"]) if d["name"] == "project_goal"
    )

    assert declaration["parameters"]["properties"]["goalId"]["enum"] == ["g1", "g2"]
