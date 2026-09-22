from __future__ import annotations

import base64
import io
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession
from test_admin_tenant_settings import _app, _tenant

from app.api.dependencies import get_db_session
from app.api.routes.salon_directory import visible
from app.core.config import Settings
from app.main import create_app
from app.models.domain import MembershipRole
from app.services.salon_profile import SalonPhoto, SalonProfile, SalonService


def photo() -> str:
    out = io.BytesIO()
    Image.new("RGB", (100, 80), "green").save(out, format="PNG")
    return "data:image/png;base64," + base64.b64encode(out.getvalue()).decode()


@pytest.mark.parametrize("price", [-1, 100_000_001, 1.5, True])
def test_invalid_prices_are_rejected(price):
    with pytest.raises(ValidationError):
        SalonService(name="Usługa", price=price)


@pytest.mark.parametrize(
    "value",
    [
        {"latitude": 52},
        {"longitude": 21},
        {"latitude": 91, "longitude": 21},
        {"latitude": 0, "longitude": 181},
    ],
)
def test_coordinates_must_be_a_valid_pair(value):
    with pytest.raises(ValidationError):
        SalonProfile(**value)


def test_images_are_decoded_and_normalized_to_metadata_free_jpeg():
    result = SalonPhoto(dataUrl=photo())
    image = Image.open(io.BytesIO(base64.b64decode(result.data_url.split(",")[1])))
    assert image.format == "JPEG"
    assert image.size == (100, 80)
    assert not image.getexif()


@pytest.mark.parametrize(
    "image", ["data:image/svg+xml;base64,AAAA", "data:image/png;base64," + "YQ==" * 20]
)
def test_disguised_or_invalid_images_are_rejected(image):
    with pytest.raises(ValidationError):
        SalonPhoto(dataUrl=image)


def test_gallery_and_service_limits():
    with pytest.raises(ValidationError):
        SalonProfile(photos=[{"dataUrl": photo()}] * 7)
    with pytest.raises(ValidationError):
        SalonProfile(services=[{"name": "Usługa", "price": 10000}] * 41)


@pytest.mark.parametrize(
    "role,expected",
    [(MembershipRole.OWNER, 200), (MembershipRole.ADMIN, 200), (MembershipRole.STAFF, 403)],
)
def test_only_owner_and_admin_can_publish(role, expected):
    tenant = _tenant()
    session = MagicMock(spec=AsyncSession)
    session.flush = AsyncMock()
    with TestClient(_app(session, tenant, role)) as client:
        response = client.put(
            "/api/v1/admin/tenants/salon-a/profile",
            json={
                "about": "O nas",
                "photos": [{"dataUrl": photo()}],
                "services": [{"name": "Manicure", "price": 12345, "priceFrom": True}],
            },
        )
        assert response.status_code == expected
        if expected == 200:
            saved = client.get("/api/v1/admin/tenants/salon-a/profile").json()
            assert saved["about"] == "O nas"
            assert saved["services"][0]["price"] == 12345
            assert saved["photos"][0]["dataUrl"].startswith("data:image/jpeg;")
            session.flush.assert_awaited_once()
        else:
            assert tenant.public_profile is None
            session.flush.assert_not_awaited()


def public_app(tenant):
    session = MagicMock(spec=AsyncSession)
    session.scalar = AsyncMock(return_value=tenant)

    async def session_override():
        yield session

    app = create_app(Settings(_env_file=None))
    app.dependency_overrides[get_db_session] = session_override
    return app, session


def test_public_profile_excludes_private_data_and_serves_real_photo():
    tenant = _tenant()
    tenant.public_profile = SalonProfile(
        photos=[{"dataUrl": photo(), "caption": "Wnętrze"}],
        services=[{"name": "Manicure", "price": 12000}],
    ).model_dump(by_alias=True)
    app, _ = public_app(tenant)
    with TestClient(app) as client:
        response = client.get("/api/v1/public/salons/salon-a")
        assert response.status_code == 200
        data = response.json()
        assert "email" not in data and "privacyContactEmail" not in data and "nip" not in data
        assert "data:image" not in response.text
        assert data["photos"][0]["caption"] == "Wnętrze"
        image = client.get("/api/v1/public/salons/salon-a/photos/0")
        assert image.status_code == 200
        assert image.headers["content-type"] == "image/jpeg"
        assert image.headers["cache-control"] == "no-store"
        assert Image.open(io.BytesIO(image.content)).size == (100, 80)
        assert client.get("/api/v1/public/salons/salon-a/photos/1").status_code == 404
        assert client.get("/api/v1/public/salons/salon-a/photos/-1").status_code == 404


def test_invisible_salon_and_photos_return_404():
    statement = str(visible().compile(compile_kwargs={"literal_binds": True}))
    assert "tenants.directory_visible IS true" in statement
    assert "tenants.status = 'ACTIVE'" in statement
    app, _ = public_app(None)
    with TestClient(app) as client:
        assert client.get("/api/v1/public/salons/hidden").status_code == 404
        assert client.get("/api/v1/public/salons/hidden/photos/0").status_code == 404


def test_search_paginates_and_never_returns_inline_photos():
    tenant = _tenant()
    tenant.public_profile = SalonProfile(photos=[{"dataUrl": photo()}]).model_dump(by_alias=True)
    app, session = public_app(tenant)
    rows = MagicMock()
    rows.all.return_value = [tenant] * 25
    session.scalars = AsyncMock(return_value=rows)
    with TestClient(app) as client:
        response = client.get("/api/v1/public/salons?query=Warszawa&offset=24")
        assert response.status_code == 200
        assert len(response.json()["items"]) == 24
        assert response.json()["nextOffset"] == 48
        assert "data:image" not in response.text
        assert client.get("/api/v1/public/salons?offset=-1").status_code == 422
    query = str(session.scalars.call_args.args[0])
    assert "directory_visible" in query and "LIMIT" in query and "OFFSET" in query


def test_saved_logo_is_linked_and_served_with_its_original_media_type():
    tenant = _tenant()
    tenant.logo_image = photo()
    app, _ = public_app(tenant)
    with TestClient(app) as client:
        profile = client.get("/api/v1/public/salons/salon-a").json()
        assert profile["logoUrl"] == "/api/beautydocs-preview/salons/salon-a/logo"
        response = client.get("/api/v1/public/salons/salon-a/logo")
        assert response.status_code == 200
        assert response.headers["content-type"] == "image/png"
        assert response.content == base64.b64decode(tenant.logo_image.split(",")[1])
        assert response.headers["cache-control"] == "no-store"
    hidden_app, _ = public_app(None)
    with TestClient(hidden_app) as client:
        assert client.get("/api/v1/public/salons/salon-a/logo").status_code == 404


def test_missing_logo_returns_null_and_404():
    app, _ = public_app(_tenant())
    with TestClient(app) as client:
        assert client.get("/api/v1/public/salons/salon-a").json()["logoUrl"] is None
        assert client.get("/api/v1/public/salons/salon-a/logo").status_code == 404
