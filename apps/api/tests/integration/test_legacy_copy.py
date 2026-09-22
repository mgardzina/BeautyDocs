import os
from uuid import uuid4

import pytest
from pydantic import SecretStr
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import create_async_engine

from app.cli.copy_legacy_database import CopySettings, async_url, copy_database
from app.models.legacy import (
    LegacyAdminUser,
    LegacyClient,
    LegacyConsentForm,
    LegacyOtpVerification,
)

SOURCE = os.getenv("BEAUTYDOCS_BOOTSTRAP_MIGRATOR_DSN")
TARGET = os.getenv("BEAUTYDOCS_INTEGRATION_MIGRATOR_DSN")
pytestmark = [
    pytest.mark.asyncio,
    pytest.mark.skipif(not SOURCE or not TARGET, reason="run with npm run db:test"),
]


async def test_copy_preserves_ids_hashes_evidence_and_refuses_nonempty_target() -> None:
    settings = CopySettings(
        _env_file=None,
        legacy_database_url=SecretStr(SOURCE),
        beautydocs_database_url=SecretStr(TARGET),
    )
    source = create_async_engine(async_url(settings.legacy_database_url))
    target = create_async_engine(async_url(settings.beautydocs_database_url))
    identifier = str(uuid4())
    evidence = {"signedAt": "2026-01-01T10:00:00Z", "metadata": [1, True, None]}
    try:
        async with source.begin() as conn:
            await conn.execute(
                LegacyClient.__table__.insert().values(id=identifier, imieNazwisko=identifier)
            )
            await conn.execute(
                LegacyAdminUser.__table__.insert().values(
                    id=identifier,
                    email=f"{identifier}@example.test",
                    passwordHash="$2b$synthetic-preserved",
                )
            )
            await conn.execute(
                LegacyConsentForm.__table__.insert().values(
                    id=identifier,
                    clientId=identifier,
                    imieNazwisko=identifier,
                    telefon="123",
                    miejscowoscData="Synthetic",
                    przeciwwskazania={},
                    zgodaPrzetwarzanieDanych=True,
                    zgodaMarketing=False,
                    zgodaFotografie=False,
                    podpisDane="synthetic-base64",
                    auditLog=evidence,
                )
            )
        counts = await copy_database(settings, apply=False)
        assert counts["Client"] == 1
        async with target.connect() as conn:
            assert await conn.scalar(select(func.count()).select_from(LegacyClient)) == 0
        assert await copy_database(settings, apply=True) == counts
        async with target.connect() as conn:
            row = (
                (
                    await conn.execute(
                        select(LegacyConsentForm.__table__).where(
                            LegacyConsentForm.id == identifier
                        )
                    )
                )
                .mappings()
                .one()
            )
            assert row["clientId"] == identifier
            assert row["auditLog"] == evidence
            assert row["podpisDane"] == "synthetic-base64"
            assert (
                await conn.scalar(
                    select(LegacyAdminUser.passwordHash).where(LegacyAdminUser.id == identifier)
                )
                == "$2b$synthetic-preserved"
            )
            assert await conn.scalar(select(func.count()).select_from(LegacyOtpVerification)) == 0
        with pytest.raises(ValueError, match="must be empty"):
            await copy_database(settings, apply=True)
        same = CopySettings(
            _env_file=None,
            legacy_database_url=SecretStr(SOURCE),
            beautydocs_database_url=SecretStr(SOURCE),
        )
        with pytest.raises(ValueError, match="different databases"):
            await copy_database(same, apply=False)
    finally:
        await source.dispose()
        await target.dispose()
