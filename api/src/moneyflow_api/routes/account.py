import logging

from fastapi import APIRouter, Response

from moneyflow_api.billing.gateway import BillingProviderError
from moneyflow_api.deps import ServicesDep, UserDep
from moneyflow_api.errors import ApiError

router = APIRouter(tags=["account"])
logger = logging.getLogger(__name__)


@router.delete("/account", status_code=204, response_class=Response)
async def delete_account(user: UserDep, services: ServicesDep) -> Response:
    """Cancel any subscription, then delete all user data and the auth user."""
    record = await services.billing_store.get(user.uid)
    if record.stripe_subscription_id:
        if services.billing_gateway is None:
            logger.warning("Deleting an account with a subscription while billing is off")
        else:
            try:
                await services.billing_gateway.cancel_subscription(record.stripe_subscription_id)
            except BillingProviderError:
                raise ApiError.billing_error() from None
    await services.account_store.delete_account(user.uid)
    services.rate_limiter.forget(user.uid)
    return Response(status_code=204)
