"""Billing use cases. Every function receives its collaborators explicitly."""

import logging

from moneyflow_api.billing.gateway import BillingGateway, CheckoutParams, WebhookEvent
from moneyflow_api.config import Settings
from moneyflow_api.errors import ApiError
from moneyflow_api.schemas.common import Locale, Plan
from moneyflow_api.stores.models import BillingRecord
from moneyflow_api.stores.protocols import BillingStore

logger = logging.getLogger(__name__)

PRODUCT_NAME = "Moneyflow Pro (test mode)"
# Stripe Checkout has no Arabic locale, so Arabic users get browser detection.
_CHECKOUT_LOCALES: dict[Locale, str] = {"en": "en", "ar": "auto"}


async def start_checkout(
    gateway: BillingGateway, store: BillingStore, settings: Settings, uid: str, locale: Locale
) -> str:
    record = await store.get(uid)
    session = await gateway.create_checkout_session(
        CheckoutParams(
            uid=uid,
            price_cents=settings.pro_price_cents,
            product_name=PRODUCT_NAME,
            success_url=f"{settings.app_url}/app/billing/success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{settings.app_url}/pricing",
            locale=_CHECKOUT_LOCALES[locale],
            customer_id=record.stripe_customer_id,
        )
    )
    if not session.url:
        raise ApiError.billing_error()
    return session.url


async def confirm_checkout(
    gateway: BillingGateway, store: BillingStore, uid: str, session_id: str
) -> Plan:
    """Upgrade to pro if the session is complete, paid and belongs to `uid`; else 404."""
    session = await gateway.retrieve_checkout_session(session_id)
    if (
        session is None
        or session.client_reference_id != uid
        or session.status != "complete"
        or session.payment_status != "paid"
    ):
        raise ApiError.not_found("Checkout session not found.")
    await store.save(
        uid,
        BillingRecord(
            plan="pro",
            stripe_customer_id=session.customer_id,
            stripe_subscription_id=session.subscription_id,
        ),
    )
    return "pro"


async def cancel_plan(gateway: BillingGateway, store: BillingStore, uid: str) -> Plan:
    record = await store.get(uid)
    if record.stripe_subscription_id:
        await gateway.cancel_subscription(record.stripe_subscription_id)
    await store.save(uid, BillingRecord(plan="free", stripe_customer_id=record.stripe_customer_id))
    return "free"


async def apply_webhook_event(store: BillingStore, event: WebhookEvent) -> None:
    data = event.data_object
    if event.type == "checkout.session.completed":
        uid = data.get("client_reference_id")
        if not isinstance(uid, str) or data.get("payment_status") != "paid":
            return
        customer, subscription = data.get("customer"), data.get("subscription")
        await store.save(
            uid,
            BillingRecord(
                plan="pro",
                stripe_customer_id=customer if isinstance(customer, str) else None,
                stripe_subscription_id=subscription if isinstance(subscription, str) else None,
            ),
        )
    elif event.type == "customer.subscription.deleted":
        metadata = data.get("metadata")
        uid = metadata.get("uid") if isinstance(metadata, dict) else None
        if not isinstance(uid, str):
            logger.info("Subscription deleted without a uid in metadata; ignored")
            return
        record = await store.get(uid)
        if record.stripe_subscription_id != data.get("id"):
            return  # a stale event for a subscription the user no longer has
        await store.save(
            uid, BillingRecord(plan="free", stripe_customer_id=record.stripe_customer_id)
        )
