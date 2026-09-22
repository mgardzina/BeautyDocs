from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import Settings

logger = logging.getLogger(__name__)


class Database:
    """Own the async engine and transaction-scoped session factory."""

    def __init__(self, settings: Settings) -> None:
        database_url = settings.sqlalchemy_database_url
        self.engine: AsyncEngine | None = None
        self.session_factory: async_sessionmaker[AsyncSession] | None = None

        if database_url is not None:
            self.engine = create_async_engine(
                database_url,
                pool_pre_ping=True,
                pool_size=settings.database_pool_size,
                max_overflow=settings.database_max_overflow,
                pool_timeout=settings.database_pool_timeout_seconds,
                pool_recycle=settings.database_pool_recycle_seconds,
                connect_args={
                    "timeout": settings.database_connect_timeout_seconds,
                    "command_timeout": settings.database_statement_timeout_ms / 1_000,
                },
                hide_parameters=True,
            )
            self.session_factory = async_sessionmaker(
                bind=self.engine,
                class_=AsyncSession,
                autoflush=False,
                expire_on_commit=False,
            )

    @property
    def configured(self) -> bool:
        return self.engine is not None and self.session_factory is not None

    async def is_ready(self) -> bool:
        if self.engine is None:
            return False
        try:
            async with self.engine.connect() as connection:
                await connection.execute(text("SELECT 1"))
        except (SQLAlchemyError, OSError, TimeoutError):
            logger.warning("Database readiness check failed", exc_info=True)
            return False
        return True

    @asynccontextmanager
    async def session(self) -> AsyncIterator[AsyncSession]:
        """Yield a session enclosed in exactly one transaction.

        PostgreSQL RLS context is transaction-local, so closing this block
        clears it before the pooled connection can serve another tenant.
        """

        if self.session_factory is None:
            raise RuntimeError("Database is not configured")

        async with self.session_factory() as session, session.begin():
            yield session

    async def dispose(self) -> None:
        if self.engine is not None:
            await self.engine.dispose()
