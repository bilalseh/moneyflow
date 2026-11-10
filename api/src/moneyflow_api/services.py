"""The collaborators the routes depend on, bundled so tests can swap in fakes."""

from dataclasses import dataclass, field

from moneyflow_api.ai.client import AiClient, GeminiClient
from moneyflow_api.auth import FirebaseTokenVerifier, TokenVerifier
from moneyflow_api.billing.gateway import BillingGateway, StripeGateway
from moneyflow_api.clock import Clock, utc_now
from moneyflow_api.config import Settings
from moneyflow_api.firebase import FirebaseResources
from moneyflow_api.ratelimit import SlidingWindowRateLimiter
from moneyflow_api.stores.firestore import (
    FirestoreAccountStore,
    FirestoreBillingStore,
    FirestoreUsageStore,
)
from moneyflow_api.stores.protocols import AccountStore, BillingStore, UsageStore


@dataclass
class Services:
    token_verifier: TokenVerifier
    usage_store: UsageStore
    billing_store: BillingStore
    account_store: AccountStore
    ai_client: AiClient | None
    billing_gateway: BillingGateway | None
    rate_limiter: SlidingWindowRateLimiter = field(default_factory=SlidingWindowRateLimiter)
    clock: Clock = utc_now


def build_services(settings: Settings) -> Services:
    """Production wiring. Nothing here touches the network until a request needs it."""
    firebase = FirebaseResources(settings.firebase_project_id)
    ai_client: AiClient | None = None
    if settings.ai_enabled:
        ai_client = GeminiClient(
            api_key=settings.gemini_api_key.get_secret_value().strip(),
            model=settings.gemini_model,
            timeout_seconds=settings.gemini_timeout_seconds,
        )
    test_key = settings.stripe_test_key
    return Services(
        token_verifier=FirebaseTokenVerifier(firebase),
        usage_store=FirestoreUsageStore(firebase.firestore),
        billing_store=FirestoreBillingStore(firebase.firestore),
        account_store=FirestoreAccountStore(firebase),
        ai_client=ai_client,
        billing_gateway=StripeGateway(test_key) if test_key else None,
    )
