from decimal import Decimal

from pydantic import BaseModel

from moneyflow_api.ai.client import AiInvalidOutputError
from moneyflow_api.ai.gemini_format import (
    GeminiReply,
    GenerationOptions,
    JsonObject,
    build_request,
    user_text,
)
from moneyflow_api.ai.prompts import HEALTH_TIPS_TASK, data_block, system_parts
from moneyflow_api.ai.response_schemas import health_tips_schema
from moneyflow_api.ai.runner import parse_json_reply
from moneyflow_api.ai.tasks.common import ensure_policy_compliant
from moneyflow_api.ai.text import allowed_numbers, clip, unknown_numbers
from moneyflow_api.money import format_decimal, format_percent
from moneyflow_api.schemas.health_tips import (
    TIP_MAX_CHARS,
    Factor,
    HealthTip,
    HealthTipsRequest,
    HealthTipsResponse,
)


class _RawTip(BaseModel):
    factorId: str
    text: str


class _RawTips(BaseModel):
    tips: list[_RawTip]


def value_label(factor: Factor) -> str | None:
    if factor.value is None:
        return None
    if factor.id == "emergencyFund":
        return f"{format_decimal(factor.value)} months"
    return format_percent(factor.value)


def build_body(request: HealthTipsRequest) -> JsonObject:
    factors = [
        {
            "id": f.id,
            "status": f.status,
            "valueLabel": value_label(f),
            "points": f.points,
            "maxPoints": f.maxPoints,
            "healthy": f.healthy,
        }
        for f in request.factors
    ]
    payload = {"score": request.score, "factors": factors}
    return build_request(
        system=system_parts(request.locale, HEALTH_TIPS_TASK),
        contents=[user_text(data_block("factors", payload))],
        options=GenerationOptions(
            temperature=0.5,
            max_output_tokens=1024,
            response_schema=health_tips_schema([f.id for f in request.factors]),
        ),
    )


def allowed_input_numbers(request: HealthTipsRequest) -> set[Decimal]:
    """Numbers the model may restate: the score and each factor's figures and labels."""
    sources: list[str | float | int] = [request.score]
    for factor in request.factors:
        sources += [factor.points, factor.maxPoints, factor.healthy]
        label = value_label(factor)
        if factor.value is not None and label is not None:
            sources += [factor.value, label]
    return allowed_numbers(sources)


def parse_reply(request: HealthTipsRequest, reply: GeminiReply) -> HealthTipsResponse:
    raw = parse_json_reply(reply, _RawTips)
    texts: dict[str, str] = {}
    for tip in raw.tips:
        texts.setdefault(tip.factorId, tip.text.strip())
    allowed = allowed_input_numbers(request)
    tips: list[HealthTip] = []
    for factor in request.factors:
        text = texts.get(factor.id)
        if not text:
            raise AiInvalidOutputError(f"no tip for factor {factor.id}")
        if unknown_numbers(text, allowed):
            raise AiInvalidOutputError(f"tip for {factor.id} contains numbers not in the request")
        ensure_policy_compliant(text)
        tips.append(HealthTip(factorId=factor.id, text=clip(text, TIP_MAX_CHARS)))
    return HealthTipsResponse(tips=tips, source="ai")
