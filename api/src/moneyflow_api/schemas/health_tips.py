from typing import Annotated, Literal, Self

from pydantic import Field, StringConstraints, model_validator

from moneyflow_api.schemas.common import (
    CurrencyCode,
    Locale,
    Ratio,
    RequestModel,
    ResponseModel,
    Source,
    ensure_unique,
)

FactorId = Literal["savingsRate", "emergencyFund", "debtToIncome", "fixedCosts"]
FactorStatus = Literal["good", "fair", "poor", "unknown"]

TIP_MAX_CHARS = 280


class Factor(RequestModel):
    id: FactorId
    value: Ratio | None
    points: int = Field(ge=0, le=100)
    maxPoints: int = Field(ge=1, le=100)
    status: FactorStatus
    healthy: Annotated[str, StringConstraints(min_length=1, max_length=60)]

    @model_validator(mode="after")
    def _points_within_max(self) -> Self:
        if self.points > self.maxPoints:
            raise ValueError("points must not exceed maxPoints")
        return self


class HealthTipsRequest(RequestModel):
    locale: Locale
    currency: CurrencyCode
    score: int = Field(ge=0, le=100)
    factors: list[Factor] = Field(min_length=1, max_length=4)

    @model_validator(mode="after")
    def _unique_factors(self) -> Self:
        ensure_unique((factor.id for factor in self.factors), "factor id")
        return self


class HealthTip(ResponseModel):
    factorId: FactorId
    text: Annotated[str, StringConstraints(min_length=1, max_length=TIP_MAX_CHARS)]


class HealthTipsResponse(ResponseModel):
    tips: list[HealthTip]
    source: Source
