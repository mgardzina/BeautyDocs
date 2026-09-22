#!/usr/bin/env python3
"""Create a versioned, read-only JSON export from the legacy Prisma database."""

from __future__ import annotations

import argparse
import asyncio
import os
from pathlib import Path

from app.migration_tools.legacy_exporter import (
    create_legacy_export,
    create_legacy_inventory,
)
from app.migration_tools.legacy_powderbrows import LegacyExport, LegacyInventory, write_private_json


def _arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Export PowderBrows legacy data without modifying the source database"
    )
    parser.add_argument(
        "--output",
        type=Path,
        required=True,
        help="New JSON path; an existing file is never overwritten",
    )
    parser.add_argument(
        "--database-url-env",
        default="LEGACY_DATABASE_URL",
        help="Environment variable containing the source PostgreSQL DSN",
    )
    record_mode = parser.add_mutually_exclusive_group()
    record_mode.add_argument(
        "--include-records",
        action="store_true",
        help=(
            "Explicitly export client/form records while redacting signatures, "
            "auditLog, and password hashes; output still contains PII and health data"
        ),
    )
    record_mode.add_argument(
        "--include-sensitive",
        action="store_true",
        help=(
            "Explicitly include legacy password hashes, signature images, and auditLog; "
            "default output is a count-only inventory"
        ),
    )
    return parser.parse_args()


async def _run() -> int:
    arguments = _arguments()
    source_dsn = os.getenv(arguments.database_url_env)
    if not source_dsn:
        raise SystemExit(
            f"Source DSN environment variable is missing: {arguments.database_url_env}"
        )
    if arguments.output.exists():
        raise SystemExit("Output path already exists; refusing to overwrite it")

    export: LegacyExport | LegacyInventory
    if arguments.include_records or arguments.include_sensitive:
        export = await create_legacy_export(
            source_dsn,
            include_sensitive=arguments.include_sensitive,
        )
    else:
        export = await create_legacy_inventory(source_dsn)
    write_private_json(
        arguments.output,
        export.model_dump(mode="json", by_alias=True),
    )
    counts = export.record_counts
    print(
        "Legacy export created: "
        f"mode={export.mode}, clients={counts['clients']}, "
        f"notes={counts['clientNotes']}, forms={counts['consentForms']}, "
        f"admins={counts['adminUsers']}, histories={counts['treatmentHistories']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(_run()))
