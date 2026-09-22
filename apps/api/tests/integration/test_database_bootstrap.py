"""Verify the shipped Compose bootstrap with the actual migration history."""

import os

import asyncpg  # type: ignore[import-untyped]
import pytest

import app.models  # noqa: F401
from app.db.base import Base

APP_DSN = os.getenv("BEAUTYDOCS_BOOTSTRAP_APP_DSN")
MIGRATOR_DSN = os.getenv("BEAUTYDOCS_BOOTSTRAP_MIGRATOR_DSN")
pytestmark = [
    pytest.mark.asyncio,
    pytest.mark.skipif(not APP_DSN, reason="run with npm run db:test"),
]


async def test_bootstrap_runtime_role_and_schema_match_models() -> None:
    connection = await asyncpg.connect(APP_DSN)
    try:
        role = await connection.fetchrow(
            "SELECT rolsuper, rolbypassrls, rolcreatedb, rolcreaterole "
            "FROM pg_roles WHERE rolname = current_user"
        )
        assert role is not None
        assert not any(dict(role).values())
        assert not await connection.fetchval(
            "SELECT has_schema_privilege(current_user, 'public', 'CREATE')"
        )
        assert await connection.fetchval(
            "SELECT count(*) FROM pg_tables WHERE schemaname = 'public' "
            "AND tableowner = current_user"
        ) == 0
        columns = await connection.fetch(
            "SELECT table_name, column_name FROM information_schema.columns "
            "WHERE table_schema = 'public'"
        )
        actual = {(row["table_name"], row["column_name"]) for row in columns}
        expected = {
            (table.name, column.name)
            for table in Base.metadata.tables.values()
            for column in table.columns
        }
        assert expected <= actual
        assert actual - expected == {("alembic_version", "version_num")}
        assert await connection.fetchval("SELECT version_num FROM alembic_version")
        protected = await connection.fetch(
            "SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class "
            "WHERE relname IN ('clients', 'form_submissions', 'tenant_memberships')"
        )
        assert len(protected) == 3
        assert all(row["relrowsecurity"] and row["relforcerowsecurity"] for row in protected)
        with pytest.raises(asyncpg.InsufficientPrivilegeError):
            await connection.execute("CREATE TABLE public.forbidden_runtime_ddl (id int)")
    finally:
        await connection.close()


async def test_bootstrap_migrator_owns_tables_without_bypassing_rls() -> None:
    connection = await asyncpg.connect(MIGRATOR_DSN)
    try:
        assert await connection.fetchval(
            "SELECT tableowner = current_user FROM pg_tables "
            "WHERE schemaname = 'public' AND tablename = 'clients'"
        )
        assert not await connection.fetchval(
            "SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname = current_user"
        )
    finally:
        await connection.close()
