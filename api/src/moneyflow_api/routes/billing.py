from typing import Annotated

from fastapi import APIRouter, Header, Request

from moneyflow_api.billing import service
from moneyflow_api.billing.gateway import BillingProviderError, InvalidWebhookError
from moneyflow_api.deps import BillingGatewayDep, ServicesDep, SettingsDep, UserDep
from moneyflow_api.errors import ApiError
from moneyflow_api.schemas.billing import (
    CheckoutRequest,
    CheckoutResponse,
    ConfirmRequest,
    PlanResponse,
    WebhookAck,
)

router = APIRouter(prefix="/billing", tags=["billing"])


@router.post("/checkout", response_model=CheckoutResponse)
async def post_checkout(
    body: CheckoutRequest,
    user: UserDep,
    gateway: BillingGatewayDep,
    services: ServicesDep,
    settings: SettingsDep,
) -> CheckoutResponse:
    try:
        url = await service.start_checkout(
            gateway, services.billing_store, settings, user.uid, body.locale
        )
    except BillingProviderError:
        raise ApiError.billing_error() from None
    return CheckoutResponse(url=url)


@router.post("/confirm", response_model=PlanResponse)
async def post_confirm(
    body: ConfirmRequest, user: UserDep, gateway: BillingGatewayDep, services: ServicesDep
) -> PlanResponse:
    try:
        plan = await service.confirm_checkout(
            gateway, services.billing_store, user.uid, body.sessionId
        )
    except BillingProviderError:
        raise ApiError.billing_error() from None
    return PlanResponse(plan=plan)


@router.post("/cancel", response_model=PlanResponse)
async def post_cancel(
    user: UserDep, gateway: BillingGatewayDep, services: ServicesDep
) -> PlanResponse:
    try:
        plan = await service.cancel_plan(gateway, services.billing_store, user.uid)
    except BillingProviderError:
        raise ApiError.billing_error() from None
    return PlanResponse(plan=plan)


@router.post("/webhook", response_model=WebhookAck)
async def post_webhook(
    request: Request,
    gateway: BillingGatewayDep,
    services: ServicesDep,
    settings: SettingsDep,
    stripe_signature: Annotated[str | None, Header(alias="Stripe-Signature")] = None,
) -> WebhookAck:
    """Unauthenticated: trust comes from the Stripe signature alone."""
    secret = settings.webhook_secret
    if secret is None:
        raise ApiError.billing_not_configured()
    if not stripe_signature:
        raise ApiError.invalid_signature()
    try:
        event = gateway.construct_event(await request.body(), stripe_signature, secret)
    except InvalidWebhookError:
        raise ApiError.invalid_signature() from None
    await service.apply_webhook_event(services.billing_store, event)
    return WebhookAck()
