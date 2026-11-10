from moneyflow_api.schemas.common import Plan, ResponseModel


class Usage(ResponseModel):
    used: int
    limit: int
    resetsAt: str


class Features(ResponseModel):
    ai: bool
    billing: bool


class MeResponse(ResponseModel):
    uid: str
    plan: Plan
    usage: Usage
    features: Features
