"""Idempotent visit events delivered inside BeautyDocs chat."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.tenant_context import set_tenant_context
from app.models.domain import (
    ChatConversation,
    ChatMessage,
    ChatMessageKind,
    ChatSenderType,
    Client,
    ConsumerAccount,
    ConsumerAppointment,
    TeamMember,
    Tenant,
    Visit,
    VisitStatus,
)

CHAT_TIME_ZONE = ZoneInfo("Europe/Warsaw")


def _visit_date(value: datetime) -> str:
    return value.astimezone(CHAT_TIME_ZONE).strftime("%d.%m.%Y o %H:%M")


async def _consumer_for_client(
    session: AsyncSession,
    client: Client,
) -> UUID | None:
    filters = []
    if client.phone_normalized:
        filters.append(ConsumerAccount.phone_normalized == client.phone_normalized)
    if client.email:
        filters.append(ConsumerAccount.email_normalized == client.email.strip().casefold())
    if not filters:
        return None
    return await session.scalar(
        select(ConsumerAccount.id)
        .where(ConsumerAccount.deleted_at.is_(None), or_(*filters))
        .limit(1)
    )


async def _conversation(
    session: AsyncSession,
    *,
    tenant_id: UUID,
    consumer_account_id: UUID,
    visit: Visit,
    now: datetime,
) -> ChatConversation:
    conversation = await session.scalar(
        select(ChatConversation).where(
            ChatConversation.tenant_id == tenant_id,
            ChatConversation.consumer_account_id == consumer_account_id,
        )
    )
    if conversation is None:
        conversation = ChatConversation(
            tenant_id=tenant_id,
            consumer_account_id=consumer_account_id,
            created_at=now,
            updated_at=now,
        )
        session.add(conversation)
        await session.flush()
    if conversation.assigned_team_member_id is None and visit.staff_membership_id is not None:
        conversation.assigned_team_member_id = await session.scalar(
            select(TeamMember.id).where(
                TeamMember.tenant_id == tenant_id,
                TeamMember.membership_id == visit.staff_membership_id,
                TeamMember.is_active.is_(True),
            )
        )
    return conversation


async def append_visit_chat_event(
    session: AsyncSession,
    *,
    tenant: Tenant,
    visit: Visit,
    kind: ChatMessageKind,
    consumer_account_id: UUID | None = None,
    client: Client | None = None,
    now: datetime | None = None,
) -> ChatMessage | None:
    """Append one event at most once; return None for clients without an app account."""

    event_time = now or datetime.now(UTC)
    if consumer_account_id is None:
        if client is None:
            client = await session.scalar(
                select(Client).where(
                    Client.tenant_id == tenant.id,
                    Client.id == visit.client_id,
                )
            )
        if client is None:
            return None
        consumer_account_id = await _consumer_for_client(session, client)
    if consumer_account_id is None:
        return None
    conversation = await _conversation(
        session,
        tenant_id=tenant.id,
        consumer_account_id=consumer_account_id,
        visit=visit,
        now=event_time,
    )
    event_key = f"visit:{visit.id}:{kind.value.casefold()}"
    existing = await session.scalar(
        select(ChatMessage.id).where(
            ChatMessage.conversation_id == conversation.id,
            ChatMessage.event_key == event_key,
        )
    )
    if existing is not None:
        return None
    date_label = _visit_date(visit.starts_at)
    messages = {
        ChatMessageKind.VISIT_CREATED: (
            f"Wizyta „{visit.treatment_name}” została umówiona na {date_label}. "
            "Tutaj możesz dopytać osobę wykonującą zabieg o przygotowanie i pielęgnację."
        ),
        ChatMessageKind.VISIT_RESCHEDULED: (
            f"Termin wizyty „{visit.treatment_name}” został zmieniony na {date_label}."
        ),
        ChatMessageKind.VISIT_CANCELLED: (
            f"Wizyta „{visit.treatment_name}” zaplanowana na {date_label} została anulowana."
        ),
        ChatMessageKind.VISIT_REMINDER: (
            f"Przypomnienie: wizyta „{visit.treatment_name}” odbędzie się {date_label}."
        ),
    }
    body = messages.get(kind)
    if body is None:
        return None
    message = ChatMessage(
        tenant_id=tenant.id,
        conversation_id=conversation.id,
        sender_type=ChatSenderType.SYSTEM.value,
        sender_name="BeautyDocs",
        kind=kind.value,
        event_key=event_key,
        body=body,
        created_at=event_time,
    )
    conversation.last_message_body = body[:500]
    conversation.last_message_sender_type = ChatSenderType.SYSTEM.value
    conversation.last_message_at = event_time
    conversation.updated_at = event_time
    session.add(message)
    await session.flush()
    return message


async def materialize_consumer_visit_reminders(
    session: AsyncSession,
    consumer_account_id: UUID,
    *,
    now: datetime | None = None,
) -> None:
    """Create due 24-hour reminders for appointments owned by this consumer."""

    event_time = now or datetime.now(UTC)
    links = (
        await session.scalars(
            select(ConsumerAppointment).where(
                ConsumerAppointment.consumer_account_id == consumer_account_id,
            )
        )
    ).all()
    for link in links:
        await set_tenant_context(session, link.tenant_id)
        row = (
            await session.execute(
                select(Visit, Tenant)
                .join(Tenant, Tenant.id == Visit.tenant_id)
                .where(
                    Visit.tenant_id == link.tenant_id,
                    Visit.id == link.visit_id,
                    Visit.status == VisitStatus.PLANNED.value,
                    Visit.starts_at > event_time,
                    Visit.starts_at <= event_time + timedelta(hours=24),
                )
            )
        ).first()
        if row is not None:
            await append_visit_chat_event(
                session,
                tenant=row.Tenant,
                visit=row.Visit,
                consumer_account_id=consumer_account_id,
                kind=ChatMessageKind.VISIT_REMINDER,
                now=event_time,
            )


async def materialize_tenant_visit_reminders(
    session: AsyncSession,
    tenant: Tenant,
    *,
    now: datetime | None = None,
) -> None:
    """Create due reminders for both online and manually added salon visits."""

    event_time = now or datetime.now(UTC)
    rows = (
        await session.execute(
            select(Visit, Client)
            .join(
                Client,
                (Client.tenant_id == Visit.tenant_id) & (Client.id == Visit.client_id),
            )
            .where(
                Visit.tenant_id == tenant.id,
                Visit.status == VisitStatus.PLANNED.value,
                Visit.starts_at > event_time,
                Visit.starts_at <= event_time + timedelta(hours=24),
            )
            .limit(500)
        )
    ).all()
    for row in rows:
        await append_visit_chat_event(
            session,
            tenant=tenant,
            visit=row.Visit,
            client=row.Client,
            kind=ChatMessageKind.VISIT_REMINDER,
            now=event_time,
        )
