from typing import Annotated, Literal

from pydantic import StringConstraints

from moneyflow_api.schemas.common import Locale, Plan, RequestModel, ResponseModel


class CheckoutRequest(RequestModel):
    locale: Locale


class CheckoutResponse(ResponseModel):
    url: str


class ConfirmRequest(RequestModel):
    sessionId: Annotated[str, StringConstraints(pattern=r"^cs_test_[A-Za-z0-9_]{1,200}$")]


class PlanResponse(ResponseModel):
    plan: Plan


class WebhookAck(ResponseModel):
    received: Literal[True] = True
