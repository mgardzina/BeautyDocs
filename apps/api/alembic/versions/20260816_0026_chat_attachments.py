"""Add practitioner routing, system messages and protected chat attachments.

Revision ID: 20260816_0026
Revises: 20260811_0025
Create Date: 2026-08-16
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20260816_0026"
down_revision: str | None = "20260811_0025"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "chat_conversations",
        sa.Column("assigned_team_member_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_chat_conversation_assigned_team_member",
        "chat_conversations",
        "team_members",
        ["tenant_id", "assigned_team_member_id"],
        ["tenant_id", "id"],
        ondelete="RESTRICT",
    )
    op.create_unique_constraint(
        "uq_chat_message_tenant_id",
        "chat_messages",
        ["tenant_id", "id"],
    )
    op.add_column(
        "chat_messages",
        sa.Column("kind", sa.String(length=32), nullable=False, server_default="TEXT"),
    )
    op.add_column(
        "chat_messages",
        sa.Column("event_key", sa.String(length=160), nullable=True),
    )
    op.drop_constraint("sender_type_allowed", "chat_messages", type_="check")
    op.create_check_constraint(
        "sender_type_allowed",
        "chat_messages",
        "sender_type IN ('CONSUMER', 'SALON', 'SYSTEM')",
    )
    op.create_check_constraint(
        "kind_allowed",
        "chat_messages",
        "kind IN ('TEXT', 'ATTACHMENT', 'VISIT_CREATED', 'VISIT_RESCHEDULED', "
        "'VISIT_CANCELLED', 'VISIT_REMINDER')",
    )
    op.create_unique_constraint(
        "uq_chat_message_conversation_event",
        "chat_messages",
        ["conversation_id", "event_key"],
    )
    op.create_table(
        "chat_attachments",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("conversation_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("message_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("file_object_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("file_name", sa.String(length=255), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint(
            "char_length(file_name) BETWEEN 1 AND 255",
            name="file_name_length",
        ),
        sa.ForeignKeyConstraint(
            ["tenant_id", "conversation_id"],
            ["chat_conversations.tenant_id", "chat_conversations.id"],
            name="fk_chat_attachment_conversation",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["tenant_id", "file_object_id"],
            ["file_objects.tenant_id", "file_objects.id"],
            name="fk_chat_attachment_file_object",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["tenant_id", "message_id"],
            ["chat_messages.tenant_id", "chat_messages.id"],
            name="fk_chat_attachment_message",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["tenant_id"],
            ["tenants.id"],
            name="fk_chat_attachments_tenant_id_tenants",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_chat_attachments"),
        sa.UniqueConstraint("tenant_id", "id", name="uq_chat_attachment_tenant_id"),
    )
    op.create_index(
        "ix_chat_attachments_message_created",
        "chat_attachments",
        ["message_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_chat_attachments_message_created", table_name="chat_attachments")
    op.drop_table("chat_attachments")
    op.drop_constraint("uq_chat_message_conversation_event", "chat_messages", type_="unique")
    op.drop_constraint("kind_allowed", "chat_messages", type_="check")
    op.drop_constraint("sender_type_allowed", "chat_messages", type_="check")
    op.create_check_constraint(
        "sender_type_allowed",
        "chat_messages",
        "sender_type IN ('CONSUMER', 'SALON')",
    )
    op.drop_column("chat_messages", "event_key")
    op.drop_column("chat_messages", "kind")
    op.drop_constraint("uq_chat_message_tenant_id", "chat_messages", type_="unique")
    op.drop_constraint(
        "fk_chat_conversation_assigned_team_member",
        "chat_conversations",
        type_="foreignkey",
    )
    op.drop_column("chat_conversations", "assigned_team_member_id")
