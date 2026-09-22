"""Read-only PostgreSQL exporter for the PowderBrows Prisma schema."""

from __future__ import annotations

import hashlib
import json
from datetime import UTC, datetime
from typing import Any

import asyncpg  # type: ignore[import-untyped]

from app.migration_tools.legacy_powderbrows import (
    EXPORT_SCHEMA_VERSION,
    INVENTORY_SCHEMA_VERSION,
    LEGACY_DATABASE_SCHEMA_FINGERPRINT,
    LEGACY_PRISMA_SCHEMA_FINGERPRINT,
    LegacyExport,
    LegacyInventory,
)

TABLE_EXPORTS = {
    "clients": "Client",
    "clientNotes": "ClientNote",
    "consentForms": "ConsentForm",
    "adminUsers": "AdminUser",
    "treatmentHistories": "TreatmentHistory",
}

EXPECTED_TABLE_COLUMNS = {
    "Client": {"id", "createdAt", "updatedAt", "imieNazwisko", "telefon"},
    "ClientNote": {
        "id",
        "createdAt",
        "updatedAt",
        "content",
        "category",
        "clientId",
    },
    "ConsentForm": {
        "id",
        "type",
        "createdAt",
        "imieNazwisko",
        "email",
        "ulica",
        "kodPocztowy",
        "miasto",
        "dataUrodzenia",
        "telefon",
        "miejscowoscData",
        "nazwaProduktu",
        "obszarZabiegu",
        "celEfektu",
        "znieczulenie",
        "przeciwwskazania",
        "zgodaPrzetwarzanieDanych",
        "zgodaMarketing",
        "zgodaFotografie",
        "zgodaPomocPrawna",
        "miejscaPublikacjiFotografii",
        "podpisDane",
        "podpisMarketing",
        "podpisFotografie",
        "podpisRodo",
        "podpisRodo2",
        "informacjaDodatkowa",
        "zastrzeniaKlienta",
        "numerZabiegu",
        "osobaPrzeprowadzajacaZabieg",
        "metodaZabiegu",
        "planowanaIloscZabiegow",
        "odstepMiedzyZabiegami",
        "kolejneZabiegiOdstepy",
        "iloscProduktu",
        "signatureStatus",
        "signatureVerifiedAt",
        "auditLog",
        "clientId",
    },
    "OtpVerification": {
        "id",
        "phoneNumber",
        "code",
        "formId",
        "expiresAt",
        "verified",
        "attempts",
        "createdAt",
    },
    "AdminUser": {"id", "email", "phoneNumber", "passwordHash", "name"},
    "TreatmentHistory": {
        "id",
        "createdAt",
        "date",
        "description",
        "znieczulenie",
        "formId",
    },
}

SENSITIVE_FIELDS = {
    "ConsentForm": {
        "podpisDane",
        "podpisMarketing",
        "podpisFotografie",
        "podpisRodo",
        "podpisRodo2",
        "auditLog",
    },
    "AdminUser": {"passwordHash"},
}


def _schema_fingerprint(columns_by_table: dict[str, set[str]]) -> str:
    canonical_schema = {
        table_name: sorted(columns) for table_name, columns in sorted(columns_by_table.items())
    }
    serialized = json.dumps(canonical_schema, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(serialized).hexdigest()


EXPECTED_DATABASE_SCHEMA_FINGERPRINT = _schema_fingerprint(EXPECTED_TABLE_COLUMNS)
if EXPECTED_DATABASE_SCHEMA_FINGERPRINT != LEGACY_DATABASE_SCHEMA_FINGERPRINT:
    raise RuntimeError("expected legacy column contract fingerprint is inconsistent")


async def _verify_legacy_schema(connection: asyncpg.Connection) -> str:
    table_names = sorted(EXPECTED_TABLE_COLUMNS)
    rows = await connection.fetch(
        """
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = ANY($1::text[])
        ORDER BY table_name, ordinal_position
        """,
        table_names,
    )
    actual_columns: dict[str, set[str]] = {table_name: set() for table_name in table_names}
    for row in rows:
        actual_columns[row["table_name"]].add(row["column_name"])

    mismatched_tables = sorted(
        table_name
        for table_name in table_names
        if actual_columns[table_name] != EXPECTED_TABLE_COLUMNS[table_name]
    )
    if mismatched_tables:
        raise RuntimeError(
            "legacy database schema does not match export v1 for tables: "
            + ", ".join(mismatched_tables)
        )

    actual_fingerprint = _schema_fingerprint(actual_columns)
    if actual_fingerprint != EXPECTED_DATABASE_SCHEMA_FINGERPRINT:
        raise RuntimeError("legacy database schema fingerprint verification failed")
    return actual_fingerprint


async def _fetch_table(connection: asyncpg.Connection, table_name: str) -> list[dict[str, Any]]:
    if table_name not in TABLE_EXPORTS.values():
        raise ValueError("table is not part of the versioned legacy export")
    rows = await connection.fetch(
        f"""
        SELECT row_to_json(exported_row)::text AS payload
        FROM (
            SELECT *
            FROM "{table_name}"
            ORDER BY id
        ) AS exported_row
        """
    )
    return [json.loads(row["payload"]) for row in rows]


async def _fetch_count(connection: asyncpg.Connection, table_name: str) -> int:
    if table_name not in EXPECTED_TABLE_COLUMNS:
        raise ValueError("table is not part of the versioned legacy inventory")
    count = await connection.fetchval(f'SELECT count(*) FROM "{table_name}"')
    return int(count)


def _redact_records(records: dict[str, list[dict[str, Any]]]) -> dict[str, list[str]]:
    redactions: dict[str, list[str]] = {}
    for record_key, table_name in TABLE_EXPORTS.items():
        sensitive_fields = SENSITIVE_FIELDS.get(table_name, set())
        if not sensitive_fields:
            continue
        for record in records[record_key]:
            redacted_fields: list[str] = []
            for field in sorted(sensitive_fields):
                if record.get(field) is not None:
                    record[field] = None
                    redacted_fields.append(field)
            if redacted_fields:
                redactions[f"{table_name}:{record['id']}"] = redacted_fields
    return redactions


async def create_legacy_export(
    source_dsn: str,
    *,
    include_sensitive: bool,
) -> LegacyExport:
    """Export a consistent snapshot inside a verified read-only transaction."""

    connection = await asyncpg.connect(source_dsn)
    try:
        async with connection.transaction(isolation="repeatable_read", readonly=True):
            transaction_read_only = await connection.fetchval(
                "SELECT current_setting('transaction_read_only')"
            )
            if transaction_read_only != "on":
                raise RuntimeError("legacy export transaction is not read-only")

            schema_fingerprint = await _verify_legacy_schema(connection)

            records = {
                record_key: await _fetch_table(connection, table_name)
                for record_key, table_name in TABLE_EXPORTS.items()
            }
            otp_count = await _fetch_count(connection, "OtpVerification")
    finally:
        await connection.close()

    redactions = {} if include_sensitive else _redact_records(records)
    payload = {
        "schemaVersion": EXPORT_SCHEMA_VERSION,
        "exportedAt": datetime.now(UTC).isoformat(),
        "mode": "sensitive" if include_sensitive else "restricted-records",
        "source": {
            "provider": "prisma-postgresql",
            "schemaFingerprint": schema_fingerprint,
            "prismaSchemaFingerprint": LEGACY_PRISMA_SCHEMA_FINGERPRINT,
            "readOnlyTransaction": True,
        },
        "recordCounts": {
            record_key: len(record_rows) for record_key, record_rows in records.items()
        },
        "redactions": redactions,
        "omitted": [
            {
                "entity": "otpVerifications",
                "count": int(otp_count),
                "reason": (
                    "Raw OTP codes are operational secrets and are intentionally "
                    "excluded from migration"
                ),
            }
        ],
        "records": records,
    }
    return LegacyExport.model_validate(payload)


async def create_legacy_inventory(source_dsn: str) -> LegacyInventory:
    """Export only verified table counts; no record or PII/health fields are read."""

    connection = await asyncpg.connect(source_dsn)
    try:
        async with connection.transaction(isolation="repeatable_read", readonly=True):
            transaction_read_only = await connection.fetchval(
                "SELECT current_setting('transaction_read_only')"
            )
            if transaction_read_only != "on":
                raise RuntimeError("legacy inventory transaction is not read-only")

            schema_fingerprint = await _verify_legacy_schema(connection)
            record_counts = {
                record_key: await _fetch_count(connection, table_name)
                for record_key, table_name in TABLE_EXPORTS.items()
            }
            otp_count = await _fetch_count(connection, "OtpVerification")
    finally:
        await connection.close()

    return LegacyInventory.model_validate(
        {
            "schemaVersion": INVENTORY_SCHEMA_VERSION,
            "exportedAt": datetime.now(UTC).isoformat(),
            "mode": "inventory",
            "source": {
                "provider": "prisma-postgresql",
                "schemaFingerprint": schema_fingerprint,
                "prismaSchemaFingerprint": LEGACY_PRISMA_SCHEMA_FINGERPRINT,
                "readOnlyTransaction": True,
            },
            "recordCounts": record_counts,
            "omitted": [
                {
                    "entity": "otpVerifications",
                    "count": otp_count,
                    "reason": "OTP records are counted but never exported",
                }
            ],
        }
    )
