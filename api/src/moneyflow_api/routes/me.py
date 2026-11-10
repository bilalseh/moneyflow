from fastapi import APIRouter

from moneyflow_api.clock import iso_utc
from moneyflow_api.deps import QuotaDep, ServicesDep, SettingsDep, UserDep
from moneyflow_api.schemas.me import Features, MeResponse, Usage

router = APIRouter(tags=["me"])


@router.get("/me", response_model=MeResponse)
async def get_me(
    user: UserDep, quota: QuotaDep, services: ServicesDep, settings: SettingsDep
) -> MeResponse:
    snapshot = await quota.snapshot(user.uid)
    return MeResponse(
        uid=user.uid,
        plan=snapshot.plan,
        usage=Usage(used=snapshot.used, limit=snapshot.limit, resetsAt=iso_utc(snapshot.resets_at)),
        features=Features(
            ai=services.ai_client is not None, billing=services.billing_gateway is not None
        ),
    )
