"""Add salon team profiles and immutable practitioner attribution.

Revision ID: 20260728_0005
Revises: 20260719_0004
Create Date: 2026-07-28
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20260728_0005"
down_revision: str | None = "20260719_0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TENANT_EXPRESSION = "tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid"


def upgrade() -> None:
    op.create_table(
        "team_members",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("membership_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("display_name", sa.String(length=200), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=True),
        sa.Column("job_title", sa.String(length=160), nullable=True),
        sa.Column(
            "is_owner",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "performs_treatments",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column("signature_data_url", sa.Text(), nullable=True),
        sa.Column(
            "signature_updated_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
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
            ["tenant_id"],
            ["tenants.id"],
            name="fk_team_member_tenant",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["tenant_id", "membership_id"],
            ["tenant_memberships.tenant_id", "tenant_memberships.id"],
            name="fk_team_member_tenant_membership",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_team_members"),
        sa.UniqueConstraint("tenant_id", "id", name="uq_team_member_tenant_id"),
        sa.UniqueConstraint(
            "tenant_id",
            "membership_id",
            name="uq_team_member_tenant_membership",
        ),
    )
    op.create_index(
        "ix_team_members_tenant_active_name",
        "team_members",
        ["tenant_id", "is_active", "display_name"],
    )
    op.execute("ALTER TABLE team_members ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE team_members FORCE ROW LEVEL SECURITY")
    op.execute(
        "CREATE POLICY team_members_tenant_isolation ON team_members "
        f"FOR ALL USING ({TENANT_EXPRESSION}) "
        f"WITH CHECK ({TENANT_EXPRESSION})"
    )

    # Every existing owner gets a roster profile immediately. This keeps access
    # memberships and treatment staff separate while preserving a convenient
    # one-to-one link for the salon owner.
    op.execute(
        """
        INSERT INTO team_members (
            id,
            tenant_id,
            membership_id,
            display_name,
            email,
            job_title,
            is_owner,
            performs_treatments,
            is_active
        )
        SELECT
            gen_random_uuid(),
            membership.tenant_id,
            membership.id,
            users.display_name,
            users.email,
            'Właściciel salonu',
            true,
            true,
            membership.is_active
        FROM tenant_memberships AS membership
        JOIN users ON users.id = membership.user_id
        WHERE membership.role = 'OWNER'
        """
    )

    op.add_column(
        "form_submissions",
        sa.Column(
            "practitioner_team_member_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
    )
    op.create_foreign_key(
        "fk_submission_tenant_practitioner",
        "form_submissions",
        "team_members",
        ["tenant_id", "practitioner_team_member_id"],
        ["tenant_id", "id"],
        ondelete="RESTRICT",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_submission_tenant_practitioner",
        "form_submissions",
        type_="foreignkey",
    )
    op.drop_column("form_submissions", "practitioner_team_member_id")
    op.execute("DROP POLICY team_members_tenant_isolation ON team_members")
    op.drop_index(
        "ix_team_members_tenant_active_name",
        table_name="team_members",
    )
    op.drop_table("team_members")
