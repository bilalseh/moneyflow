from functools import partial

from fastapi import APIRouter

from moneyflow_api.ai.client import AiClient
from moneyflow_api.ai.fallbacks.checkin import checkin_fallback
from moneyflow_api.ai.fallbacks.coach import coach_fallback, coach_refusal
from moneyflow_api.ai.fallbacks.health_tips import health_tips_fallback
from moneyflow_api.ai.flow import FallbackReason, run_ai_request
from moneyflow_api.ai.guardrails import detect_restricted_topic
from moneyflow_api.ai.runner import generate_validated
from moneyflow_api.ai.tasks import categorize, checkin, coach, health_tips
from moneyflow_api.deps import QuotaDep, ServicesDep, UserDep
from moneyflow_api.schemas.categorize import CategorizeRequest, CategorizeResponse
from moneyflow_api.schemas.checkin import CheckinRequest, CheckinResponse
from moneyflow_api.schemas.coach import (
    CoachMessageResponse,
    CoachRequest,
    CoachResponse,
    CoachToolCallResponse,
)
from moneyflow_api.schemas.health_tips import HealthTipsRequest, HealthTipsResponse

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/health-tips", response_model=HealthTipsResponse)
async def post_health_tips(
    body: HealthTipsRequest, user: UserDep, quota: QuotaDep, services: ServicesDep
) -> HealthTipsResponse:
    async def call(client: AiClient) -> HealthTipsResponse:
        request_body = health_tips.build_body(body)
        parse = partial(health_tips.parse_reply, body)
        return await generate_validated(client, request_body, parse, task="health-tips")

    return await run_ai_request(
        client=services.ai_client,
        quota=quota,
        uid=user.uid,
        counted=True,
        call=call,
        fallback=lambda _: health_tips_fallback(body),
    )


@router.post("/categorize", response_model=CategorizeResponse)
async def post_categorize(
    body: CategorizeRequest, user: UserDep, quota: QuotaDep, services: ServicesDep
) -> CategorizeResponse:
    async def call(client: AiClient) -> CategorizeResponse:
        request_body = categorize.build_body(body)
        parse = partial(categorize.parse_reply, body)
        return await generate_validated(client, request_body, parse, task="categorize")

    return await run_ai_request(
        client=services.ai_client,
        quota=quota,
        uid=user.uid,
        counted=True,
        call=call,
        fallback=None,
    )


@router.post("/checkin", response_model=CheckinResponse)
async def post_checkin(
    body: CheckinRequest, user: UserDep, quota: QuotaDep, services: ServicesDep
) -> CheckinResponse:
    async def call(client: AiClient) -> CheckinResponse:
        request_body = checkin.build_body(body)
        parse = partial(checkin.parse_reply, body)
        return await generate_validated(client, request_body, parse, task="checkin")

    return await run_ai_request(
        client=services.ai_client,
        quota=quota,
        uid=user.uid,
        counted=True,
        call=call,
        fallback=lambda _: checkin_fallback(body),
    )


@router.post("/coach", response_model=CoachResponse)
async def post_coach(
    body: CoachRequest, user: UserDep, quota: QuotaDep, services: ServicesDep
) -> CoachMessageResponse | CoachToolCallResponse:
    latest = body.latest_user_text
    topic = detect_restricted_topic(latest) if latest is not None else None
    if topic is not None:
        return coach_refusal(body.locale, topic)

    async def call(client: AiClient) -> CoachMessageResponse | CoachToolCallResponse:
        request_body = coach.build_body(body)
        parse = partial(coach.parse_reply, body)
        return await generate_validated(client, request_body, parse, task="coach")

    def fallback(reason: FallbackReason) -> CoachMessageResponse | CoachToolCallResponse:
        return coach_fallback(body.locale, reason)

    return await run_ai_request(
        client=services.ai_client,
        quota=quota,
        uid=user.uid,
        counted=body.ends_with_user_text,
        call=call,
        fallback=fallback,
    )
