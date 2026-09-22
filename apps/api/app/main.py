from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.api.routes.health import router as health_router
from app.api.routes.legacy_data import router as legacy_data_router
from app.core.config import Settings, get_settings
from app.core.errors import install_exception_handlers
from app.core.middleware import RequestIdMiddleware
from app.db.session import Database


def create_app(
    settings: Settings | None = None,
    database: Database | None = None,
) -> FastAPI:
    application_settings = settings or get_settings()
    application_database = database or Database(application_settings)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        app.state.ready = await application_database.is_ready()
        try:
            yield
        finally:
            app.state.ready = False
            await application_database.dispose()

    docs_url = "/docs" if application_settings.docs_enabled else None
    redoc_url = "/redoc" if application_settings.docs_enabled else None
    openapi_url = "/openapi.json" if application_settings.docs_enabled else None
    app = FastAPI(
        title=application_settings.app_name,
        version=application_settings.app_version,
        debug=application_settings.debug,
        docs_url=docs_url,
        redoc_url=redoc_url,
        openapi_url=openapi_url,
        lifespan=lifespan,
    )
    app.state.settings = application_settings
    app.state.database = application_database

    app.add_middleware(RequestIdMiddleware)
    if application_settings.cors_allowed_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=application_settings.cors_allowed_origins,
            allow_credentials=application_settings.cors_allow_credentials,
            allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
            allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
            expose_headers=["X-Request-ID"],
        )

    install_exception_handlers(app)
    app.include_router(health_router)
    app.include_router(legacy_data_router)
    app.include_router(api_router, prefix=application_settings.api_v1_prefix)
    return app


app = create_app()
