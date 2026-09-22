"""Add independent SMS-backed client and practitioner signing evidence.

Revision ID: 20260729_0006
Revises: 20260728_0005
Create Date: 2026-07-29
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20260729_0006"
down_revision: str | None = "20260728_0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("team_members", sa.Column("phone", sa.String(length=32), nullable=True))
    op.add_column(
        "team_members",
        sa.Column("phone_normalized", sa.String(length=32), nullable=True),
    )

    op.add_column(
        "form_submissions",
        sa.Column("public_access_token_digest", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "form_submissions",
        sa.Column("practitioner_signed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "form_submissions",
        sa.Column("practitioner_signature_data_url", sa.Text(), nullable=True),
    )

    op.add_column(
        "signature_verifications",
        sa.Column(
            "signer_type",
            sa.String(length=16),
            nullable=False,
            server_default=sa.text("'CLIENT'"),
        ),
    )
    op.add_column(
        "signature_verifications",
        sa.Column(
            "signer_membership_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
    )
    op.add_column(
        "signature_verifications",
        sa.Column(
            "signer_team_member_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
    )
    op.add_column(
        "signature_verifications",
        sa.Column("provider", sa.String(length=32), nullable=True),
    )
    op.add_column(
        "signature_verifications",
        sa.Column("provider_message_id", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "signature_verifications",
        sa.Column("document_hash", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "signature_verifications",
        sa.Column("requested_ip_address", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "signature_verifications",
        sa.Column("requested_user_agent", sa.String(length=512), nullable=True),
    )
    op.add_column(
        "signature_verifications",
        sa.Column("verified_ip_address", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "signature_verifications",
        sa.Column("verified_user_agent", sa.String(length=512), nullable=True),
    )
    op.add_column(
        "signature_verifications",
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_check_constraint(
        "ck_signature_verifications_signer_type_allowed",
        "signature_verifications",
        "signer_type IN ('CLIENT', 'PRACTITIONER')",
    )
    op.create_check_constraint(
        "ck_signature_verifications_document_hash_sha256",
        "signature_verifications",
        "document_hash IS NULL OR char_length(document_hash) = 64",
    )
    op.create_foreign_key(
        "fk_signature_tenant_signer_membership",
        "signature_verifications",
        "tenant_memberships",
        ["tenant_id", "signer_membership_id"],
        ["tenant_id", "id"],
        ondelete="RESTRICT",
    )
    op.create_foreign_key(
        "fk_signature_tenant_signer_team_member",
        "signature_verifications",
        "team_members",
        ["tenant_id", "signer_team_member_id"],
        ["tenant_id", "id"],
        ondelete="RESTRICT",
    )
    op.create_index(
        "ix_signature_verifications_tenant_submission_signer",
        "signature_verifications",
        ["tenant_id", "form_submission_id", "signer_type", "created_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_signature_verifications_tenant_submission_signer",
        table_name="signature_verifications",
    )
    op.drop_constraint(
        "fk_signature_tenant_signer_team_member",
        "signature_verifications",
        type_="foreignkey",
    )
    op.drop_constraint(
        "fk_signature_tenant_signer_membership",
        "signature_verifications",
        type_="foreignkey",
    )
    op.drop_constraint(
        "ck_signature_verifications_document_hash_sha256",
        "signature_verifications",
        type_="check",
    )
    op.drop_constraint(
        "ck_signature_verifications_signer_type_allowed",
        "signature_verifications",
        type_="check",
    )
    for column in (
        "consumed_at",
        "verified_user_agent",
        "verified_ip_address",
        "requested_user_agent",
        "requested_ip_address",
        "document_hash",
        "provider_message_id",
        "provider",
        "signer_team_member_id",
        "signer_membership_id",
        "signer_type",
    ):
        op.drop_column("signature_verifications", column)

    op.drop_column("form_submissions", "practitioner_signature_data_url")
    op.drop_column("form_submissions", "practitioner_signed_at")
    op.drop_column("form_submissions", "public_access_token_digest")
    op.drop_column("team_members", "phone_normalized")
    op.drop_column("team_members", "phone")
