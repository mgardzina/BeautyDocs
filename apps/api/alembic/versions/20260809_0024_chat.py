"""Add durable consumer-to-salon chat.

Revision ID: 20260809_0024
Revises: 20260809_0023
Create Date: 2026-08-09
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20260809_0024"
down_revision: str | None = "20260809_0023"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "chat_conversations",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("consumer_account_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("last_message_body", sa.String(length=500), nullable=True),
        sa.Column("last_message_sender_type", sa.String(length=16), nullable=True),
        sa.Column("last_message_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("consumer_last_read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("salon_last_read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(
            ["consumer_account_id"],
            ["consumer_accounts.id"],
            name="fk_chat_conversations_consumer_account_id_consumer_accounts",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["tenant_id"],
            ["tenants.id"],
            name="fk_chat_conversations_tenant_id_tenants",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_chat_conversations"),
        sa.UniqueConstraint(
            "tenant_id",
            "id",
            name="uq_chat_conversation_tenant_id",
        ),
        sa.UniqueConstraint(
            "tenant_id",
            "consumer_account_id",
            name="uq_chat_conversation_tenant_consumer",
        ),
    )
    op.create_index(
        "ix_chat_conversations_consumer_last_message",
        "chat_conversations",
        ["consumer_account_id", "last_message_at"],
    )
    op.create_index(
        "ix_chat_conversations_tenant_last_message",
        "chat_conversations",
        ["tenant_id", "last_message_at"],
    )
    op.create_table(
        "chat_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("conversation_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("sender_type", sa.String(length=16), nullable=False),
        sa.Column("sender_name", sa.String(length=200), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint(
            "sender_type IN ('CONSUMER', 'SALON')",
            name="sender_type_allowed",
        ),
        sa.CheckConstraint(
            "char_length(body) BETWEEN 1 AND 4000",
            name="body_length",
        ),
        sa.ForeignKeyConstraint(
            ["tenant_id", "conversation_id"],
            ["chat_conversations.tenant_id", "chat_conversations.id"],
            name="fk_chat_message_conversation",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["tenant_id"],
            ["tenants.id"],
            name="fk_chat_messages_tenant_id_tenants",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_chat_messages"),
    )
    op.create_index(
        "ix_chat_messages_conversation_created",
        "chat_messages",
        ["conversation_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_chat_messages_conversation_created",
        table_name="chat_messages",
    )
    op.drop_table("chat_messages")
    op.drop_index(
        "ix_chat_conversations_tenant_last_message",
        table_name="chat_conversations",
    )
    op.drop_index(
        "ix_chat_conversations_consumer_last_message",
        table_name="chat_conversations",
    )
    op.drop_table("chat_conversations")
