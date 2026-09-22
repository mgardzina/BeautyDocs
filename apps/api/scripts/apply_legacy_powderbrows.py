#!/usr/bin/env python3
"""Dry-run or explicitly apply a reviewed PowderBrows plan to staging."""

from __future__ import annotations

import argparse
import asyncio
import os
from pathlib import Path

import asyncpg  # type: ignore[import-untyped]

from app.migration_tools.legacy_importer import (
    MigrationImportError,
    apply_migration_plan,
    load_migration_plan,
    load_reconciliation_report,
)

MIGRATION_DATABASE_URL_ENV = "BEAUTYDOCS_STAGING_MIGRATION_DATABASE_URL"
RUNTIME_DATABASE_URL_ENV = "BEAUTYDOCS_DATABASE_URL"


def _arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Validate a PowderBrows plan; write only with explicit --apply to staging"
        )
    )
    parser.add_argument("--plan", type=Path, required=True, help="Reviewed plan JSON")
    parser.add_argument(
        "--report", type=Path, required=True, help="Matching reconciliation report JSON"
    )
    parser.add_argument(
        "--environment",
        required=True,
        help="Safety gate; the only accepted value is staging",
    )
    parser.add_argument(
        "--expected-plan-fingerprint",
        required=True,
        help="Approved lowercase SHA-256 plan fingerprint",
    )
    parser.add_argument(
        "--change-ticket",
        required=True,
        help="Approved non-PII change ticket reference",
    )
    parser.add_argument(
        "--migration-role",
        required=True,
        help="Dedicated PostgreSQL staging migration role expected as current_user",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Explicitly write in one staging transaction; default is offline dry-run",
    )
    return parser.parse_args()


async def _run() -> int:
    arguments = _arguments()
    try:
        plan = load_migration_plan(arguments.plan)
        report = load_reconciliation_report(arguments.report)
    except (OSError, ValueError) as exc:
        raise MigrationImportError(
            "migration artifacts could not be loaded and validated"
        ) from exc

    connection: asyncpg.Connection | None = None
    if arguments.apply:
        migration_dsn = os.getenv(MIGRATION_DATABASE_URL_ENV)
        if not migration_dsn:
            raise MigrationImportError(
                f"dedicated staging DSN is missing from {MIGRATION_DATABASE_URL_ENV}"
            )
        runtime_dsn = os.getenv(RUNTIME_DATABASE_URL_ENV)
        if runtime_dsn and migration_dsn == runtime_dsn:
            raise MigrationImportError(
                "migration DSN must differ from the API runtime database DSN"
            )
        try:
            connection = await asyncpg.connect(migration_dsn, timeout=10)
        except (asyncpg.PostgresError, OSError, TimeoutError) as exc:
            raise MigrationImportError(
                "dedicated staging migration database connection failed"
            ) from exc

    try:
        result = await apply_migration_plan(
            connection,
            plan=plan,
            report=report,
            environment=arguments.environment,
            expected_plan_fingerprint=arguments.expected_plan_fingerprint,
            change_ticket=arguments.change_ticket,
            apply=arguments.apply,
            migration_role=arguments.migration_role,
        )
    finally:
        if connection is not None:
            await connection.close()

    print(
        "Migration staging gate complete: "
        f"status={result.status}, "
        f"inserted={sum(result.inserted_counts.values())}, "
        f"skipped={sum(result.skipped_counts.values())}"
    )
    return 0


def main() -> int:
    try:
        return asyncio.run(_run())
    except MigrationImportError as exc:
        raise SystemExit(f"Migration refused safely: {exc}") from None
    except Exception:
        # Validation/driver exceptions can embed values from sensitive rows.
        # The CLI intentionally emits only a generic fail-closed message.
        raise SystemExit(
            "Migration refused safely: unexpected validation or database failure"
        ) from None


if __name__ == "__main__":
    raise SystemExit(main())
