from unittest.mock import AsyncMock, MagicMock

from fastapi.testclient import TestClient
from pydantic import SecretStr, ValidationError

from app.core.config import Settings
from app.db.session import Database
from app.main import create_app


def test_health_reports_not_ready_without_database_and_keeps_liveness() -> None:
    with TestClient(create_app(Settings(_env_file=None))) as client:
        live = client.get("/health/live", headers={"X-Request-ID": "test-request-1"})
        ready = client.get("/health/ready")

    assert live.status_code == 200
    assert live.json() == {"status": "ok"}
    assert live.headers["X-Request-ID"] == "test-request-1"
    assert ready.status_code == 503
    assert ready.json() == {"status": "not_ready"}


def test_unknown_route_uses_standard_error_shape() -> None:
    with TestClient(create_app(Settings(_env_file=None))) as client:
        response = client.get("/does-not-exist")

    assert response.status_code == 404
    payload = response.json()
    assert payload["error"]["code"] == "not_found"
    assert payload["error"]["message"] == "Not Found"
    assert payload["error"]["request_id"] == response.headers["X-Request-ID"]


def test_readiness_tracks_database_state_and_lifespan_disposes_engine() -> None:
    database = MagicMock(spec=Database)
    database.is_ready = AsyncMock(side_effect=[True, False, True])
    database.dispose = AsyncMock()

    with TestClient(create_app(Settings(_env_file=None), database=database)) as client:
        unavailable = client.get("/health/ready")
        recovered = client.get("/health/ready")

    assert unavailable.status_code == 503
    assert recovered.status_code == 200
    assert database.is_ready.await_count == 3
    database.dispose.assert_awaited_once()


def test_tenant_is_resolved_from_subdomain() -> None:
    with TestClient(create_app(Settings(_env_file=None))) as client:
        response = client.get(
            "/api/v1/context",
            headers={"Host": "powderbrows.beautydocs.pl"},
        )

    assert response.status_code == 200
    assert response.json()["tenant"] == {"slug": "powderbrows", "source": "host"}


def test_untrusted_internal_tenant_header_is_rejected() -> None:
    settings = Settings(
        _env_file=None,
        trusted_proxy_cidrs=["10.0.0.0/8"],
        internal_tenant_header_secret=SecretStr("service-secret"),
    )
    with TestClient(create_app(settings), client=("127.0.0.1", 50000)) as client:
        response = client.get(
            "/api/v1/context",
            headers={
                "Host": "powderbrows.beautydocs.pl",
                "X-BeautyDocs-Tenant": "other-salon",
                "X-BeautyDocs-Internal-Secret": "service-secret",
            },
        )

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "untrusted_tenant_header"


def test_trusted_internal_tenant_header_requires_network_and_secret() -> None:
    settings = Settings(
        _env_file=None,
        trusted_proxy_cidrs=["127.0.0.0/8"],
        internal_tenant_header_secret=SecretStr("service-secret"),
    )
    with TestClient(create_app(settings), client=("127.0.0.1", 50000)) as client:
        response = client.get(
            "/api/v1/context",
            headers={
                "Host": "app.beautydocs.pl",
                "X-BeautyDocs-Tenant": "powderbrows",
                "X-BeautyDocs-Internal-Secret": "service-secret",
            },
        )

    assert response.status_code == 200
    assert response.json()["tenant"] == {
        "slug": "powderbrows",
        "source": "internal_header",
    }


def test_cors_wildcard_with_credentials_is_rejected() -> None:
    try:
        Settings(
            _env_file=None,
            cors_allowed_origins=["*"],
            cors_allow_credentials=True,
        )
    except ValidationError as exc:
        assert "CORS wildcard cannot be used with credentials" in str(exc)
    else:
        raise AssertionError("Expected invalid CORS configuration to fail")


def test_reserved_platform_subdomain_is_not_a_tenant() -> None:
    with TestClient(create_app(Settings(_env_file=None))) as client:
        response = client.get("/api/v1/context", headers={"Host": "static.beautydocs.pl"})

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "tenant_not_found"
