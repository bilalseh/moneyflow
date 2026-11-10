from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from moneyflow_api import __version__
from moneyflow_api.config import Settings, get_settings, warn_about_rejected_keys
from moneyflow_api.errors import install_error_handlers
from moneyflow_api.routes.account import router as account_router
from moneyflow_api.routes.ai import router as ai_router
from moneyflow_api.routes.billing import router as billing_router
from moneyflow_api.routes.health import router as health_router
from moneyflow_api.routes.me import router as me_router
from moneyflow_api.services import Services, build_services

DESCRIPTION = (
    "Backend for Moneyflow, a personal money coach. Educational tool, not financial advice."
)


def create_app(settings: Settings | None = None, services: Services | None = None) -> FastAPI:
    """Build the app. Tests pass `services` with fakes; production wiring is lazy."""
    settings = settings or get_settings()
    warn_about_rejected_keys(settings)
    resolved = services or build_services(settings)

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        yield
        if resolved.ai_client is not None:
            await resolved.ai_client.aclose()

    app = FastAPI(
        title="Moneyflow API",
        version=__version__,
        description=DESCRIPTION,
        # Everything is served under /api so the Firebase Hosting rewrite
        # (/api/** -> Cloud Run) maps one-to-one onto these routes.
        root_path="",
        docs_url=None if settings.is_production else "/api/docs",
        redoc_url=None,
        openapi_url=None if settings.is_production else "/api/openapi.json",
        lifespan=lifespan,
    )
    app.state.settings = settings
    app.state.services = resolved
    install_error_handlers(app)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Authorization", "Content-Type"],
    )

    for router in (health_router, me_router, ai_router, billing_router, account_router):
        app.include_router(router, prefix="/api")
    return app


app = create_app()
