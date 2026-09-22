"""Initial BeautyDocs 2.0 multi-tenant schema.

Revision ID: 20260719_0001
Revises:
Create Date: 2026-07-19
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20260719_0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


TENANT_OWNED_TABLES = (
    "tenant_memberships",
    "clients",
    "client_notes",
    "tenant_form_templates",
    "visits",
    "form_submissions",
    "signature_verifications",
    "file_objects",
    "audit_events",
)

TENANT_POLICY_EXPRESSION = "tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid"


def _timestamps() -> tuple[sa.Column, sa.Column]:
    return (
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
    )


def _enable_tenant_rls(table_name: str) -> None:
    policy_name = f"{table_name}_tenant_isolation"
    op.execute(f'ALTER TABLE "{table_name}" ENABLE ROW LEVEL SECURITY')
    op.execute(f'ALTER TABLE "{table_name}" FORCE ROW LEVEL SECURITY')
    op.execute(
        f'CREATE POLICY "{policy_name}" ON "{table_name}" '
        f"FOR ALL USING ({TENANT_POLICY_EXPRESSION}) "
        f"WITH CHECK ({TENANT_POLICY_EXPRESSION})"
    )


def upgrade() -> None:
    op.create_table(
        "tenants",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("slug", sa.String(length=63), nullable=False),
        sa.Column("display_name", sa.String(length=200), nullable=False),
        sa.Column("legal_name", sa.String(length=250), nullable=False),
        sa.Column("nip", sa.String(length=20), nullable=True),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("privacy_contact_email", sa.String(length=320), nullable=False),
        sa.Column("phone", sa.String(length=32), nullable=True),
        sa.Column("website_url", sa.String(length=2048), nullable=True),
        sa.Column("address_line1", sa.String(length=250), nullable=True),
        sa.Column("address_line2", sa.String(length=250), nullable=True),
        sa.Column("postal_code", sa.String(length=20), nullable=True),
        sa.Column("city", sa.String(length=120), nullable=True),
        sa.Column(
            "country_code",
            sa.String(length=2),
            nullable=False,
            server_default=sa.text("'PL'"),
        ),
        sa.Column(
            "status",
            sa.String(length=16),
            nullable=False,
            server_default=sa.text("'ACTIVE'"),
        ),
        *_timestamps(),
        sa.CheckConstraint("slug = lower(slug)", name="slug_lowercase"),
        sa.CheckConstraint(
            "status IN ('ACTIVE', 'SUSPENDED', 'ARCHIVED')",
            name="status_allowed",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_tenants"),
        sa.UniqueConstraint("slug", name="uq_tenants_slug"),
    )

    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("email_normalized", sa.String(length=320), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("display_name", sa.String(length=200), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        *_timestamps(),
        sa.CheckConstraint(
            "email_normalized = lower(email_normalized)",
            name="email_normalized_lowercase",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_users"),
        sa.UniqueConstraint("email_normalized", name="uq_users_email_normalized"),
    )

    op.create_table(
        "form_templates",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("code", sa.String(length=100), nullable=False),
        sa.Column("name", sa.String(length=250), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "status",
            sa.String(length=16),
            nullable=False,
            server_default=sa.text("'DRAFT'"),
        ),
        *_timestamps(),
        sa.CheckConstraint("code = lower(code)", name="code_lowercase"),
        sa.CheckConstraint(
            "status IN ('DRAFT', 'ACTIVE', 'RETIRED')",
            name="status_allowed",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_form_templates"),
        sa.UniqueConstraint("code", name="uq_form_templates_code"),
    )

    op.create_table(
        "form_template_versions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("form_template_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("schema", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("legal_content", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("content_hash", sa.String(length=64), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "char_length(content_hash) = 64",
            name="content_hash_sha256",
        ),
        sa.CheckConstraint(
            "version_number > 0",
            name="version_positive",
        ),
        sa.ForeignKeyConstraint(
            ["form_template_id"],
            ["form_templates.id"],
            name="fk_template_version_template",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_form_template_versions"),
        sa.UniqueConstraint(
            "form_template_id",
            "version_number",
            name="uq_template_version_number",
        ),
    )
    op.create_index(
        "ix_template_versions_template_published",
        "form_template_versions",
        ["form_template_id", "published_at"],
    )

    op.create_table(
        "tenant_memberships",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "role",
            sa.String(length=16),
            nullable=False,
            server_default=sa.text("'STAFF'"),
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        *_timestamps(),
        sa.CheckConstraint(
            "role IN ('OWNER', 'ADMIN', 'STAFF', 'READ_ONLY')",
            name="role_allowed",
        ),
        sa.ForeignKeyConstraint(
            ["tenant_id"],
            ["tenants.id"],
            name="fk_membership_tenant",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name="fk_membership_user",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_tenant_memberships"),
        sa.UniqueConstraint("tenant_id", "id", name="uq_membership_tenant_id"),
        sa.UniqueConstraint("tenant_id", "user_id", name="uq_membership_tenant_user"),
    )
    op.create_index(
        "ix_memberships_tenant_role",
        "tenant_memberships",
        ["tenant_id", "role"],
    )

    op.create_table(
        "clients",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("first_name", sa.String(length=120), nullable=False),
        sa.Column("last_name", sa.String(length=160), nullable=False),
        sa.Column("first_name_normalized", sa.String(length=120), nullable=False),
        sa.Column("last_name_normalized", sa.String(length=160), nullable=False),
        sa.Column("phone", sa.String(length=32), nullable=True),
        sa.Column("phone_normalized", sa.String(length=32), nullable=True),
        sa.Column("email", sa.String(length=320), nullable=True),
        sa.Column("birth_date", sa.Date(), nullable=True),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        *_timestamps(),
        sa.ForeignKeyConstraint(
            ["tenant_id"],
            ["tenants.id"],
            name="fk_client_tenant",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_clients"),
        sa.UniqueConstraint("tenant_id", "id", name="uq_client_tenant_id"),
    )
    op.create_index(
        "ix_clients_tenant_name",
        "clients",
        ["tenant_id", "last_name_normalized", "first_name_normalized"],
    )
    op.create_index("ix_clients_tenant_phone", "clients", ["tenant_id", "phone_normalized"])
    op.create_index("ix_clients_tenant_created", "clients", ["tenant_id", "created_at"])

    op.create_table(
        "tenant_form_templates",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("form_template_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column(
            "display_order",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
        *_timestamps(),
        sa.CheckConstraint(
            "display_order >= 0",
            name="display_order_nonnegative",
        ),
        sa.ForeignKeyConstraint(
            ["form_template_id"],
            ["form_templates.id"],
            name="fk_tenant_form_template",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["tenant_id"],
            ["tenants.id"],
            name="fk_tenant_form_tenant",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_tenant_form_templates"),
        sa.UniqueConstraint("tenant_id", "id", name="uq_tenant_form_tenant_id"),
        sa.UniqueConstraint(
            "tenant_id",
            "form_template_id",
            name="uq_tenant_form_template",
        ),
    )
    op.create_index(
        "ix_tenant_forms_tenant_enabled_order",
        "tenant_form_templates",
        ["tenant_id", "enabled", "display_order"],
    )

    op.create_table(
        "client_notes",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("client_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("author_membership_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("edited_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["tenant_id", "author_membership_id"],
            ["tenant_memberships.tenant_id", "tenant_memberships.id"],
            name="fk_client_note_tenant_author",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["tenant_id", "client_id"],
            ["clients.tenant_id", "clients.id"],
            name="fk_client_note_tenant_client",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["tenant_id"],
            ["tenants.id"],
            name="fk_client_note_tenant",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_client_notes"),
        sa.UniqueConstraint("tenant_id", "id", name="uq_client_note_tenant_id"),
    )
    op.create_index(
        "ix_client_notes_tenant_client_created",
        "client_notes",
        ["tenant_id", "client_id", "created_at"],
    )

    op.create_table(
        "visits",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("client_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("staff_membership_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("form_template_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("treatment_name", sa.String(length=250), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "status",
            sa.String(length=16),
            nullable=False,
            server_default=sa.text("'PLANNED'"),
        ),
        sa.Column("notes", sa.Text(), nullable=True),
        *_timestamps(),
        sa.CheckConstraint(
            "status IN ('PLANNED', 'COMPLETED', 'CANCELLED')",
            name="status_allowed",
        ),
        sa.ForeignKeyConstraint(
            ["form_template_id"],
            ["form_templates.id"],
            name="fk_visit_form_template",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["tenant_id", "client_id"],
            ["clients.tenant_id", "clients.id"],
            name="fk_visit_tenant_client",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["tenant_id", "staff_membership_id"],
            ["tenant_memberships.tenant_id", "tenant_memberships.id"],
            name="fk_visit_tenant_staff",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["tenant_id"],
            ["tenants.id"],
            name="fk_visit_tenant",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_visits"),
        sa.UniqueConstraint("tenant_id", "id", name="uq_visit_tenant_id"),
    )
    op.create_index(
        "ix_visits_tenant_client_start",
        "visits",
        ["tenant_id", "client_id", "starts_at"],
    )
    op.create_index("ix_visits_tenant_start", "visits", ["tenant_id", "starts_at"])

    op.create_table(
        "form_submissions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("client_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("visit_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("form_template_version_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "submitted_by_membership_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
        sa.Column(
            "status",
            sa.String(length=16),
            nullable=False,
            server_default=sa.text("'DRAFT'"),
        ),
        sa.Column(
            "answers",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "document_snapshot",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column("document_hash", sa.String(length=64), nullable=True),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("signed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("voided_at", sa.DateTime(timezone=True), nullable=True),
        *_timestamps(),
        sa.CheckConstraint(
            "document_hash IS NULL OR char_length(document_hash) = 64",
            name="document_hash_sha256",
        ),
        sa.CheckConstraint(
            "status <> 'SIGNED' OR "
            "(signed_at IS NOT NULL AND document_hash IS NOT NULL "
            "AND document_snapshot IS NOT NULL)",
            name="signed_document_complete",
        ),
        sa.CheckConstraint(
            "status IN ('DRAFT', 'SUBMITTED', 'SIGNED', 'VOID')",
            name="status_allowed",
        ),
        sa.ForeignKeyConstraint(
            ["form_template_version_id"],
            ["form_template_versions.id"],
            name="fk_submission_template_version",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["tenant_id", "client_id"],
            ["clients.tenant_id", "clients.id"],
            name="fk_submission_tenant_client",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["tenant_id", "submitted_by_membership_id"],
            ["tenant_memberships.tenant_id", "tenant_memberships.id"],
            name="fk_submission_tenant_submitter",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["tenant_id", "visit_id"],
            ["visits.tenant_id", "visits.id"],
            name="fk_submission_tenant_visit",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["tenant_id"],
            ["tenants.id"],
            name="fk_submission_tenant",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_form_submissions"),
        sa.UniqueConstraint("tenant_id", "id", name="uq_submission_tenant_id"),
    )
    op.create_index(
        "ix_submissions_tenant_client_created",
        "form_submissions",
        ["tenant_id", "client_id", "created_at"],
    )
    op.create_index(
        "ix_submissions_tenant_status_created",
        "form_submissions",
        ["tenant_id", "status", "created_at"],
    )

    op.create_table(
        "signature_verifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("form_submission_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "method",
            sa.String(length=32),
            nullable=False,
            server_default=sa.text("'SMS_OTP'"),
        ),
        sa.Column(
            "status",
            sa.String(length=16),
            nullable=False,
            server_default=sa.text("'PENDING'"),
        ),
        sa.Column("otp_digest", sa.String(length=255), nullable=False),
        sa.Column("destination_masked", sa.String(length=64), nullable=False),
        sa.Column("attempt_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "attempt_count >= 0",
            name="attempt_count_nonnegative",
        ),
        sa.CheckConstraint(
            "status IN ('PENDING', 'VERIFIED', 'EXPIRED', 'FAILED')",
            name="status_allowed",
        ),
        sa.ForeignKeyConstraint(
            ["tenant_id", "form_submission_id"],
            ["form_submissions.tenant_id", "form_submissions.id"],
            name="fk_signature_tenant_submission",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["tenant_id"],
            ["tenants.id"],
            name="fk_signature_tenant",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_signature_verifications"),
        sa.UniqueConstraint("tenant_id", "id", name="uq_signature_verification_tenant_id"),
    )
    op.create_index(
        "ix_signature_verifications_tenant_expires",
        "signature_verifications",
        ["tenant_id", "expires_at"],
    )
    op.create_index(
        "ix_signature_verifications_tenant_submission_created",
        "signature_verifications",
        ["tenant_id", "form_submission_id", "created_at"],
    )

    op.create_table(
        "file_objects",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("client_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("form_submission_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("kind", sa.String(length=32), nullable=False),
        sa.Column("storage_provider", sa.String(length=32), nullable=False),
        sa.Column("bucket", sa.String(length=255), nullable=False),
        sa.Column("object_key", sa.String(length=1024), nullable=False),
        sa.Column("content_type", sa.String(length=255), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("sha256", sa.String(length=64), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("char_length(sha256) = 64", name="sha256_length"),
        sa.CheckConstraint("size_bytes >= 0", name="size_nonnegative"),
        sa.ForeignKeyConstraint(
            ["tenant_id", "client_id"],
            ["clients.tenant_id", "clients.id"],
            name="fk_file_object_tenant_client",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["tenant_id", "form_submission_id"],
            ["form_submissions.tenant_id", "form_submissions.id"],
            name="fk_file_object_tenant_submission",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["tenant_id"],
            ["tenants.id"],
            name="fk_file_object_tenant",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_file_objects"),
        sa.UniqueConstraint("tenant_id", "id", name="uq_file_object_tenant_id"),
        sa.UniqueConstraint(
            "storage_provider",
            "bucket",
            "object_key",
            name="uq_file_object_storage_key",
        ),
    )
    op.create_index(
        "ix_file_objects_tenant_client",
        "file_objects",
        ["tenant_id", "client_id"],
    )
    op.create_index(
        "ix_file_objects_tenant_submission",
        "file_objects",
        ["tenant_id", "form_submission_id"],
    )

    op.create_table(
        "audit_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("actor_membership_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("action", sa.String(length=100), nullable=False),
        sa.Column("resource_type", sa.String(length=100), nullable=False),
        sa.Column("resource_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "metadata",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("request_id", sa.String(length=100), nullable=True),
        sa.Column("ip_hash", sa.String(length=64), nullable=True),
        sa.Column("user_agent", sa.String(length=512), nullable=True),
        sa.Column(
            "occurred_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(
            ["tenant_id", "actor_membership_id"],
            ["tenant_memberships.tenant_id", "tenant_memberships.id"],
            name="fk_audit_event_tenant_actor",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["tenant_id"],
            ["tenants.id"],
            name="fk_audit_event_tenant",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_audit_events"),
        sa.UniqueConstraint("tenant_id", "id", name="uq_audit_event_tenant_id"),
    )
    op.create_index(
        "ix_audit_events_tenant_occurred",
        "audit_events",
        ["tenant_id", "occurred_at"],
    )
    op.create_index(
        "ix_audit_events_tenant_resource",
        "audit_events",
        ["tenant_id", "resource_type", "resource_id"],
    )

    op.execute(
        """
        CREATE FUNCTION beautydocs_protect_published_template_version()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        BEGIN
            IF OLD.published_at IS NOT NULL THEN
                RAISE EXCEPTION 'Published form template versions are immutable';
            END IF;
            IF TG_OP = 'DELETE' THEN
                RETURN OLD;
            END IF;
            RETURN NEW;
        END;
        $$
        """
    )
    op.execute(
        """
        CREATE TRIGGER protect_published_template_version
        BEFORE UPDATE OR DELETE ON form_template_versions
        FOR EACH ROW
        EXECUTE FUNCTION beautydocs_protect_published_template_version()
        """
    )
    op.execute(
        """
        CREATE FUNCTION beautydocs_reject_audit_event_mutation()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        BEGIN
            RAISE EXCEPTION 'Audit events are append-only';
        END;
        $$
        """
    )
    op.execute(
        """
        CREATE TRIGGER reject_audit_event_mutation
        BEFORE UPDATE OR DELETE ON audit_events
        FOR EACH ROW
        EXECUTE FUNCTION beautydocs_reject_audit_event_mutation()
        """
    )

    for table_name in TENANT_OWNED_TABLES:
        _enable_tenant_rls(table_name)


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS reject_audit_event_mutation ON audit_events")
    op.execute("DROP FUNCTION IF EXISTS beautydocs_reject_audit_event_mutation()")
    op.execute(
        "DROP TRIGGER IF EXISTS protect_published_template_version ON form_template_versions"
    )
    op.execute("DROP FUNCTION IF EXISTS beautydocs_protect_published_template_version()")

    op.drop_table("audit_events")
    op.drop_table("file_objects")
    op.drop_table("signature_verifications")
    op.drop_table("form_submissions")
    op.drop_table("visits")
    op.drop_table("client_notes")
    op.drop_table("tenant_form_templates")
    op.drop_table("clients")
    op.drop_table("tenant_memberships")
    op.drop_table("form_template_versions")
    op.drop_table("form_templates")
    op.drop_table("users")
    op.drop_table("tenants")
