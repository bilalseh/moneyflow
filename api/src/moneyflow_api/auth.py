"""Firebase ID token verification."""

import asyncio
import logging
from dataclasses import dataclass
from typing import Any, Protocol

from firebase_admin import auth

from moneyflow_api.firebase import FirebaseResources

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class CurrentUser:
    uid: str
    is_anonymous: bool = False


class InvalidTokenError(Exception):
    """The token is missing, malformed, expired, revoked or for another project."""


class AuthUnavailableError(Exception):
    """Token verification could not run, for example because Google certs could not load."""


class TokenVerifier(Protocol):
    async def verify(self, token: str) -> CurrentUser: ...


def user_from_claims(claims: dict[str, Any]) -> CurrentUser:
    uid = claims.get("uid") or claims.get("sub")
    if not isinstance(uid, str) or not uid:
        raise InvalidTokenError("token has no uid")
    firebase_claims = claims.get("firebase")
    provider = (
        firebase_claims.get("sign_in_provider") if isinstance(firebase_claims, dict) else None
    )
    return CurrentUser(uid=uid, is_anonymous=provider == "anonymous")


class FirebaseTokenVerifier:
    """Verifies tokens with firebase_admin; the audience check enforces the project id."""

    def __init__(self, firebase: FirebaseResources) -> None:
        self._firebase = firebase

    async def verify(self, token: str) -> CurrentUser:
        return await asyncio.to_thread(self._verify, token)

    def _verify(self, token: str) -> CurrentUser:
        try:
            claims = auth.verify_id_token(token, app=self._firebase.app())
        except auth.CertificateFetchError as exc:
            logger.warning("Could not fetch Firebase signing certificates")
            raise AuthUnavailableError from exc
        except (ValueError, auth.InvalidIdTokenError, auth.UserDisabledError) as exc:
            raise InvalidTokenError from exc
        if not isinstance(claims, dict):
            raise InvalidTokenError("unexpected claims")
        return user_from_claims(claims)
