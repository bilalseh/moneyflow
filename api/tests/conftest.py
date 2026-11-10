from collections.abc import Callable, Iterator
from dataclasses import dataclass
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from moneyflow_api.config import Settings
from moneyflow_api.main import create_app
from moneyflow_api.ratelimit import SlidingWindowRateLimiter
from moneyflow_api.services import Services
from moneyflow_api.stores.memory import (
    InMemoryAccountStore,
    InMemoryBillingStore,
    InMemoryUsageStore,
)
from tests.fakes import FakeAiClient, FakeBillingGateway, FakeTokenVerifier, MutableClock

ALICE = {"Authorization": "Bearer token-alice"}
BOB = {"Authorization": "Bearer token-bob"}


def make_settings(**overrides: Any) -> Settings:
    values: dict[str, Any] = {
        "env": "test",
        "cors_origins": ["http://testserver"],
        "gemini_api_key": "test-gemini-key",
        "stripe_secret_key": "sk_test_123",
        "stripe_webhook_secret": "whsec_test",
        "free_daily_ai": 20,
        "pro_daily_ai": 200,
    }
    values.update(overrides)
    return Settings(_env_file=None, **values)


@dataclass
class Harness:
    app: FastAPI
    client: TestClient
    settings: Settings
    ai: FakeAiClient
    billing: FakeBillingGateway
    usage_store: InMemoryUsageStore
    billing_store: InMemoryBillingStore
    account_store: InMemoryAccountStore
    clock: MutableClock
    rate_limiter: SlidingWindowRateLimiter


HarnessFactory = Callable[..., Harness]


@pytest.fixture
def make_harness() -> Iterator[HarnessFactory]:
    """Build an app wired to fakes. Pass Settings fields as keyword overrides."""
    clients: list[TestClient] = []

    def build(
        *,
        ai_enabled: bool = True,
        billing_enabled: bool = True,
        rate_limiter: SlidingWindowRateLimiter | None = None,
        **settings: Any,
    ) -> Harness:
        config = make_settings(**settings)
        usage, billing_store = InMemoryUsageStore(), InMemoryBillingStore()
        account_store = InMemoryAccountStore(usage, billing_store)
        ai, gateway, clock = FakeAiClient(), FakeBillingGateway(), MutableClock()
        limiter = rate_limiter or SlidingWindowRateLimiter()
        services = Services(
            token_verifier=FakeTokenVerifier(),
            usage_store=usage,
            billing_store=billing_store,
            account_store=account_store,
            ai_client=ai if ai_enabled else None,
            billing_gateway=gateway if billing_enabled else None,
            rate_limiter=limiter,
            clock=clock,
        )
        app = create_app(config, services)
        client = TestClient(app, raise_server_exceptions=False)
        clients.append(client)
        return Harness(
            app=app,
            client=client,
            settings=config,
            ai=ai,
            billing=gateway,
            usage_store=usage,
            billing_store=billing_store,
            account_store=account_store,
            clock=clock,
            rate_limiter=limiter,
        )

    yield build
    for client in clients:
        client.close()


@pytest.fixture
def harness(make_harness: HarnessFactory) -> Harness:
    return make_harness()


@pytest.fixture
def client(harness: Harness) -> TestClient:
    return harness.client
