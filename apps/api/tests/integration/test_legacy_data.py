import os
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient
from pydantic import SecretStr

from app.core.config import Settings
from app.db.session import Database
from app.main import create_app
from app.models.legacy import LegacyAdminUser

DSN = os.getenv("BEAUTYDOCS_BOOTSTRAP_APP_DSN")
pytestmark = [pytest.mark.asyncio, pytest.mark.skipif(not DSN, reason="run with npm run db:test")]
KEY = "test-service-key-" + "x" * 40


async def test_legacy_admin_database_round_trip_preserves_contracts() -> None:
    settings = Settings(
        _env_file=None,
        database_url=SecretStr(DSN.replace("postgresql://", "postgresql+asyncpg://")),
        legacy_service_key=SecretStr(KEY),
    )
    database = Database(settings)
    app = create_app(settings, database)
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:

            async def rpc(entity, operation, query, status=200):
                response = await client.post(
                    f"/internal/legacy-data/{entity}/{operation}",
                    json=query,
                    headers={"Authorization": f"Bearer {KEY}"},
                )
                assert response.status_code == status, response.text
                if status == 200:
                    assert response.headers["cache-control"] == "private, no-store"
                return response.json()

            name = f"Test Client {uuid4()}"
            query = {
                "where": {"imieNazwisko": name},
                "create": {"imieNazwisko": name},
                "update": {"telefon": "48123456789"},
            }
            first = await rpc("client", "upsert", query)
            second = await rpc("client", "upsert", query)
            assert first["id"] == second["id"]
            assert second["telefon"] == "48123456789"
            assert second["createdAt"].endswith("+00:00")
            form = await rpc(
                "consentForm",
                "create",
                {
                    "data": {
                        "imieNazwisko": name,
                        "telefon": second["telefon"],
                        "clientId": second["id"],
                        "miejscowoscData": "Test",
                        "przeciwwskazania": {"medical": False},
                        "zgodaPrzetwarzanieDanych": True,
                        "zgodaMarketing": False,
                        "zgodaFotografie": False,
                        "podpisDane": "data:image/png;base64,synthetic",
                        "auditLog": {"createdAt": "evidence"},
                    }
                },
            )
            assert form["type"] == "LIP_AUGMENTATION"
            assert form["auditLog"]["createdAt"] == "evidence"
            note = await rpc(
                "clientNote",
                "create",
                {
                    "data": {
                        "clientId": second["id"],
                        "content": "Synthetic note",
                        "category": "ALERGIA",
                    }
                },
            )
            clients = await rpc(
                "client",
                "findMany",
                {
                    "where": {"forms": {"some": {}}, "id": second["id"]},
                    "include": {
                        "_count": {"select": {"forms": True, "notes": True}},
                        "forms": {
                            "take": 1,
                            "orderBy": {"createdAt": "desc"},
                            "select": {"createdAt": True},
                        },
                    },
                },
            )
            assert clients[0]["_count"] == {"forms": 1, "notes": 1}
            assert set(clients[0]["forms"][0]) == {"createdAt"}
            profile = await rpc(
                "client",
                "findUnique",
                {
                    "where": {"id": second["id"]},
                    "include": {"notes": True, "forms": True},
                },
            )
            assert profile["notes"][0]["id"] == note["id"]
            history = await rpc(
                "treatmentHistory",
                "create",
                {
                    "data": {
                        "formId": form["id"],
                        "date": "2026-09-12T10:00:00+02:00",
                        "description": "Visit",
                    }
                },
            )
            assert history["date"] == "2026-09-12T08:00:00+00:00"
            await rpc(
                "treatmentHistory",
                "update",
                {"where": {"id": history["id"]}, "data": {"description": "Updated"}},
            )
            found = await rpc(
                "treatmentHistory",
                "findMany",
                {
                    "where": {"formId": {"in": [form["id"]]}},
                    "orderBy": {"date": "desc"},
                },
            )
            assert found[0]["description"] == "Updated"
            await rpc(
                "consentForm",
                "update",
                {"where": {"id": form["id"]}, "data": {"email": "test@example.test"}},
            )
            otp = await rpc(
                "otpVerification",
                "create",
                {
                    "data": {
                        "phoneNumber": "48123456789",
                        "code": "123456",
                        "expiresAt": (datetime.now(UTC) + timedelta(minutes=5)).isoformat(),
                    }
                },
            )
            pending = await rpc(
                "otpVerification",
                "findFirst",
                {
                    "where": {
                        "id": otp["id"],
                        "verified": False,
                        "expiresAt": {"gt": datetime.now(UTC).isoformat()},
                    }
                },
            )
            assert pending["attempts"] == 0
            await rpc(
                "otpVerification",
                "update",
                {"where": {"id": otp["id"]}, "data": {"verified": True}},
            )
            assert (
                await rpc(
                    "otpVerification", "findFirst", {"where": {"id": otp["id"], "verified": False}}
                )
                is None
            )
            async with database.session() as session:
                session.add(
                    LegacyAdminUser(
                        email=f"{uuid4()}@example.test", passwordHash="synthetic", name=name
                    )
                )
            admins = await rpc("adminUser", "findMany", {"where": {"name": name}})
            assert admins[0]["passwordHash"] == "synthetic"
            await rpc("adminUser", "create", {"data": {}}, status=422)
            await rpc("consentForm", "update", {"data": {"email": "bad"}}, status=422)
            await rpc("client", "findMany", {"where": {"unknown": "bad"}}, status=422)
            await rpc("clientNote", "delete", {"where": {"id": note["id"]}})
            await rpc("consentForm", "delete", {"where": {"id": form["id"]}})
            assert (
                await rpc("treatmentHistory", "findMany", {"where": {"formId": form["id"]}}) == []
            )
            assert await rpc("consentForm", "findUnique", {"where": {"id": form["id"]}}) is None
    finally:
        await database.dispose()
