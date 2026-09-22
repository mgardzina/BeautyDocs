"""Copy the old admin records into an empty Alembic-managed database.

Default: count-only dry run. The source is always a read-only transaction.
The apply path preserves IDs, password hashes, signatures and JSON evidence,
skips temporary OTPs, and commits only after all table counts reconcile.
"""

from __future__ import annotations

import argparse
import asyncio
import json
from typing import cast

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import Table, func, inspect, select, text
from sqlalchemy.engine import URL, make_url
from sqlalchemy.ext.asyncio import create_async_engine

from app.models.legacy import (
    LegacyAdminUser,
    LegacyClient,
    LegacyClientNote,
    LegacyConsentForm,
    LegacyOtpVerification,
    LegacyTreatmentHistory,
)

TABLES = [
    cast(Table, model.__table__)
    for model in (
        LegacyAdminUser,
        LegacyClient,
        LegacyConsentForm,
        LegacyClientNote,
        LegacyTreatmentHistory,
    )
]
ALL_TABLES = [*TABLES, cast(Table, LegacyOtpVerification.__table__)]


class CopySettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    legacy_database_url: SecretStr
    beautydocs_database_url: SecretStr


def async_url(secret: SecretStr) -> URL:
    url = make_url(secret.get_secret_value())
    if url.get_backend_name() not in {"postgres", "postgresql"}:
        raise ValueError("Both databases must be PostgreSQL")
    query = dict(url.query)
    if "sslmode" in query:
        query["ssl"] = query.pop("sslmode")
    return url.set(drivername="postgresql+asyncpg", query=query)


async def copy_database(settings: CopySettings, *, apply: bool) -> dict[str, int]:
    source_url = async_url(settings.legacy_database_url)
    target_url = async_url(settings.beautydocs_database_url)
    source = create_async_engine(source_url, hide_parameters=True)
    target = create_async_engine(target_url, hide_parameters=True)
    try:
        async with (
            source.connect() as reader,
            target.connect() as writer,
            reader.begin(),
            writer.begin(),
        ):
            await reader.execute(text("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY"))
            # Resolve the actual server/database identity, including hostname aliases.
            identity = text(
                "SELECT current_database(), inet_server_addr()::text, inet_server_port()"
            )
            if (await reader.execute(identity)).one() == (await writer.execute(identity)).one():
                raise ValueError("Source and target must be different databases")
            for connection in (reader, writer):
                actual = await connection.run_sync(
                    lambda conn: {
                        table.name: {
                            column["name"] for column in inspect(conn).get_columns(table.name)
                        }
                        for table in ALL_TABLES
                    }
                )
                for table in ALL_TABLES:
                    if actual[table.name] != set(table.columns.keys()):
                        raise ValueError(f"Schema mismatch for {table.name}")
            if apply:
                # No web writes may slip between the empty-target check and commit.
                names = ", ".join(
                    writer.dialect.identifier_preparer.quote(t.name) for t in ALL_TABLES
                )
                await writer.execute(text(f"LOCK TABLE {names} IN ACCESS EXCLUSIVE MODE"))
            for table in ALL_TABLES:
                if await writer.scalar(select(func.count()).select_from(table)):
                    raise ValueError(
                        "The target admin tables must be empty; no records were overwritten"
                    )
            counts = {
                table.name: int(await reader.scalar(select(func.count()).select_from(table)) or 0)
                for table in TABLES
            }
            if not apply:
                return counts
            for table in TABLES:
                stream = await reader.stream(select(table))
                async for batch in stream.mappings().partitions(100):
                    await writer.execute(table.insert(), [dict(row) for row in batch])
                if (
                    await writer.scalar(select(func.count()).select_from(table))
                    != counts[table.name]
                ):
                    raise ValueError(f"Count reconciliation failed for {table.name}")
            return counts
    finally:
        await source.dispose()
        await target.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--apply", action="store_true", help="Copy records into empty target admin tables"
    )
    args = parser.parse_args()
    try:
        counts = asyncio.run(copy_database(CopySettings(), apply=args.apply))
    except ValueError as exc:
        parser.exit(1, f"{exc}\n")
    print(
        json.dumps(
            {
                "mode": "applied" if args.apply else "dry-run",
                "counts": counts,
                "temporaryOtpsCopied": False,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
