from typing import Annotated, Self

from pydantic import Field, StringConstraints, field_validator, model_validator

from moneyflow_api.schemas.common import (
    CategoryAmount,
    CategoryId,
    CurrencyCode,
    DisplayName,
    Identifier,
    Locale,
    Minor,
    MonthKey,
    Ratio,
    RequestModel,
    ResponseModel,
    Source,
    ensure_unique,
)

SUMMARY_MAX = 800
HIGHLIGHT_MAX = 160
QUESTION_MAX = 200
REASON_MAX = 200
MAX_HIGHLIGHTS = 4
MIN_QUESTIONS = 2
MAX_QUESTIONS = 3
MAX_ADJUSTMENTS = 4
MAX_CHANGE_PERCENT = 30


class CheckinGoal(RequestModel):
    id: Identifier
    name: DisplayName
    target: Minor
    saved: Minor
    onTrack: bool
    projectedMonth: MonthKey | None = None


class CheckinRequest(RequestModel):
    locale: Locale
    currency: CurrencyCode
    month: MonthKey
    income: Minor
    spending: Minor
    savingsRate: Ratio
    categories: list[CategoryAmount] = Field(min_length=1, max_length=18)
    goals: list[CheckinGoal] = Field(default_factory=list, max_length=10)
    scoreChange: int | None = Field(default=None, ge=-100, le=100)

    @model_validator(mode="after")
    def _unique_ids(self) -> Self:
        ensure_unique((c.categoryId for c in self.categories), "categoryId")
        ensure_unique((g.id for g in self.goals), "goal id")
        return self


class Question(ResponseModel):
    id: str
    text: Annotated[str, StringConstraints(min_length=1, max_length=QUESTION_MAX)]


class Adjustment(ResponseModel):
    id: str
    categoryId: CategoryId
    changePercent: int = Field(ge=-MAX_CHANGE_PERCENT, le=MAX_CHANGE_PERCENT)
    reason: Annotated[str, StringConstraints(min_length=1, max_length=REASON_MAX)]

    @field_validator("changePercent")
    @classmethod
    def _non_zero(cls, value: int) -> int:
        if value == 0:
            raise ValueError("changePercent must not be zero")
        return value


Highlight = Annotated[str, StringConstraints(min_length=1, max_length=HIGHLIGHT_MAX)]


class CheckinResponse(ResponseModel):
    summary: Annotated[str, StringConstraints(min_length=1, max_length=SUMMARY_MAX)]
    highlights: list[Highlight] = Field(max_length=MAX_HIGHLIGHTS)
    questions: list[Question] = Field(min_length=MIN_QUESTIONS, max_length=MAX_QUESTIONS)
    adjustments: list[Adjustment] = Field(max_length=MAX_ADJUSTMENTS)
    source: Source
