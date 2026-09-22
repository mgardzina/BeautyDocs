"""Durable notification helpers for the shared salon inbox."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import func, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.domain import (
    SalonNotification,
    SalonNotificationKind,
    SalonNotificationSeverity,
)


def add_practitioner_signature_notification(
    *,
    session: AsyncSession,
    tenant_id: UUID,
    submission_id: UUID,
    client_id: UUID,
    client_name: str,
    form_name: str,
    practitioner_name: str | None,
    created_at: datetime,
) -> SalonNotification:
    assignee = (
        f" Dokument czeka na podpis: {practitioner_name}."
        if practitioner_name
        else " Dokument czeka na podpis osoby wykonującej zabieg."
    )
    notification = SalonNotification(
        tenant_id=tenant_id,
        kind=SalonNotificationKind.PRACTITIONER_SIGNATURE_REQUIRED.value,
        severity=SalonNotificationSeverity.ACTION_REQUIRED.value,
        resource_type="form_submission",
        resource_id=submission_id,
        title="Formularz wymaga podpisu",
        body=f"{client_name} zakończyła formularz „{form_name}”.{assignee}",
        action_label="Otwórz formularz",
        details={
            "clientId": str(client_id),
            "submissionId": str(submission_id),
            "clientName": client_name,
            "formName": form_name,
            "practitionerName": practitioner_name,
        },
        created_at=created_at,
        updated_at=created_at,
    )
    session.add(notification)
    return notification


async def resolve_practitioner_signature_notification(
    *,
    session: AsyncSession,
    tenant_id: UUID,
    submission_id: UUID,
    resolved_at: datetime | None = None,
) -> None:
    now = resolved_at or datetime.now(UTC)
    await session.execute(
        update(SalonNotification)
        .where(
            SalonNotification.tenant_id == tenant_id,
            SalonNotification.kind
            == SalonNotificationKind.PRACTITIONER_SIGNATURE_REQUIRED.value,
            SalonNotification.resource_type == "form_submission",
            SalonNotification.resource_id == submission_id,
            SalonNotification.resolved_at.is_(None),
        )
        .values(
            resolved_at=now,
            read_at=func.coalesce(SalonNotification.read_at, now),
            updated_at=now,
        )
    )
