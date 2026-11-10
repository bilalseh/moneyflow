"""Production adapters, exercised with mocks so nothing reaches Google Cloud."""

from typing import Any
from unittest.mock import MagicMock

import firebase_admin
import pytest
from firebase_admin import auth
from google.cloud import firestore

from moneyflow_api.ai.client import GeminiClient
from moneyflow_api.auth import (
    AuthUnavailableError,
    CurrentUser,
    FirebaseTokenVerifier,
    InvalidTokenError,
)
from moneyflow_api.billing.gateway import StripeGateway
from moneyflow_api.firebase import FirebaseResources
from moneyflow_api.services import build_services
from moneyflow_api.stores.firestore import (
    FirestoreAccountStore,
    FirestoreBillingStore,
    FirestoreUsageStore,
)
from moneyflow_api.stores.models import BillingRecord, UsageRecord
from tests.conftest import make_settings


class FakeFirebase(FirebaseResources):
    def __init__(self, db: Any = None) -> None:
        super().__init__("test-project")
        self.db = db
        self.sentinel_app = object()

    def app(self) -> Any:
        return self.sentinel_app

    def firestore(self) -> Any:
        return self.db


def test_building_production_services_does_not_initialize_firebase() -> None:
    services = build_services(make_settings())

    assert firebase_admin._apps == {}
    assert isinstance(services.ai_client, GeminiClient)
    assert isinstance(services.billing_gateway, StripeGateway)


def test_production_services_without_keys_disable_ai_and_billing() -> None:
    services = build_services(make_settings(gemini_api_key="", stripe_secret_key="sk_live_x"))

    assert services.ai_client is None
    assert services.billing_gateway is None


async def test_token_verifier_maps_claims(monkeypatch: pytest.MonkeyPatch) -> None:
    firebase = FakeFirebase()
    seen: dict[str, Any] = {}

    def verify(token: str, app: Any) -> dict[str, Any]:
        seen.update(token=token, app=app)
        return {"uid": "u1", "firebase": {"sign_in_provider": "anonymous"}}

    monkeypatch.setattr(auth, "verify_id_token", verify)

    user = await FirebaseTokenVerifier(firebase).verify("tok")

    assert user == CurrentUser("u1", is_anonymous=True)
    assert seen == {"token": "tok", "app": firebase.sentinel_app}


@pytest.mark.parametrize(
    "error",
    [
        ValueError("malformed"),
        auth.InvalidIdTokenError("bad"),
        auth.ExpiredIdTokenError("expired", cause=None),
    ],
)
async def test_token_verifier_rejects_bad_tokens(
    monkeypatch: pytest.MonkeyPatch, error: Exception
) -> None:
    def verify(token: str, app: Any) -> dict[str, Any]:
        raise error

    monkeypatch.setattr(auth, "verify_id_token", verify)

    with pytest.raises(InvalidTokenError):
        await FirebaseTokenVerifier(FakeFirebase()).verify("tok")


async def test_token_verifier_reports_certificate_outage(monkeypatch: pytest.MonkeyPatch) -> None:
    def verify(token: str, app: Any) -> dict[str, Any]:
        raise auth.CertificateFetchError("no certs", cause=None)

    monkeypatch.setattr(auth, "verify_id_token", verify)

    with pytest.raises(AuthUnavailableError):
        await FirebaseTokenVerifier(FakeFirebase()).verify("tok")


async def test_firestore_usage_store_reads_the_usage_doc() -> None:
    db = MagicMock()
    db.collection.return_value.document.return_value.get.return_value.to_dict.return_value = {
        "day": "2026-11-10",
        "count": 4,
    }

    record = await FirestoreUsageStore(lambda: db).get("alice")

    assert record == UsageRecord(day="2026-11-10", count=4)
    db.collection.assert_called_with("usage")
    db.collection.return_value.document.assert_called_with("alice")


async def test_firestore_billing_store_writes_the_contract_shape() -> None:
    db = MagicMock()
    store = FirestoreBillingStore(lambda: db)

    await store.save("alice", BillingRecord(plan="pro", stripe_customer_id="cus_1"))

    db.collection.assert_called_with("billing")
    db.collection.return_value.document.return_value.set.assert_called_once_with(
        {"plan": "pro", "stripeCustomerId": "cus_1", "updatedAt": firestore.SERVER_TIMESTAMP}
    )


async def test_firestore_account_store_deletes_everything(monkeypatch: pytest.MonkeyPatch) -> None:
    db = MagicMock()
    firebase = FakeFirebase(db)
    deleted: list[tuple[str, Any]] = []
    monkeypatch.setattr(auth, "delete_user", lambda uid, app: deleted.append((uid, app)))

    await FirestoreAccountStore(firebase).delete_account("alice")

    collections = [c.args[0] for c in db.collection.call_args_list]
    assert collections == ["users", "billing", "usage"]
    db.recursive_delete.assert_called_once()
    assert db.collection.return_value.document.return_value.delete.call_count == 2
    assert deleted == [("alice", firebase.sentinel_app)]


async def test_account_store_tolerates_missing_auth_user(monkeypatch: pytest.MonkeyPatch) -> None:
    def missing(uid: str, app: Any) -> None:
        raise auth.UserNotFoundError("gone")

    monkeypatch.setattr(auth, "delete_user", missing)

    await FirestoreAccountStore(FakeFirebase(MagicMock())).delete_account("alice")
