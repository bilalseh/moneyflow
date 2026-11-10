from typing import Any

import pytest
from fastapi.testclient import TestClient

from moneyflow_api.auth import CurrentUser, InvalidTokenError, user_from_claims
from moneyflow_api.deps import get_current_user
from moneyflow_api.errors import ApiError
from tests import payloads
from tests.conftest import ALICE, Harness

PROTECTED: list[tuple[str, str, dict[str, Any] | None]] = [
    ("GET", "/api/me", None),
    ("POST", "/api/ai/health-tips", payloads.health_tips()),
    ("POST", "/api/ai/categorize", payloads.categorize()),
    ("POST", "/api/ai/checkin", payloads.checkin()),
    ("POST", "/api/ai/coach", payloads.coach()),
    ("POST", "/api/billing/checkout", {"locale": "en"}),
    ("POST", "/api/billing/confirm", {"sessionId": "cs_test_abc"}),
    ("POST", "/api/billing/cancel", None),
    ("DELETE", "/api/account", None),
]


@pytest.mark.parametrize(("method", "path", "body"), PROTECTED)
def test_protected_routes_require_a_token(
    client: TestClient, method: str, path: str, body: dict[str, Any] | None
) -> None:
    response = client.request(method, path, json=body)

    assert response.status_code == 401
    assert response.json() == {
        "error": {"code": "unauthenticated", "message": "Missing bearer token."}
    }
    assert response.headers["WWW-Authenticate"] == "Bearer"


@pytest.mark.parametrize(
    "header", ["Basic dXNlcjpwYXNz", "Bearer", "Bearer   ", "token-alice", "bearer"]
)
def test_malformed_authorization_header_is_401(client: TestClient, header: str) -> None:
    response = client.get("/api/me", headers={"Authorization": header})

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthenticated"


def test_invalid_token_is_401(client: TestClient) -> None:
    response = client.get("/api/me", headers={"Authorization": "Bearer forged"})

    assert response.status_code == 401
    assert response.json() == {
        "error": {"code": "unauthenticated", "message": "Invalid or expired token."}
    }


def test_valid_token_and_anonymous_users_are_accepted(client: TestClient) -> None:
    assert client.get("/api/me", headers=ALICE).json()["uid"] == "alice"
    assert client.get("/api/me", headers={"Authorization": "Bearer token-anon"}).status_code == 200


def test_certificate_outage_is_503(client: TestClient) -> None:
    response = client.get("/api/me", headers={"Authorization": "Bearer token-certs-down"})

    assert response.status_code == 503
    assert response.json()["error"]["code"] == "auth_unavailable"


def test_auth_dependency_can_be_overridden(harness: Harness) -> None:
    harness.app.dependency_overrides[get_current_user] = lambda: CurrentUser("override")

    assert harness.client.get("/api/me").json()["uid"] == "override"


def test_claims_mapping() -> None:
    assert user_from_claims({"uid": "u1", "firebase": {"sign_in_provider": "anonymous"}}) == (
        CurrentUser("u1", is_anonymous=True)
    )
    assert user_from_claims({"sub": "u2", "firebase": {"sign_in_provider": "google.com"}}) == (
        CurrentUser("u2", is_anonymous=False)
    )
    with pytest.raises(InvalidTokenError):
        user_from_claims({"firebase": {}})


def test_health_needs_no_token(client: TestClient) -> None:
    assert client.get("/api/health").status_code == 200


def test_unknown_route_uses_error_shape(client: TestClient) -> None:
    response = client.get("/api/nope")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


def test_malformed_json_is_422(client: TestClient) -> None:
    response = client.post(
        "/api/ai/health-tips",
        content=b"{not json",
        headers={**ALICE, "Content-Type": "application/json"},
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_request"


def test_unexpected_errors_are_500_without_details(harness: Harness) -> None:
    @harness.app.get("/api/boom")
    def boom() -> None:
        raise RuntimeError("secret internals")

    response = harness.client.get("/api/boom")

    assert response.status_code == 500
    assert response.json() == {
        "error": {"code": "internal_error", "message": "Something went wrong."}
    }


def test_retry_after_only_on_429() -> None:
    assert ApiError.quota_exceeded(10).headers["Retry-After"] == "10"
    assert ApiError.ai_unavailable().retry_after_seconds is None
    assert "Retry-After" not in ApiError.not_found().headers
