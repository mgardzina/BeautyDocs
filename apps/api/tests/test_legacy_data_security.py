from fastapi.testclient import TestClient
from pydantic import SecretStr

from app.core.config import Settings
from app.main import create_app

KEY = "test-service-key-" + "x" * 40


def test_private_data_endpoint_rejects_missing_wrong_and_disabled_credentials() -> None:
    for configured in (None, SecretStr(KEY)):
        app = create_app(Settings(_env_file=None, database_url=None, legacy_service_key=configured))
        with TestClient(app) as client:
            for token in (None, "wrong-key"):
                headers = {} if token is None else {"Authorization": f"Bearer {token}"}
                response = client.post(
                    "/internal/legacy-data/adminUser/findMany", json={}, headers=headers
                )
                assert response.status_code == 401
            if configured is None:
                response = client.post(
                    "/internal/legacy-data/adminUser/findMany",
                    json={},
                    headers={"Authorization": f"Bearer {KEY}"},
                )
                assert response.status_code == 401


def test_internal_api_does_not_expose_domain_tables_or_appear_in_public_docs() -> None:
    app = create_app(Settings(_env_file=None, database_url=None, legacy_service_key=SecretStr(KEY)))
    with TestClient(app) as client:
        response = client.post(
            "/internal/legacy-data/users/findMany",
            json={},
            headers={"Authorization": f"Bearer {KEY}"},
        )
        assert response.status_code == 404
        assert not any(
            "legacy-data" in path for path in client.get("/openapi.json").json()["paths"]
        )
