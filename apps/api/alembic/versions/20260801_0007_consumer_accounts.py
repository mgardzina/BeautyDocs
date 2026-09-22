"""Add passwordless consumer accounts, document claims and sharing links.

Revision ID: 20260801_0007
Revises: 20260729_0006
Create Date: 2026-08-01
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20260801_0007"
down_revision: str | None = "20260729_0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "consumer_accounts",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("phone", sa.String(length=32), nullable=False),
        sa.Column("phone_normalized", sa.String(length=32), nullable=False),
        sa.Column("full_name", sa.String(length=200), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=True),
        sa.Column("birth_date", sa.Date(), nullable=True),
        sa.Column("street", sa.String(length=250), nullable=True),
        sa.Column("postal_code", sa.String(length=20), nullable=True),
        sa.Column("city", sa.String(length=120), nullable=True),
        sa.Column(
            "medical_profile",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("medical_profile_updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("phone_verified_at", sa.DateTime(timezone=True), nullable=False),
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
        sa.PrimaryKeyConstraint("id", name="pk_consumer_accounts"),
        sa.UniqueConstraint("phone_normalized", name="uq_consumer_accounts_phone"),
    )
    op.create_index("ix_consumer_accounts_created", "consumer_accounts", ["created_at"])

    op.create_table(
        "consumer_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("consumer_account_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("token_digest", sa.String(length=64), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("char_length(token_digest) = 64", name="token_digest_sha256"),
        sa.CheckConstraint("expires_at > created_at", name="expiry_after_creation"),
        sa.ForeignKeyConstraint(
            ["consumer_account_id"],
            ["consumer_accounts.id"],
            name="fk_consumer_session_account",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_consumer_sessions"),
        sa.UniqueConstraint("token_digest", name="uq_consumer_sessions_token_digest"),
    )
    op.create_index(
        "ix_consumer_sessions_account_expires",
        "consumer_sessions",
        ["consumer_account_id", "expires_at"],
    )
    op.create_index("ix_consumer_sessions_expires", "consumer_sessions", ["expires_at"])

    op.create_table(
        "consumer_login_challenges",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("phone_normalized", sa.String(length=32), nullable=False),
        sa.Column("destination_masked", sa.String(length=64), nullable=False),
        sa.Column("otp_digest", sa.String(length=255), nullable=False),
        sa.Column(
            "status",
            sa.String(length=16),
            nullable=False,
            server_default=sa.text("'PENDING'"),
        ),
        sa.Column("attempt_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("provider", sa.String(length=32), nullable=True),
        sa.Column("provider_message_id", sa.String(length=255), nullable=True),
        sa.Column("requested_ip_address", sa.String(length=64), nullable=True),
        sa.Column("requested_user_agent", sa.String(length=512), nullable=True),
        sa.Column("verified_ip_address", sa.String(length=64), nullable=True),
        sa.Column("verified_user_agent", sa.String(length=512), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "status IN ('PENDING', 'VERIFIED', 'EXPIRED', 'FAILED')",
            name="status_allowed",
        ),
        sa.CheckConstraint("attempt_count >= 0", name="attempt_count_nonnegative"),
        sa.PrimaryKeyConstraint("id", name="pk_consumer_login_challenges"),
    )
    op.create_index(
        "ix_consumer_login_challenges_phone_created",
        "consumer_login_challenges",
        ["phone_normalized", "created_at"],
    )

    op.create_table(
        "consumer_document_claims",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("form_submission_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("phone_normalized", sa.String(length=32), nullable=False),
        sa.Column("token_digest", sa.String(length=64), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("char_length(token_digest) = 64", name="token_digest_sha256"),
        sa.ForeignKeyConstraint(
            ["tenant_id"], ["tenants.id"], name="fk_consumer_claim_tenant", ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["tenant_id", "form_submission_id"],
            ["form_submissions.tenant_id", "form_submissions.id"],
            name="fk_consumer_claim_submission",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_consumer_document_claims"),
        sa.UniqueConstraint("token_digest", name="uq_consumer_document_claims_token_digest"),
    )
    op.create_index(
        "ix_consumer_document_claims_expires",
        "consumer_document_claims",
        ["expires_at"],
    )

    op.create_table(
        "consumer_submission_links",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("consumer_account_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("client_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("form_submission_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "shared_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("profile_imported_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["consumer_account_id"],
            ["consumer_accounts.id"],
            name="fk_consumer_submission_link_account",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["tenant_id"],
            ["tenants.id"],
            name="fk_consumer_submission_link_tenant",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["tenant_id", "client_id"],
            ["clients.tenant_id", "clients.id"],
            name="fk_consumer_submission_link_client",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["tenant_id", "form_submission_id"],
            ["form_submissions.tenant_id", "form_submissions.id"],
            name="fk_consumer_submission_link_submission",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_consumer_submission_links"),
        sa.UniqueConstraint(
            "consumer_account_id",
            "form_submission_id",
            name="uq_consumer_submission_link_account_submission",
        ),
    )
    op.create_index(
        "ix_consumer_submission_links_account_shared",
        "consumer_submission_links",
        ["consumer_account_id", "shared_at"],
    )


def downgrade() -> None:
    op.drop_table("consumer_submission_links")
    op.drop_table("consumer_document_claims")
    op.drop_table("consumer_login_challenges")
    op.drop_table("consumer_sessions")
    op.drop_table("consumer_accounts")
