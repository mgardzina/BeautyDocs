from __future__ import annotations

from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.domain import SalonNotificationKind
from app.services.salon_notifications import (
    add_practitioner_signature_notification,
    resolve_practitioner_signature_notification,
)


def test_adds_an_actionable_notification_with_form_context() -> None:
    session = MagicMock(spec=AsyncSession)
    tenant_id = uuid4()
    submission_id = uuid4()
    client_id = uuid4()
    created_at = datetime(2026, 8, 9, 12, 30, tzinfo=UTC)

    notification = add_practitioner_signature_notification(
        session=session,
        tenant_id=tenant_id,
        submission_id=submission_id,
        client_id=client_id,
        client_name="Anna Nowak",
        form_name="Makijaż permanentny",
        practitioner_name="Ewa Testowa",
        created_at=created_at,
    )

    session.add.assert_called_once_with(notification)
    assert notification.tenant_id == tenant_id
    assert notification.resource_id == submission_id
    assert notification.kind == SalonNotificationKind.PRACTITIONER_SIGNATURE_REQUIRED
    assert notification.details["clientId"] == str(client_id)
    assert notification.details["submissionId"] == str(submission_id)
    assert "Ewa Testowa" in notification.body


@pytest.mark.asyncio
async def test_resolves_the_signature_notification_after_practitioner_signing() -> None:
    session = MagicMock(spec=AsyncSession)
    session.execute = AsyncMock()
    resolved_at = datetime(2026, 8, 9, 13, 0, tzinfo=UTC)

    await resolve_practitioner_signature_notification(
        session=session,
        tenant_id=uuid4(),
        submission_id=uuid4(),
        resolved_at=resolved_at,
    )

    statement = session.execute.await_args.args[0]
    compiled = str(statement.compile(compile_kwargs={"literal_binds": True}))
    assert "UPDATE salon_notifications" in compiled
    assert "resolved_at" in compiled
    assert "read_at" in compiled
