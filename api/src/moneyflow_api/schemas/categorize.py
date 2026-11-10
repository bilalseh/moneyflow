from typing import Annotated, Literal, Self

from pydantic import Field, StringConstraints, model_validator

from moneyflow_api.schemas.common import (
    CategoryId,
    CurrencyCode,
    Identifier,
    Locale,
    RequestModel,
    ResponseModel,
    SignedMinor,
    Source,
    ensure_unique,
)


class Transaction(RequestModel):
    id: Identifier
    description: Annotated[str, StringConstraints(max_length=200)]
    amount: SignedMinor
    currency: CurrencyCode
    type: Literal["expense", "income"]


class CategorizeRequest(RequestModel):
    locale: Locale
    categories: list[CategoryId] = Field(min_length=1, max_length=18)
    transactions: list[Transaction] = Field(min_length=1, max_length=100)

    @model_validator(mode="after")
    def _unique_ids(self) -> Self:
        ensure_unique(self.categories, "category")
        ensure_unique((tx.id for tx in self.transactions), "transaction id")
        return self


class Suggestion(ResponseModel):
    id: str
    categoryId: CategoryId
    confidence: float = Field(ge=0, le=1)


class CategorizeResponse(ResponseModel):
    suggestions: list[Suggestion]
    source: Source
