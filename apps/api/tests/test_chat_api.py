from __future__ import annotations

from collections.abc import AsyncIterator
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import (
    get_db_session,
    get_optional_consumer,
    require_tenant_membership,
    require_trusted_origin,
)
from app.core.auth_context import AuthenticatedConsumer, AuthenticatedUser, TenantAccess
from app.core.config import Settings
from app.main import create_app
from app.models.domain import (
    ChatAttachment,
    ChatConversation,
    ChatMessage,
    ConsumerAccount,
    FileObject,
    MembershipRole,
    Tenant,
    TenantStatus,
)

ORIGIN = "http://localhost:3000"


def _tenant() -> Tenant:
    return Tenant(
        id=uuid4(),
        slug="salon-a",
        display_name="Salon A",
        legal_name="Salon A",
        email="salon@example.test",
        privacy_contact_email="privacy@example.test",
        status=TenantStatus.ACTIVE.value,
        directory_visible=True,
    )


def _consumer() -> ConsumerAccount:
    return ConsumerAccount(
        id=uuid4(),
        full_name="Anna Nowak",
        email="anna@example.test",
        email_normalized="anna@example.test",
        password_hash="$argon2id$dummy",
    )


def _consumer_app(
    session: MagicMock,
    account: ConsumerAccount,
    *,
    upload_directory: Path | None = None,
) -> FastAPI:
    principal = AuthenticatedConsumer(
        consumer_account_id=account.id,
        phone_normalized=None,
        full_name=account.full_name,
    )

    async def override_session() -> AsyncIterator[AsyncSession]:
        yield session

    app = create_app(
        Settings(
            _env_file=None,
            environment="test",
            auth_allowed_origins=[ORIGIN],
            chat_upload_directory=upload_directory or Path(".data/chat-attachments"),
        )
    )
    app.dependency_overrides[get_db_session] = override_session
    app.dependency_overrides[get_optional_consumer] = lambda: principal
    app.dependency_overrides[require_trusted_origin] = lambda: None
    return app


def _admin_app(session: MagicMock, tenant: Tenant, role: MembershipRole) -> FastAPI:
    access = TenantAccess(
        principal=AuthenticatedUser(
            user_id=uuid4(),
            email="staff@example.test",
            display_name="Ewa z salonu",
        ),
        tenant=tenant,
        role=role,
    )

    async def override_session() -> AsyncIterator[AsyncSession]:
        yield session

    app = create_app(Settings(_env_file=None))
    app.dependency_overrides[get_db_session] = override_session
    app.dependency_overrides[require_tenant_membership] = lambda: access
    app.dependency_overrides[require_trusted_origin] = lambda: None
    return app


def test_consumer_can_start_a_durable_salon_conversation() -> None:
    tenant = _tenant()
    account = _consumer()
    session = MagicMock(spec=AsyncSession)
    added: list[object] = []
    session.add = MagicMock(side_effect=added.append)

    async def flush() -> None:
        for item in added:
            if getattr(item, "id", None) is None:
                item.id = uuid4()

    session.flush = AsyncMock(side_effect=flush)
    session.get = AsyncMock(return_value=account)
    session.scalar = AsyncMock(side_effect=[tenant, None, 0])
    messages = MagicMock()
    messages.all.side_effect = lambda: [
        item for item in added if isinstance(item, ChatMessage)
    ]
    session.scalars = AsyncMock(return_value=messages)

    with TestClient(_consumer_app(session, account)) as client:
        response = client.post(
            "/api/v1/consumer/chats",
            headers={"Origin": ORIGIN},
            json={"tenantSlug": tenant.slug, "body": "  Jak przygotować się do zabiegu?  "},
        )

    assert response.status_code == 201
    payload = response.json()
    assert payload["salonName"] == "Salon A"
    assert payload["consumerName"] == "Anna Nowak"
    assert payload["messages"][0]["body"] == "Jak przygotować się do zabiegu?"
    assert payload["messages"][0]["senderType"] == "CONSUMER"
    assert any(isinstance(item, ChatConversation) for item in added)
    assert any(isinstance(item, ChatMessage) for item in added)


def test_consumer_cannot_send_an_empty_chat_message() -> None:
    account = _consumer()
    session = MagicMock(spec=AsyncSession)

    with TestClient(_consumer_app(session, account)) as client:
        response = client.post(
            f"/api/v1/consumer/chats/{uuid4()}/messages",
            headers={"Origin": ORIGIN},
            json={"body": "   "},
        )

    assert response.status_code == 422


def test_consumer_can_start_chat_with_a_protected_png_attachment(tmp_path: Path) -> None:
    tenant = _tenant()
    account = _consumer()
    session = MagicMock(spec=AsyncSession)
    added: list[object] = []
    session.add = MagicMock(side_effect=added.append)

    async def flush() -> None:
        for item in added:
            if getattr(item, "id", None) is None:
                item.id = uuid4()

    session.flush = AsyncMock(side_effect=flush)
    session.get = AsyncMock(return_value=account)
    session.scalar = AsyncMock(side_effect=[tenant, None, 0])
    messages = MagicMock()
    messages.all.side_effect = lambda: [
        item for item in added if isinstance(item, ChatMessage)
    ]
    session.scalars = AsyncMock(return_value=messages)

    tenant_context_result = MagicMock()
    attachment_result = MagicMock()

    def attachment_rows():
        attachment = next(item for item in added if isinstance(item, ChatAttachment))
        file_object = next(item for item in added if isinstance(item, FileObject))
        return [SimpleNamespace(ChatAttachment=attachment, FileObject=file_object)]

    attachment_result.all.side_effect = attachment_rows
    session.execute = AsyncMock(side_effect=[tenant_context_result, attachment_result])
    png = b"\x89PNG\r\n\x1a\n" + b"test-image"

    with TestClient(
        _consumer_app(session, account, upload_directory=tmp_path)
    ) as client:
        response = client.post(
            "/api/v1/consumer/chats/attachments",
            content=png,
            headers={
                "Origin": ORIGIN,
                "Content-Type": "image/png",
                "X-BeautyDocs-Tenant-Slug": tenant.slug,
                "X-BeautyDocs-File-Name": "zdjecie.png",
                "X-BeautyDocs-Message-Body": "Czy gojenie wyglada prawidlowo?",
            },
        )

    assert response.status_code == 201
    payload = response.json()
    assert payload["messages"][0]["kind"] == "ATTACHMENT"
    assert payload["messages"][0]["attachments"][0]["fileName"] == "zdjecie.png"
    assert payload["messages"][0]["attachments"][0]["contentType"] == "image/png"
    stored = next(item for item in added if isinstance(item, FileObject))
    assert (tmp_path / stored.object_key).read_bytes() == png


def test_read_only_salon_member_cannot_send_chat_messages() -> None:
    tenant = _tenant()
    session = MagicMock(spec=AsyncSession)

    with TestClient(_admin_app(session, tenant, MembershipRole.READ_ONLY)) as client:
        response = client.post(
            f"/api/v1/admin/tenants/{tenant.slug}/chats/{uuid4()}/messages",
            headers={"Origin": ORIGIN},
            json={"body": "Odpowiedź salonu"},
        )

    assert response.status_code == 403
