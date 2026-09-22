#!/usr/bin/env python3
"""Synchronize the global medicine catalogue from the public Polish RPL.

Run once after migrations and then schedule the same command daily:

    cd apps/api
    .venv/bin/python scripts/sync_rpl_catalog.py
"""

from __future__ import annotations

import argparse
import asyncio
from pathlib import Path

from app.core.config import Settings
from app.db.session import Database
from app.services.catalog_sync import sync_rpl_catalog

API_ROOT = Path(__file__).resolve().parents[1]


def _arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Synchronize human medicines from the official Polish RPL"
    )
    parser.add_argument(
        "--max-pages",
        type=int,
        help="Development-only page limit; omitted means a complete snapshot",
    )
    return parser.parse_args()


async def _run() -> int:
    arguments = _arguments()
    # Pydantic Settings supports this runtime override; its generated static
    # signature does not expose the private initialization keyword to mypy.
    settings = Settings(_env_file=API_ROOT / ".env")  # type: ignore[call-arg]
    database = Database(settings)
    if not database.configured:
        raise SystemExit("BEAUTYDOCS_DATABASE_URL is not configured")

    last_reported = 0

    def progress(completed: int, total: int) -> None:
        nonlocal last_reported
        if completed == total or completed - last_reported >= 10:
            print(f"RPL download: {completed}/{total} pages", flush=True)
            last_reported = completed

    try:
        async with database.session() as session:
            result = await sync_rpl_catalog(
                session,
                max_pages=arguments.max_pages,
                progress=progress,
            )
    finally:
        await database.dispose()

    mode = "complete" if result.complete_snapshot else "partial"
    print(
        "RPL synchronization complete: "
        f"mode={mode}, pages={result.pages_fetched}, "
        f"seen={result.products_seen}, imported={result.products_imported}",
        flush=True,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(_run()))
