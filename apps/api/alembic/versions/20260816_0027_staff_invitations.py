"""Add one-time, salon-scoped staff invitations.

Revision ID: 20260816_0027
Revises: 20260816_0026
Create Date: 2026-08-16
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20260816_0027"
down_revision: str | None = "20260816_0026"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "staff_invitations",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "invited_by_membership_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("email_normalized", sa.String(length=320), nullable=False),
        sa.Column("job_title", sa.String(length=160), nullable=True),
        sa.Column(
            "performs_treatments",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
        sa.Column("token_digest", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
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
        sa.CheckConstraint(
            "email_normalized = lower(email_normalized)",
            name="email_normalized_lowercase",
        ),
        sa.CheckConstraint(
            "char_length(token_digest) = 64 AND token_digest ~ '^[0-9a-f]{64}$'",
            name="token_digest_sha256",
        ),
        sa.CheckConstraint("expires_at > created_at", name="expiry_after_creation"),
        sa.CheckConstraint(
            "accepted_at IS NULL OR revoked_at IS NULL",
            name="not_accepted_and_revoked",
        ),
        sa.ForeignKeyConstraint(
            ["tenant_id"],
            ["tenants.id"],
            name="fk_staff_invitations_tenant_id_tenants",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["tenant_id", "invited_by_membership_id"],
            ["tenant_memberships.tenant_id", "tenant_memberships.id"],
            name="fk_staff_invitation_invited_by_membership",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_staff_invitations"),
        sa.UniqueConstraint(
            "token_digest", name="uq_staff_invitation_token_digest"
        ),
    )
    op.create_index(
        "ix_staff_invitations_tenant_email_created",
        "staff_invitations",
        ["tenant_id", "email_normalized", "created_at"],
    )
    op.create_index(
        "ix_staff_invitations_expires",
        "staff_invitations",
        ["expires_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_staff_invitations_expires", table_name="staff_invitations")
    op.drop_index(
        "ix_staff_invitations_tenant_email_created",
        table_name="staff_invitations",
    )
    op.drop_table("staff_invitations")
