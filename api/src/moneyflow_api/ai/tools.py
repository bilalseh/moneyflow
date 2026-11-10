"""Coach tools: Gemini function declarations and server-side argument validation.

The model only chooses a tool and its inputs. The web app's finance module runs
the calculation and sends the result back as a `tool` message.
"""

from typing import Annotated, Any, get_args

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, ValidationError

from moneyflow_api.ai.client import AiInvalidOutputError
from moneyflow_api.schemas.coach import ToolName
from moneyflow_api.schemas.common import CategoryId, MonthKey, ensure_unique

MAX_MAJOR = 1e12
TOOL_NAMES: tuple[str, ...] = get_args(ToolName)
CATEGORY_IDS: list[str] = list(get_args(CategoryId))


class _Args(BaseModel):
    model_config = ConfigDict(extra="forbid")


class CheckAffordabilityArgs(_Args):
    amountMajor: float = Field(gt=0, le=MAX_MAJOR, allow_inf_nan=False)
    month: MonthKey
    label: Annotated[str, StringConstraints(max_length=60)] | None = None


class CategoryCut(_Args):
    categoryId: CategoryId
    percent: float = Field(ge=1, le=100, allow_inf_nan=False)


class SimulateScenarioArgs(_Args):
    extraSavingsMajor: float = Field(default=0, ge=0, le=MAX_MAJOR, allow_inf_nan=False)
    categoryCuts: list[CategoryCut] = Field(default_factory=list, max_length=5)
    incomeChangeMajor: float = Field(default=0, ge=-MAX_MAJOR, le=MAX_MAJOR, allow_inf_nan=False)


class ProjectGoalArgs(_Args):
    goalId: Annotated[str, StringConstraints(min_length=1, max_length=64)]


class CompareDebtStrategiesArgs(_Args):
    extraPerMonthMajor: float = Field(default=0, ge=0, le=MAX_MAJOR, allow_inf_nan=False)


_ARGS_MODELS: dict[str, type[_Args]] = {
    "check_affordability": CheckAffordabilityArgs,
    "simulate_scenario": SimulateScenarioArgs,
    "project_goal": ProjectGoalArgs,
    "compare_debt_strategies": CompareDebtStrategiesArgs,
}


def validate_tool_args(name: str, args: dict[str, Any], goal_ids: set[str]) -> dict[str, Any]:
    """Validate a model tool call and return the args with defaults filled in."""
    model = _ARGS_MODELS.get(name)
    if model is None:
        raise AiInvalidOutputError(f"unknown tool {name!r}")
    try:
        parsed = model.model_validate(args)
    except ValidationError as exc:
        raise AiInvalidOutputError(f"invalid args for {name} ({exc.error_count()})") from exc
    if isinstance(parsed, ProjectGoalArgs) and parsed.goalId not in goal_ids:
        raise AiInvalidOutputError("project_goal references an unknown goal")
    if isinstance(parsed, SimulateScenarioArgs):
        try:
            ensure_unique((cut.categoryId for cut in parsed.categoryCuts), "categoryId")
        except ValueError as exc:
            raise AiInvalidOutputError(str(exc)) from exc
    return parsed.model_dump(exclude_none=True)


def function_declarations(goal_ids: list[str]) -> list[dict[str, Any]]:
    """Gemini declarations. `project_goal` is offered only when there are goals."""
    declarations: list[dict[str, Any]] = [
        {
            "name": "check_affordability",
            "description": "Check whether the user can afford a one-off purchase in a month.",
            "parameters": {
                "type": "OBJECT",
                "properties": {
                    "amountMajor": {
                        "type": "NUMBER",
                        "description": "Price in major units, as the user typed it.",
                    },
                    "month": {"type": "STRING", "description": "Month of purchase, YYYY-MM."},
                    "label": {"type": "STRING", "description": "Short name of the purchase."},
                },
                "required": ["amountMajor", "month"],
            },
        },
        {
            "name": "simulate_scenario",
            "description": "Simulate a what-if: extra savings, category cuts or income change.",
            "parameters": {
                "type": "OBJECT",
                "properties": {
                    "extraSavingsMajor": {"type": "NUMBER", "description": "Extra per month."},
                    "categoryCuts": {
                        "type": "ARRAY",
                        "maxItems": 5,
                        "items": {
                            "type": "OBJECT",
                            "properties": {
                                "categoryId": {"type": "STRING", "enum": CATEGORY_IDS},
                                "percent": {"type": "NUMBER", "description": "1 to 100."},
                            },
                            "required": ["categoryId", "percent"],
                        },
                    },
                    "incomeChangeMajor": {"type": "NUMBER", "description": "Monthly change."},
                },
            },
        },
        {
            "name": "compare_debt_strategies",
            "description": "Compare avalanche and snowball payoff plans for the user's debts.",
            "parameters": {
                "type": "OBJECT",
                "properties": {
                    "extraPerMonthMajor": {"type": "NUMBER", "description": "Extra per month."}
                },
            },
        },
    ]
    if goal_ids:
        declarations.append(
            {
                "name": "project_goal",
                "description": "Project when a savings goal will be reached.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {"goalId": {"type": "STRING", "enum": goal_ids}},
                    "required": ["goalId"],
                },
            }
        )
    return declarations
