"""FastAPI dependencies. Everything resolves from `app.state`, set in `create_app`."""

from typing import Annotated

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from moneyflow_api.auth import AuthUnavailableError, CurrentUser, InvalidTokenError
from moneyflow_api.billing.gateway import BillingGateway
from moneyflow_api.config import Settings
from moneyflow_api.errors import ApiError
from moneyflow_api.quota import QuotaService
from moneyflow_api.services import Services

_bearer = HTTPBearer(auto_error=False, description="Firebase ID token")


def get_settings_dep(request: Request) -> Settings:
    settings: Settings = request.app.state.settings
    return settings


def get_services(request: Request) -> Services:
    services: Services = request.app.state.services
    return services


SettingsDep = Annotated[Settings, Depends(get_settings_dep)]
ServicesDep = Annotated[Services, Depends(get_services)]


async def get_current_user(
    services: ServicesDep,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> CurrentUser:
    """Verify the bearer token. Override this dependency in tests to skip Firebase."""
    if credentials is None or not credentials.credentials.strip():
        raise ApiError.unauthenticated("Missing bearer token.")
    try:
        return await services.token_verifier.verify(credentials.credentials.strip())
    except InvalidTokenError:
        raise ApiError.unauthenticated("Invalid or expired token.") from None
    except AuthUnavailableError:
        raise ApiError(503, "auth_unavailable", "Could not verify the token.") from None


async def require_user(
    services: ServicesDep, user: Annotated[CurrentUser, Depends(get_current_user)]
) -> CurrentUser:
    """Authenticated user, after the per-uid rate limit."""
    retry_after = services.rate_limiter.hit(user.uid)
    if retry_after is not None:
        raise ApiError.rate_limited(retry_after)
    return user


UserDep = Annotated[CurrentUser, Depends(require_user)]


def get_quota(services: ServicesDep, settings: SettingsDep) -> QuotaService:
    return QuotaService(services.usage_store, services.billing_store, settings, services.clock)


QuotaDep = Annotated[QuotaService, Depends(get_quota)]


def get_billing_gateway(services: ServicesDep) -> BillingGateway:
    if services.billing_gateway is None:
        raise ApiError.billing_not_configured()
    return services.billing_gateway


BillingGatewayDep = Annotated[BillingGateway, Depends(get_billing_gateway)]
