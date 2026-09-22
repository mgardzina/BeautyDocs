"""Nightly synchronization of the public Polish RPL into the local catalogue."""

from __future__ import annotations

import asyncio
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

import httpx
from sqlalchemy import text, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.domain import MedicineCatalogSyncRun, MedicineProduct
from app.services.catalog import RPL_API_BASE, _rpl_item, normalize_catalog_search

RPL_PAGE_SIZE = 200
RPL_FETCH_CONCURRENCY = 4
RPL_MAX_PAGES = 1_000
RPL_SYNC_ADVISORY_LOCK_ID = 2_026_081_600_30


@dataclass(frozen=True, slots=True)
class MedicineCatalogSyncResult:
    products_seen: int
    products_imported: int
    pages_fetched: int
    complete_snapshot: bool


async def sync_rpl_catalog(
    session: AsyncSession,
    *,
    page_size: int = RPL_PAGE_SIZE,
    max_pages: int | None = None,
    progress: Callable[[int, int], None] | None = None,
) -> MedicineCatalogSyncResult:
    if page_size < 1 or page_size > 500:
        raise ValueError("page_size must be between 1 and 500")
    if max_pages is not None and max_pages < 1:
        raise ValueError("max_pages must be positive")

    lock_acquired = await session.scalar(
        text("SELECT pg_try_advisory_xact_lock(:lock_id)"),
        {"lock_id": RPL_SYNC_ADVISORY_LOCK_ID},
    )
    if lock_acquired is not True:
        raise RuntimeError("Another RPL catalogue synchronization is already running")

    started_at = datetime.now(UTC)
    run = MedicineCatalogSyncRun(status="RUNNING", started_at=started_at)
    session.add(run)
    await session.flush()

    timeout = httpx.Timeout(20.0, connect=5.0)
    async with httpx.AsyncClient(
        base_url=RPL_API_BASE,
        timeout=timeout,
        follow_redirects=False,
        headers={"Accept": "application/json", "User-Agent": "BeautyDocs-RPL-Sync/1.0"},
    ) as client:
        first_page = await _fetch_page(client, page=0, page_size=page_size)
        total_pages = _positive_int(first_page.get("totalPages"), "totalPages")
        total_elements = _nonnegative_int(first_page.get("totalElements"), "totalElements")
        if total_pages > RPL_MAX_PAGES:
            raise RuntimeError("RPL response exceeds the supported page limit")
        pages_to_fetch = total_pages if max_pages is None else min(total_pages, max_pages)
        pages: list[dict[str, Any]] = [first_page]
        if progress is not None:
            progress(1, pages_to_fetch)
        for batch_start in range(1, pages_to_fetch, RPL_FETCH_CONCURRENCY):
            page_numbers = range(
                batch_start,
                min(batch_start + RPL_FETCH_CONCURRENCY, pages_to_fetch),
            )
            batch = await asyncio.gather(
                *(
                    _fetch_page(client, page=page, page_size=page_size)
                    for page in page_numbers
                )
            )
            pages.extend(batch)
            if progress is not None:
                progress(len(pages), pages_to_fetch)

    records: dict[int, dict[str, Any]] = {}
    products_seen = 0
    for page in pages:
        content = page.get("content")
        if not isinstance(content, list):
            raise RuntimeError("RPL page does not contain a product list")
        products_seen += len(content)
        for raw in content:
            mapped = _rpl_item(raw)
            if mapped is None:
                continue
            details = mapped.details
            rpl_id = details.get("rplId")
            if not isinstance(rpl_id, int):
                continue
            records[rpl_id] = {
                "rpl_id": rpl_id,
                "name": mapped.name,
                "common_name": _optional_string(details.get("commonName")),
                "active_substance": _optional_string(details.get("activeSubstance")),
                "pharmaceutical_form": _optional_string(
                    details.get("pharmaceuticalForm")
                ),
                "strength": _optional_string(details.get("strength")),
                "marketing_authorisation_holder": mapped.brand,
                "registry_number": _optional_string(details.get("registryNumber")),
                "atc_code": _optional_string(details.get("atcCode")),
                "search_text": normalize_catalog_search(
                    " ".join(
                        part
                        for part in (
                            mapped.name,
                            mapped.brand,
                            _optional_string(details.get("commonName")),
                            _optional_string(details.get("activeSubstance")),
                            _optional_string(details.get("registryNumber")),
                            _optional_string(details.get("atcCode")),
                        )
                        if part
                    )
                ),
                "source_payload": {
                    "commonName": details.get("commonName"),
                    "activeSubstance": details.get("activeSubstance"),
                    "pharmaceuticalForm": details.get("pharmaceuticalForm"),
                    "strength": details.get("strength"),
                    "marketingAuthorisationHolder": details.get(
                        "marketingAuthorisationHolder"
                    ),
                    "registryNumber": details.get("registryNumber"),
                    "atcCode": details.get("atcCode"),
                },
                "is_active": True,
                "last_seen_at": started_at,
                "updated_at": started_at,
            }

    values = list(records.values())
    for start in range(0, len(values), 500):
        statement = insert(MedicineProduct).values(values[start : start + 500])
        await session.execute(
            statement.on_conflict_do_update(
                index_elements=[MedicineProduct.rpl_id],
                set_={
                    "name": statement.excluded.name,
                    "common_name": statement.excluded.common_name,
                    "active_substance": statement.excluded.active_substance,
                    "pharmaceutical_form": statement.excluded.pharmaceutical_form,
                    "strength": statement.excluded.strength,
                    "marketing_authorisation_holder": (
                        statement.excluded.marketing_authorisation_holder
                    ),
                    "registry_number": statement.excluded.registry_number,
                    "atc_code": statement.excluded.atc_code,
                    "search_text": statement.excluded.search_text,
                    "source_payload": statement.excluded.source_payload,
                    "is_active": True,
                    "last_seen_at": statement.excluded.last_seen_at,
                    "updated_at": statement.excluded.updated_at,
                },
            )
        )

    complete_snapshot = pages_to_fetch == total_pages
    if complete_snapshot:
        await session.execute(
            update(MedicineProduct)
            .where(MedicineProduct.last_seen_at < started_at)
            .values(is_active=False, updated_at=started_at)
        )

    run.status = "COMPLETED"
    run.finished_at = datetime.now(UTC)
    run.products_seen = total_elements if complete_snapshot else products_seen
    run.products_imported = len(records)
    await session.flush()
    return MedicineCatalogSyncResult(
        products_seen=run.products_seen,
        products_imported=run.products_imported,
        pages_fetched=len(pages),
        complete_snapshot=complete_snapshot,
    )


async def _fetch_page(
    client: httpx.AsyncClient,
    *,
    page: int,
    page_size: int,
) -> dict[str, Any]:
    response = await client.get(
        "/medicinal-products/search/public",
        params={"page": page, "size": page_size, "sort": "name,ASC"},
    )
    response.raise_for_status()
    payload = response.json()
    if not isinstance(payload, dict):
        raise RuntimeError("RPL returned an invalid page")
    return payload


def _positive_int(value: object, field: str) -> int:
    if not isinstance(value, int) or value < 1:
        raise RuntimeError(f"RPL returned an invalid {field}")
    return value


def _nonnegative_int(value: object, field: str) -> int:
    if not isinstance(value, int) or value < 0:
        raise RuntimeError(f"RPL returned an invalid {field}")
    return value


def _optional_string(value: object) -> str | None:
    return value if isinstance(value, str) and value else None
