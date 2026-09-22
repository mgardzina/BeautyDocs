"""Shared salon inbox for actionable workflow notifications."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Path, Query, Response
from pydantic import BaseModel, ConfigDict, Field, model_validator
from pydantic.alias_generators import to_camel
from sqlalchemy import case, func, select

from app.api.dependencies import (
    DbSessionDep,
    TenantAccessDep,
    TrustedOriginDep,
    enforce_roles,
)
from app.core.errors import AppError
from app.models.domain import MembershipRole, SalonNotification

router = APIRouter(prefix="/admin/tenants", tags=["admin-notifications"])
INBOX_ROLES = frozenset(MembershipRole)
NO_STORE_HEADERS = {"Cache-Control": "private, no-store"}
NotificationIdPath = Annotated[UUID, Path()]
PageSizeQuery = Annotated[int, Query(alias="pageSize", ge=1, le=200)]


class NotificationResponseModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="forbid",
    )


class SalonNotificationResponse(NotificationResponseModel):
    id: UUID
    kind: str = Field(max_length=64)
    severity: str = Field(max_length=24)
    title: str = Field(max_length=250)
    body: str
    action_label: str | None = Field(default=None, max_length=120)
    client_id: UUID | None = None
    submission_id: UUID | None = None
    client_name: str | None = Field(default=None, max_length=300)
    form_name: str | None = Field(default=None, max_length=250)
    practitioner_name: str | None = Field(default=None, max_length=250)
    created_at: datetime
    read_at: datetime | None
    resolved_at: datetime | None
    archived_at: datetime | None


class SalonNotificationListResponse(NotificationResponseModel):
    items: list[SalonNotificationResponse] = Field(max_length=200)
    unread_count: int = Field(ge=0)


class UpdateSalonNotificationRequest(NotificationResponseModel):
    read: bool | None = None
    archived: bool | None = None

    @model_validator(mode="after")
    def validate_change(self) -> UpdateSalonNotificationRequest:
        if self.read is None and self.archived is None:
            raise ValueError("At least one notification change is required")
        return self


def _metadata_text(details: dict[str, Any], key: str, max_length: int) -> str | None:
    value = details.get(key)
    if not isinstance(value, str):
        return None
    normalized = value.strip()
    return normalized[:max_length] or None


def _metadata_uuid(details: dict[str, Any], key: str) -> UUID | None:
    value = details.get(key)
    if not isinstance(value, str):
        return None
    try:
        return UUID(value)
    except ValueError:
        return None


def _notification_response(notification: SalonNotification) -> SalonNotificationResponse:
    details = notification.details if isinstance(notification.details, dict) else {}
    return SalonNotificationResponse(
        id=notification.id,
        kind=notification.kind,
        severity=notification.severity,
        title=notification.title,
        body=notification.body,
        action_label=notification.action_label,
        client_id=_metadata_uuid(details, "clientId"),
        submission_id=_metadata_uuid(details, "submissionId"),
        client_name=_metadata_text(details, "clientName", 300),
        form_name=_metadata_text(details, "formName", 250),
        practitioner_name=_metadata_text(details, "practitionerName", 250),
        created_at=notification.created_at,
        read_at=notification.read_at,
        resolved_at=notification.resolved_at,
        archived_at=notification.archived_at,
    )


@router.get("/{slug}/notifications", response_model=SalonNotificationListResponse)
async def list_salon_notifications(
    access: TenantAccessDep,
    session: DbSessionDep,
    response: Response,
    page_size: PageSizeQuery = 100,
) -> SalonNotificationListResponse:
    enforce_roles(access, INBOX_ROLES)
    response.headers.update(NO_STORE_HEADERS)
    tenant_id = access.tenant.id
    notifications = await session.scalars(
        select(SalonNotification)
        .where(
            SalonNotification.tenant_id == tenant_id,
            SalonNotification.archived_at.is_(None),
        )
        .order_by(
            case((SalonNotification.resolved_at.is_(None), 0), else_=1),
            case((SalonNotification.read_at.is_(None), 0), else_=1),
            SalonNotification.created_at.desc(),
        )
        .limit(page_size)
    )
    unread_count = await session.scalar(
        select(func.count())
        .select_from(SalonNotification)
        .where(
            SalonNotification.tenant_id == tenant_id,
            SalonNotification.archived_at.is_(None),
            SalonNotification.resolved_at.is_(None),
            SalonNotification.read_at.is_(None),
        )
    )
    return SalonNotificationListResponse(
        items=[_notification_response(item) for item in notifications.all()],
        unread_count=unread_count or 0,
    )


@router.patch(
    "/{slug}/notifications/{notification_id}",
    response_model=SalonNotificationResponse,
)
async def update_salon_notification(
    notification_id: NotificationIdPath,
    payload: UpdateSalonNotificationRequest,
    _origin: TrustedOriginDep,
    access: TenantAccessDep,
    session: DbSessionDep,
    response: Response,
) -> SalonNotificationResponse:
    enforce_roles(access, INBOX_ROLES)
    response.headers.update(NO_STORE_HEADERS)
    notification = await session.scalar(
        select(SalonNotification).where(
            SalonNotification.tenant_id == access.tenant.id,
            SalonNotification.id == notification_id,
        )
    )
    if notification is None:
        raise AppError(
            status_code=404,
            code="notification_not_found",
            message="Notification was not found",
            headers=NO_STORE_HEADERS,
        )
    now = datetime.now(UTC)
    if payload.read is not None:
        notification.read_at = now if payload.read else None
    if payload.archived is not None:
        notification.archived_at = now if payload.archived else None
    notification.updated_at = now
    await session.flush()
    return _notification_response(notification)
