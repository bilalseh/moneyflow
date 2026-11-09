from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from moneyflow_api import __version__
from moneyflow_api.config import Settings, get_settings
from moneyflow_api.routes.health import router as health_router

DESCRIPTION = (
    "Backend for Moneyflow, a personal money coach. Educational tool, not financial advice."
)


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()

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
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Authorization", "Content-Type"],
    )

    app.include_router(health_router, prefix="/api")
    return app


app = create_app()
