"""Durable, protected chat between consumer accounts and salon teams."""

from __future__ import annotations

from datetime import UTC, datetime
from functools import partial
from typing import Annotated, Literal
from urllib.parse import unquote
from uuid import UUID

from anyio import to_thread
from fastapi import APIRouter, Path, Request, Response
from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic.alias_generators import to_camel
from sqlalchemy import func, select
from starlette.responses import FileResponse

from app.api.dependencies import (
    CurrentConsumerDep,
    DbSessionDep,
    TenantAccessDep,
    TrustedOriginDep,
    enforce_roles,
)
from app.core.errors import AppError
from app.db.tenant_context import set_tenant_context
from app.models.domain import (
    ChatAttachment,
    ChatConversation,
    ChatMessage,
    ChatMessageKind,
    ChatSenderType,
    ConsumerAccount,
    FileObject,
    MembershipRole,
    TeamMember,
    Tenant,
    TenantStatus,
)
from app.services.chat_automation import (
    materialize_consumer_visit_reminders,
    materialize_tenant_visit_reminders,
)
from app.services.chat_files import (
    normalized_chat_file_name,
    resolve_chat_file,
    store_chat_file,
)

router = APIRouter(tags=["chat"])
NO_STORE_HEADERS = {"Cache-Control": "private, no-store"}
CHAT_READ_ROLES = frozenset(MembershipRole)
CHAT_WRITE_ROLES = frozenset({MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.STAFF})
ConversationIdPath = Annotated[UUID, Path()]
AttachmentIdPath = Annotated[UUID, Path()]


class ChatModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="forbid",
    )


class SendChatMessageRequest(ChatModel):
    body: str = Field(min_length=1, max_length=4_000)

    @field_validator("body")
    @classmethod
    def normalize_body(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Message cannot be empty")
        return normalized


class StartConsumerChatRequest(SendChatMessageRequest):
    tenant_slug: str = Field(min_length=1, max_length=63, pattern=r"^[a-z0-9-]+$")


class AssignChatPractitionerRequest(ChatModel):
    assigned_team_member_id: UUID | None = None


class ChatAttachmentResponse(ChatModel):
    id: UUID
    file_name: str = Field(max_length=255)
    content_type: str = Field(max_length=255)
    size_bytes: int = Field(ge=1)


class ChatMessageResponse(ChatModel):
    id: UUID
    sender_type: Literal["CONSUMER", "SALON", "SYSTEM"]
    sender_name: str = Field(max_length=200)
    kind: Literal[
        "TEXT",
        "ATTACHMENT",
        "VISIT_CREATED",
        "VISIT_RESCHEDULED",
        "VISIT_CANCELLED",
        "VISIT_REMINDER",
    ]
    body: str = Field(max_length=4_000)
    created_at: datetime
    attachments: list[ChatAttachmentResponse] = Field(default_factory=list, max_length=5)


class ChatConversationSummary(ChatModel):
    id: UUID
    tenant_slug: str = Field(max_length=63)
    salon_name: str = Field(max_length=200)
    consumer_name: str = Field(max_length=200)
    practitioner_id: UUID | None = None
    practitioner_name: str | None = Field(default=None, max_length=200)
    practitioner_job_title: str | None = Field(default=None, max_length=160)
    last_message_body: str | None = Field(default=None, max_length=500)
    last_message_sender_type: Literal["CONSUMER", "SALON", "SYSTEM"] | None
    last_message_at: datetime | None
    unread_count: int = Field(ge=0)


class ChatConversationList(ChatModel):
    items: list[ChatConversationSummary] = Field(max_length=100)
    unread_count: int = Field(ge=0)


class ChatConversationDetail(ChatConversationSummary):
    messages: list[ChatMessageResponse] = Field(max_length=300)


def _message_response(
    message: ChatMessage,
    attachments: list[ChatAttachmentResponse] | None = None,
) -> ChatMessageResponse:
    return ChatMessageResponse(
        id=message.id,
        sender_type=message.sender_type,
        sender_name=message.sender_name,
        kind=message.kind,
        body=message.body,
        created_at=message.created_at,
        attachments=attachments or [],
    )


async def _practitioner(
    session: DbSessionDep,
    conversation: ChatConversation,
) -> TeamMember | None:
    if conversation.assigned_team_member_id is None:
        return None
    return await session.scalar(
        select(TeamMember).where(
            TeamMember.tenant_id == conversation.tenant_id,
            TeamMember.id == conversation.assigned_team_member_id,
            TeamMember.is_active.is_(True),
        )
    )


async def _unread_count(
    session: DbSessionDep,
    conversation: ChatConversation,
    *,
    recipient: ChatSenderType,
) -> int:
    last_read_at = (
        conversation.consumer_last_read_at
        if recipient is ChatSenderType.CONSUMER
        else conversation.salon_last_read_at
    )
    filters = [
        ChatMessage.conversation_id == conversation.id,
    ]
    if recipient is ChatSenderType.CONSUMER:
        filters.append(
            ChatMessage.sender_type.in_([ChatSenderType.SALON.value, ChatSenderType.SYSTEM.value])
        )
    else:
        filters.append(ChatMessage.sender_type == ChatSenderType.CONSUMER.value)
    if last_read_at is not None:
        filters.append(ChatMessage.created_at > last_read_at)
    return int(
        await session.scalar(select(func.count()).select_from(ChatMessage).where(*filters)) or 0
    )


async def _summary(
    session: DbSessionDep,
    conversation: ChatConversation,
    *,
    tenant_slug: str,
    salon_name: str,
    consumer_name: str,
    recipient: ChatSenderType,
) -> ChatConversationSummary:
    practitioner = await _practitioner(session, conversation)
    return ChatConversationSummary(
        id=conversation.id,
        tenant_slug=tenant_slug,
        salon_name=salon_name,
        consumer_name=consumer_name,
        practitioner_id=practitioner.id if practitioner else None,
        practitioner_name=practitioner.display_name if practitioner else None,
        practitioner_job_title=practitioner.job_title if practitioner else None,
        last_message_body=conversation.last_message_body,
        last_message_sender_type=conversation.last_message_sender_type,
        last_message_at=conversation.last_message_at,
        unread_count=await _unread_count(session, conversation, recipient=recipient),
    )


async def _detail(
    session: DbSessionDep,
    conversation: ChatConversation,
    *,
    tenant_slug: str,
    salon_name: str,
    consumer_name: str,
    recipient: ChatSenderType,
) -> ChatConversationDetail:
    summary = await _summary(
        session,
        conversation,
        tenant_slug=tenant_slug,
        salon_name=salon_name,
        consumer_name=consumer_name,
        recipient=recipient,
    )
    messages = await session.scalars(
        select(ChatMessage)
        .where(ChatMessage.conversation_id == conversation.id)
        .order_by(ChatMessage.created_at.asc(), ChatMessage.id.asc())
        .limit(300)
    )
    message_items = messages.all()
    attachment_map: dict[UUID, list[ChatAttachmentResponse]] = {}
    if any(message.kind == ChatMessageKind.ATTACHMENT.value for message in message_items):
        attachment_rows = (
            await session.execute(
                select(ChatAttachment, FileObject)
                .join(
                    FileObject,
                    (FileObject.tenant_id == ChatAttachment.tenant_id)
                    & (FileObject.id == ChatAttachment.file_object_id),
                )
                .where(
                    ChatAttachment.conversation_id == conversation.id,
                    ChatAttachment.message_id.in_([item.id for item in message_items]),
                    FileObject.deleted_at.is_(None),
                )
                .order_by(ChatAttachment.created_at, ChatAttachment.id)
            )
        ).all()
        for row in attachment_rows:
            attachment_map.setdefault(row.ChatAttachment.message_id, []).append(
                ChatAttachmentResponse(
                    id=row.ChatAttachment.id,
                    file_name=row.ChatAttachment.file_name,
                    content_type=row.FileObject.content_type,
                    size_bytes=row.FileObject.size_bytes,
                )
            )
    return ChatConversationDetail(
        **summary.model_dump(),
        messages=[
            _message_response(message, attachment_map.get(message.id)) for message in message_items
        ],
    )


def _append_message(
    session: DbSessionDep,
    conversation: ChatConversation,
    *,
    sender_type: ChatSenderType,
    sender_name: str,
    body: str,
    now: datetime,
    kind: ChatMessageKind = ChatMessageKind.TEXT,
) -> ChatMessage:
    message = ChatMessage(
        tenant_id=conversation.tenant_id,
        conversation_id=conversation.id,
        sender_type=sender_type.value,
        sender_name=sender_name[:200],
        kind=kind.value,
        body=body,
        created_at=now,
    )
    conversation.last_message_body = body[:500]
    conversation.last_message_sender_type = sender_type.value
    conversation.last_message_at = now
    conversation.updated_at = now
    if sender_type is ChatSenderType.CONSUMER:
        conversation.consumer_last_read_at = now
    else:
        conversation.salon_last_read_at = now
    session.add(message)
    return message


async def _store_attachment_message(
    request: Request,
    session: DbSessionDep,
    conversation: ChatConversation,
    *,
    sender_type: ChatSenderType,
    sender_name: str,
) -> ChatMessageResponse:
    declared_length = request.headers.get("content-length")
    settings = request.app.state.settings
    if declared_length:
        try:
            too_large = int(declared_length) > settings.chat_upload_max_bytes
        except ValueError:
            too_large = True
        if too_large:
            raise AppError(
                status_code=413,
                code="chat_attachment_too_large",
                message="File is too large",
            )
    content = await request.body()
    raw_name = request.headers.get("x-beautydocs-file-name", "zalacznik")
    file_name = normalized_chat_file_name(unquote(raw_name))
    content_type = request.headers.get("content-type", "application/octet-stream")
    try:
        stored = await to_thread.run_sync(
            partial(
                store_chat_file,
                settings,
                tenant_id=conversation.tenant_id,
                conversation_id=conversation.id,
                content=content,
                content_type=content_type,
            )
        )
    except ValueError as exc:
        code = str(exc)
        status_code = 413 if code == "invalid_file_size" else 415
        raise AppError(
            status_code=status_code,
            code="chat_attachment_invalid",
            message="The attachment is invalid or unsupported",
        ) from exc
    raw_caption = request.headers.get("x-beautydocs-message-body", "")
    caption = unquote(raw_caption).strip()[:4_000]
    body = caption or f"Załącznik: {file_name}"
    now = datetime.now(UTC)
    message = _append_message(
        session,
        conversation,
        sender_type=sender_type,
        sender_name=sender_name,
        body=body,
        now=now,
        kind=ChatMessageKind.ATTACHMENT,
    )
    await session.flush()
    file_object = FileObject(
        tenant_id=conversation.tenant_id,
        kind="CHAT_ATTACHMENT",
        storage_provider="local",
        bucket="chat-attachments",
        object_key=stored.object_key,
        content_type=stored.content_type,
        size_bytes=stored.size_bytes,
        sha256=stored.sha256,
    )
    session.add(file_object)
    await session.flush()
    attachment = ChatAttachment(
        tenant_id=conversation.tenant_id,
        conversation_id=conversation.id,
        message_id=message.id,
        file_object_id=file_object.id,
        file_name=file_name,
        created_at=now,
    )
    session.add(attachment)
    await session.flush()
    return _message_response(
        message,
        [
            ChatAttachmentResponse(
                id=attachment.id,
                file_name=file_name,
                content_type=stored.content_type,
                size_bytes=stored.size_bytes,
            )
        ],
    )


async def _consumer_conversation_row(
    session: DbSessionDep,
    *,
    conversation_id: UUID,
    consumer_account_id: UUID,
):
    return (
        await session.execute(
            select(
                ChatConversation,
                Tenant.slug,
                Tenant.display_name,
                ConsumerAccount.full_name,
            )
            .join(Tenant, Tenant.id == ChatConversation.tenant_id)
            .join(
                ConsumerAccount,
                ConsumerAccount.id == ChatConversation.consumer_account_id,
            )
            .where(
                ChatConversation.id == conversation_id,
                ChatConversation.consumer_account_id == consumer_account_id,
            )
        )
    ).first()


async def _admin_conversation_row(
    session: DbSessionDep,
    *,
    conversation_id: UUID,
    tenant_id: UUID,
):
    return (
        await session.execute(
            select(
                ChatConversation,
                Tenant.slug,
                Tenant.display_name,
                ConsumerAccount.full_name,
            )
            .join(Tenant, Tenant.id == ChatConversation.tenant_id)
            .join(
                ConsumerAccount,
                ConsumerAccount.id == ChatConversation.consumer_account_id,
            )
            .where(
                ChatConversation.id == conversation_id,
                ChatConversation.tenant_id == tenant_id,
            )
        )
    ).first()


def _chat_not_found() -> AppError:
    return AppError(
        status_code=404,
        code="chat_not_found",
        message="Chat conversation was not found",
        headers=NO_STORE_HEADERS,
    )


@router.get("/consumer/chats", response_model=ChatConversationList)
async def list_consumer_chats(
    principal: CurrentConsumerDep,
    session: DbSessionDep,
    response: Response,
) -> ChatConversationList:
    response.headers.update(NO_STORE_HEADERS)
    await materialize_consumer_visit_reminders(
        session,
        principal.consumer_account_id,
    )
    rows = (
        await session.execute(
            select(
                ChatConversation,
                Tenant.slug,
                Tenant.display_name,
                ConsumerAccount.full_name,
            )
            .join(Tenant, Tenant.id == ChatConversation.tenant_id)
            .join(
                ConsumerAccount,
                ConsumerAccount.id == ChatConversation.consumer_account_id,
            )
            .where(ChatConversation.consumer_account_id == principal.consumer_account_id)
            .order_by(ChatConversation.last_message_at.desc().nullslast())
            .limit(100)
        )
    ).all()
    items: list[ChatConversationSummary] = []
    for row in rows:
        await set_tenant_context(session, row.ChatConversation.tenant_id)
        items.append(
            await _summary(
                session,
                row.ChatConversation,
                tenant_slug=row.slug,
                salon_name=row.display_name,
                consumer_name=row.full_name,
                recipient=ChatSenderType.CONSUMER,
            )
        )
    return ChatConversationList(
        items=items,
        unread_count=sum(item.unread_count for item in items),
    )


@router.post(
    "/consumer/chats",
    response_model=ChatConversationDetail,
    status_code=201,
)
async def start_consumer_chat(
    payload: StartConsumerChatRequest,
    _origin: TrustedOriginDep,
    principal: CurrentConsumerDep,
    session: DbSessionDep,
    response: Response,
) -> ChatConversationDetail:
    response.headers.update(NO_STORE_HEADERS)
    tenant = await session.scalar(
        select(Tenant).where(
            Tenant.slug == payload.tenant_slug,
            Tenant.status == TenantStatus.ACTIVE.value,
            Tenant.directory_visible.is_(True),
        )
    )
    if tenant is None:
        raise AppError(
            status_code=404,
            code="salon_not_found",
            message="Salon was not found",
            headers=NO_STORE_HEADERS,
        )
    account = await session.get(ConsumerAccount, principal.consumer_account_id)
    if account is None:
        raise _chat_not_found()
    conversation = await session.scalar(
        select(ChatConversation).where(
            ChatConversation.tenant_id == tenant.id,
            ChatConversation.consumer_account_id == principal.consumer_account_id,
        )
    )
    now = datetime.now(UTC)
    if conversation is None:
        conversation = ChatConversation(
            tenant_id=tenant.id,
            consumer_account_id=principal.consumer_account_id,
            created_at=now,
            updated_at=now,
        )
        session.add(conversation)
        await session.flush()
    await set_tenant_context(session, tenant.id)
    _append_message(
        session,
        conversation,
        sender_type=ChatSenderType.CONSUMER,
        sender_name=account.full_name,
        body=payload.body,
        now=now,
    )
    await session.flush()
    return await _detail(
        session,
        conversation,
        tenant_slug=tenant.slug,
        salon_name=tenant.display_name,
        consumer_name=account.full_name,
        recipient=ChatSenderType.CONSUMER,
    )


@router.get(
    "/consumer/chats/{conversation_id}",
    response_model=ChatConversationDetail,
)
async def get_consumer_chat(
    conversation_id: ConversationIdPath,
    principal: CurrentConsumerDep,
    session: DbSessionDep,
    response: Response,
) -> ChatConversationDetail:
    response.headers.update(NO_STORE_HEADERS)
    row = await _consumer_conversation_row(
        session,
        conversation_id=conversation_id,
        consumer_account_id=principal.consumer_account_id,
    )
    if row is None:
        raise _chat_not_found()
    await set_tenant_context(session, row.ChatConversation.tenant_id)
    return await _detail(
        session,
        row.ChatConversation,
        tenant_slug=row.slug,
        salon_name=row.display_name,
        consumer_name=row.full_name,
        recipient=ChatSenderType.CONSUMER,
    )


@router.post(
    "/consumer/chats/{conversation_id}/messages",
    response_model=ChatMessageResponse,
    status_code=201,
)
async def send_consumer_chat_message(
    conversation_id: ConversationIdPath,
    payload: SendChatMessageRequest,
    _origin: TrustedOriginDep,
    principal: CurrentConsumerDep,
    session: DbSessionDep,
    response: Response,
) -> ChatMessageResponse:
    response.headers.update(NO_STORE_HEADERS)
    row = await _consumer_conversation_row(
        session,
        conversation_id=conversation_id,
        consumer_account_id=principal.consumer_account_id,
    )
    if row is None:
        raise _chat_not_found()
    now = datetime.now(UTC)
    message = _append_message(
        session,
        row.ChatConversation,
        sender_type=ChatSenderType.CONSUMER,
        sender_name=row.full_name,
        body=payload.body,
        now=now,
    )
    await session.flush()
    return _message_response(message)


@router.post(
    "/consumer/chats/attachments",
    response_model=ChatConversationDetail,
    status_code=201,
)
async def start_consumer_chat_with_attachment(
    request: Request,
    _origin: TrustedOriginDep,
    principal: CurrentConsumerDep,
    session: DbSessionDep,
    response: Response,
) -> ChatConversationDetail:
    response.headers.update(NO_STORE_HEADERS)
    tenant_slug = request.headers.get("x-beautydocs-tenant-slug", "")
    tenant = await session.scalar(
        select(Tenant).where(
            Tenant.slug == tenant_slug,
            Tenant.status == TenantStatus.ACTIVE.value,
            Tenant.directory_visible.is_(True),
        )
    )
    account = await session.get(ConsumerAccount, principal.consumer_account_id)
    if tenant is None or account is None:
        raise _chat_not_found()
    conversation = await session.scalar(
        select(ChatConversation).where(
            ChatConversation.tenant_id == tenant.id,
            ChatConversation.consumer_account_id == principal.consumer_account_id,
        )
    )
    now = datetime.now(UTC)
    if conversation is None:
        conversation = ChatConversation(
            tenant_id=tenant.id,
            consumer_account_id=principal.consumer_account_id,
            created_at=now,
            updated_at=now,
        )
        session.add(conversation)
        await session.flush()
    await set_tenant_context(session, tenant.id)
    await _store_attachment_message(
        request,
        session,
        conversation,
        sender_type=ChatSenderType.CONSUMER,
        sender_name=account.full_name,
    )
    return await _detail(
        session,
        conversation,
        tenant_slug=tenant.slug,
        salon_name=tenant.display_name,
        consumer_name=account.full_name,
        recipient=ChatSenderType.CONSUMER,
    )


@router.post(
    "/consumer/chats/{conversation_id}/attachments",
    response_model=ChatMessageResponse,
    status_code=201,
)
async def upload_consumer_chat_attachment(
    conversation_id: ConversationIdPath,
    request: Request,
    _origin: TrustedOriginDep,
    principal: CurrentConsumerDep,
    session: DbSessionDep,
    response: Response,
) -> ChatMessageResponse:
    response.headers.update(NO_STORE_HEADERS)
    row = await _consumer_conversation_row(
        session,
        conversation_id=conversation_id,
        consumer_account_id=principal.consumer_account_id,
    )
    if row is None:
        raise _chat_not_found()
    await set_tenant_context(session, row.ChatConversation.tenant_id)
    return await _store_attachment_message(
        request,
        session,
        row.ChatConversation,
        sender_type=ChatSenderType.CONSUMER,
        sender_name=row.full_name,
    )


async def _attachment_file_response(
    request: Request,
    session: DbSessionDep,
    *,
    conversation: ChatConversation,
    attachment_id: UUID,
) -> FileResponse:
    await set_tenant_context(session, conversation.tenant_id)
    row = (
        await session.execute(
            select(ChatAttachment, FileObject)
            .join(
                FileObject,
                (FileObject.tenant_id == ChatAttachment.tenant_id)
                & (FileObject.id == ChatAttachment.file_object_id),
            )
            .where(
                ChatAttachment.tenant_id == conversation.tenant_id,
                ChatAttachment.conversation_id == conversation.id,
                ChatAttachment.id == attachment_id,
                FileObject.deleted_at.is_(None),
            )
        )
    ).first()
    if row is None:
        raise _chat_not_found()
    path = resolve_chat_file(request.app.state.settings, row.FileObject.object_key)
    if path is None:
        raise _chat_not_found()
    disposition = "inline" if row.FileObject.content_type.startswith("image/") else "attachment"
    return FileResponse(
        path,
        media_type=row.FileObject.content_type,
        filename=row.ChatAttachment.file_name,
        content_disposition_type=disposition,
        headers={
            **NO_STORE_HEADERS,
            "Content-Security-Policy": "default-src 'none'; sandbox",
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.get(
    "/consumer/chats/{conversation_id}/attachments/{attachment_id}",
    response_class=FileResponse,
)
async def download_consumer_chat_attachment(
    conversation_id: ConversationIdPath,
    attachment_id: AttachmentIdPath,
    request: Request,
    principal: CurrentConsumerDep,
    session: DbSessionDep,
) -> FileResponse:
    row = await _consumer_conversation_row(
        session,
        conversation_id=conversation_id,
        consumer_account_id=principal.consumer_account_id,
    )
    if row is None:
        raise _chat_not_found()
    return await _attachment_file_response(
        request,
        session,
        conversation=row.ChatConversation,
        attachment_id=attachment_id,
    )


@router.post("/consumer/chats/{conversation_id}/read", status_code=204)
async def mark_consumer_chat_read(
    conversation_id: ConversationIdPath,
    _origin: TrustedOriginDep,
    principal: CurrentConsumerDep,
    session: DbSessionDep,
) -> Response:
    row = await _consumer_conversation_row(
        session,
        conversation_id=conversation_id,
        consumer_account_id=principal.consumer_account_id,
    )
    if row is None:
        raise _chat_not_found()
    row.ChatConversation.consumer_last_read_at = datetime.now(UTC)
    await session.flush()
    return Response(status_code=204, headers=NO_STORE_HEADERS)


@router.get("/admin/tenants/{slug}/chats", response_model=ChatConversationList)
async def list_admin_chats(
    access: TenantAccessDep,
    session: DbSessionDep,
    response: Response,
) -> ChatConversationList:
    enforce_roles(access, CHAT_READ_ROLES)
    response.headers.update(NO_STORE_HEADERS)
    await materialize_tenant_visit_reminders(session, access.tenant)
    rows = (
        await session.execute(
            select(
                ChatConversation,
                Tenant.slug,
                Tenant.display_name,
                ConsumerAccount.full_name,
            )
            .join(Tenant, Tenant.id == ChatConversation.tenant_id)
            .join(
                ConsumerAccount,
                ConsumerAccount.id == ChatConversation.consumer_account_id,
            )
            .where(ChatConversation.tenant_id == access.tenant.id)
            .order_by(ChatConversation.last_message_at.desc().nullslast())
            .limit(100)
        )
    ).all()
    items = [
        await _summary(
            session,
            row.ChatConversation,
            tenant_slug=row.slug,
            salon_name=row.display_name,
            consumer_name=row.full_name,
            recipient=ChatSenderType.SALON,
        )
        for row in rows
    ]
    return ChatConversationList(
        items=items,
        unread_count=sum(item.unread_count for item in items),
    )


@router.get(
    "/admin/tenants/{slug}/chats/{conversation_id}",
    response_model=ChatConversationDetail,
)
async def get_admin_chat(
    conversation_id: ConversationIdPath,
    access: TenantAccessDep,
    session: DbSessionDep,
    response: Response,
) -> ChatConversationDetail:
    enforce_roles(access, CHAT_READ_ROLES)
    response.headers.update(NO_STORE_HEADERS)
    row = await _admin_conversation_row(
        session,
        conversation_id=conversation_id,
        tenant_id=access.tenant.id,
    )
    if row is None:
        raise _chat_not_found()
    return await _detail(
        session,
        row.ChatConversation,
        tenant_slug=row.slug,
        salon_name=row.display_name,
        consumer_name=row.full_name,
        recipient=ChatSenderType.SALON,
    )


@router.post(
    "/admin/tenants/{slug}/chats/{conversation_id}/messages",
    response_model=ChatMessageResponse,
    status_code=201,
)
async def send_admin_chat_message(
    conversation_id: ConversationIdPath,
    payload: SendChatMessageRequest,
    _origin: TrustedOriginDep,
    access: TenantAccessDep,
    session: DbSessionDep,
    response: Response,
) -> ChatMessageResponse:
    enforce_roles(access, CHAT_WRITE_ROLES)
    response.headers.update(NO_STORE_HEADERS)
    row = await _admin_conversation_row(
        session,
        conversation_id=conversation_id,
        tenant_id=access.tenant.id,
    )
    if row is None:
        raise _chat_not_found()
    now = datetime.now(UTC)
    message = _append_message(
        session,
        row.ChatConversation,
        sender_type=ChatSenderType.SALON,
        sender_name=access.principal.display_name,
        body=payload.body,
        now=now,
    )
    await session.flush()
    return _message_response(message)


@router.post(
    "/admin/tenants/{slug}/chats/{conversation_id}/attachments",
    response_model=ChatMessageResponse,
    status_code=201,
)
async def upload_admin_chat_attachment(
    conversation_id: ConversationIdPath,
    request: Request,
    _origin: TrustedOriginDep,
    access: TenantAccessDep,
    session: DbSessionDep,
    response: Response,
) -> ChatMessageResponse:
    enforce_roles(access, CHAT_WRITE_ROLES)
    response.headers.update(NO_STORE_HEADERS)
    row = await _admin_conversation_row(
        session,
        conversation_id=conversation_id,
        tenant_id=access.tenant.id,
    )
    if row is None:
        raise _chat_not_found()
    return await _store_attachment_message(
        request,
        session,
        row.ChatConversation,
        sender_type=ChatSenderType.SALON,
        sender_name=access.principal.display_name,
    )


@router.get(
    "/admin/tenants/{slug}/chats/{conversation_id}/attachments/{attachment_id}",
    response_class=FileResponse,
)
async def download_admin_chat_attachment(
    conversation_id: ConversationIdPath,
    attachment_id: AttachmentIdPath,
    request: Request,
    access: TenantAccessDep,
    session: DbSessionDep,
) -> FileResponse:
    enforce_roles(access, CHAT_READ_ROLES)
    row = await _admin_conversation_row(
        session,
        conversation_id=conversation_id,
        tenant_id=access.tenant.id,
    )
    if row is None:
        raise _chat_not_found()
    return await _attachment_file_response(
        request,
        session,
        conversation=row.ChatConversation,
        attachment_id=attachment_id,
    )


@router.patch(
    "/admin/tenants/{slug}/chats/{conversation_id}",
    response_model=ChatConversationDetail,
)
async def assign_admin_chat_practitioner(
    conversation_id: ConversationIdPath,
    payload: AssignChatPractitionerRequest,
    _origin: TrustedOriginDep,
    access: TenantAccessDep,
    session: DbSessionDep,
    response: Response,
) -> ChatConversationDetail:
    enforce_roles(
        access,
        frozenset({MembershipRole.OWNER, MembershipRole.ADMIN}),
    )
    response.headers.update(NO_STORE_HEADERS)
    row = await _admin_conversation_row(
        session,
        conversation_id=conversation_id,
        tenant_id=access.tenant.id,
    )
    if row is None:
        raise _chat_not_found()
    if payload.assigned_team_member_id is not None:
        practitioner = await session.scalar(
            select(TeamMember).where(
                TeamMember.tenant_id == access.tenant.id,
                TeamMember.id == payload.assigned_team_member_id,
                TeamMember.is_active.is_(True),
                TeamMember.performs_treatments.is_(True),
            )
        )
        if practitioner is None:
            raise _chat_not_found()
    row.ChatConversation.assigned_team_member_id = payload.assigned_team_member_id
    row.ChatConversation.updated_at = datetime.now(UTC)
    await session.flush()
    return await _detail(
        session,
        row.ChatConversation,
        tenant_slug=row.slug,
        salon_name=row.display_name,
        consumer_name=row.full_name,
        recipient=ChatSenderType.SALON,
    )


@router.post(
    "/admin/tenants/{slug}/chats/{conversation_id}/read",
    status_code=204,
)
async def mark_admin_chat_read(
    conversation_id: ConversationIdPath,
    _origin: TrustedOriginDep,
    access: TenantAccessDep,
    session: DbSessionDep,
) -> Response:
    enforce_roles(access, CHAT_READ_ROLES)
    row = await _admin_conversation_row(
        session,
        conversation_id=conversation_id,
        tenant_id=access.tenant.id,
    )
    if row is None:
        raise _chat_not_found()
    row.ChatConversation.salon_last_read_at = datetime.now(UTC)
    await session.flush()
    return Response(status_code=204, headers=NO_STORE_HEADERS)
