"""Add the salon notification inbox.

Revision ID: 20260809_0021
Revises: 20260809_0020
Create Date: 2026-08-09
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20260809_0021"
down_revision: str | None = "20260809_0020"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TENANT_POLICY_EXPRESSION = (
    "tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid"
)


def upgrade() -> None:
    op.create_table(
        "salon_notifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("kind", sa.String(length=64), nullable=False),
        sa.Column(
            "severity",
            sa.String(length=24),
            nullable=False,
            server_default="INFO",
        ),
        sa.Column("resource_type", sa.String(length=64), nullable=False),
        sa.Column("resource_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(length=250), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("action_label", sa.String(length=120), nullable=True),
        sa.Column(
            "metadata",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
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
            "severity IN ('INFO', 'ACTION_REQUIRED')",
            name="severity_allowed",
        ),
        sa.ForeignKeyConstraint(
            ["tenant_id"],
            ["tenants.id"],
            name="fk_salon_notifications_tenant_id_tenants",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_salon_notifications"),
        sa.UniqueConstraint(
            "tenant_id",
            "id",
            name="uq_salon_notification_tenant_id",
        ),
        sa.UniqueConstraint(
            "tenant_id",
            "kind",
            "resource_type",
            "resource_id",
            name="uq_salon_notification_resource",
        ),
    )
    op.create_index(
        "ix_salon_notifications_tenant_inbox_created",
        "salon_notifications",
        ["tenant_id", "archived_at", "created_at"],
    )
    op.create_index(
        "ix_salon_notifications_tenant_unread_created",
        "salon_notifications",
        ["tenant_id", "read_at", "created_at"],
    )
    op.create_index(
        "ix_salon_notifications_tenant_kind_resolved",
        "salon_notifications",
        ["tenant_id", "kind", "resolved_at"],
    )
    # Existing client-signed forms should appear immediately after deployment.
    op.execute(
        """
        INSERT INTO salon_notifications (
            id,
            tenant_id,
            kind,
            severity,
            resource_type,
            resource_id,
            title,
            body,
            action_label,
            metadata,
            created_at,
            updated_at
        )
        SELECT
            gen_random_uuid(),
            submission.tenant_id,
            'PRACTITIONER_SIGNATURE_REQUIRED',
            'ACTION_REQUIRED',
            'form_submission',
            submission.id,
            'Formularz wymaga podpisu',
            client.first_name || ' ' || client.last_name ||
                ' zakończyła formularz „' || template.name || '”.',
            'Otwórz formularz',
            jsonb_strip_nulls(jsonb_build_object(
                'clientId', submission.client_id,
                'submissionId', submission.id,
                'clientName', client.first_name || ' ' || client.last_name,
                'formName', template.name,
                'practitionerName', practitioner.display_name
            )),
            COALESCE(submission.submitted_at, submission.created_at),
            COALESCE(submission.submitted_at, submission.created_at)
        FROM form_submissions AS submission
        JOIN clients AS client
          ON client.tenant_id = submission.tenant_id
         AND client.id = submission.client_id
        JOIN form_template_versions AS version
          ON version.id = submission.form_template_version_id
        JOIN form_templates AS template
          ON template.id = version.form_template_id
        LEFT JOIN team_members AS practitioner
          ON practitioner.tenant_id = submission.tenant_id
         AND practitioner.id = submission.practitioner_team_member_id
        WHERE submission.status = 'SUBMITTED'
          AND submission.practitioner_team_member_id IS NOT NULL
          AND submission.practitioner_signed_at IS NULL
        ON CONFLICT (tenant_id, kind, resource_type, resource_id) DO NOTHING
        """
    )
    op.execute("ALTER TABLE salon_notifications ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE salon_notifications FORCE ROW LEVEL SECURITY")
    op.execute(
        "CREATE POLICY salon_notifications_tenant_isolation "
        "ON salon_notifications FOR ALL "
        f"USING ({TENANT_POLICY_EXPRESSION}) "
        f"WITH CHECK ({TENANT_POLICY_EXPRESSION})"
    )


def downgrade() -> None:
    op.execute(
        "DROP POLICY IF EXISTS salon_notifications_tenant_isolation "
        "ON salon_notifications"
    )
    op.drop_index(
        "ix_salon_notifications_tenant_kind_resolved",
        table_name="salon_notifications",
    )
    op.drop_index(
        "ix_salon_notifications_tenant_unread_created",
        table_name="salon_notifications",
    )
    op.drop_index(
        "ix_salon_notifications_tenant_inbox_created",
        table_name="salon_notifications",
    )
    op.drop_table("salon_notifications")
