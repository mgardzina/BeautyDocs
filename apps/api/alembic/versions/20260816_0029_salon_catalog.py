"""Add the salon product, equipment and aftercare catalogue.

Revision ID: 20260816_0029
Revises: 20260816_0028
Create Date: 2026-08-16
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20260816_0029"
down_revision: str | None = "20260816_0028"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TENANT_POLICY_EXPRESSION = (
    "tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid"
)


def upgrade() -> None:
    op.create_table(
        "salon_catalog_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source", sa.String(length=24), nullable=False),
        sa.Column("external_id", sa.String(length=160), nullable=True),
        sa.Column("kind", sa.String(length=32), nullable=False),
        sa.Column("name", sa.String(length=250), nullable=False),
        sa.Column("brand", sa.String(length=200), nullable=True),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column(
            "details",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("source_label", sa.String(length=200), nullable=True),
        sa.Column("source_url", sa.String(length=2048), nullable=True),
        sa.Column(
            "used_in_treatments",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column(
            "recommended_aftercare",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column(
            "treatment_codes",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column("recommendation_note", sa.Text(), nullable=True),
        sa.Column(
            "is_sponsored",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column("sponsor_name", sa.String(length=200), nullable=True),
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
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
        sa.CheckConstraint(
            "kind IN ('MEDICINE', 'TREATMENT_SUBSTANCE', 'DEVICE', 'COSMETIC')",
            name="kind_allowed",
        ),
        sa.CheckConstraint(
            "source IN ('RPL', 'BEAUTYDOCS', 'SALON')",
            name="source_allowed",
        ),
        sa.CheckConstraint(
            "source <> 'RPL' OR (kind = 'MEDICINE' AND external_id IS NOT NULL)",
            name="rpl_item_valid",
        ),
        sa.CheckConstraint(
            "jsonb_typeof(treatment_codes) = 'array'",
            name="treatment_codes_array",
        ),
        sa.CheckConstraint(
            "is_sponsored = false OR sponsor_name IS NOT NULL",
            name="sponsor_disclosed",
        ),
        sa.ForeignKeyConstraint(
            ["tenant_id"],
            ["tenants.id"],
            name="fk_salon_catalog_items_tenant_id_tenants",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_salon_catalog_items"),
        sa.UniqueConstraint(
            "tenant_id", "id", name="uq_salon_catalog_item_tenant_id"
        ),
        sa.UniqueConstraint(
            "tenant_id",
            "source",
            "external_id",
            name="uq_salon_catalog_item_external",
        ),
    )
    op.create_index(
        "ix_salon_catalog_tenant_active_kind",
        "salon_catalog_items",
        ["tenant_id", "is_active", "kind"],
    )
    op.execute("ALTER TABLE salon_catalog_items ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE salon_catalog_items FORCE ROW LEVEL SECURITY")
    op.execute(
        "CREATE POLICY salon_catalog_items_tenant_isolation "
        "ON salon_catalog_items FOR ALL "
        f"USING ({TENANT_POLICY_EXPRESSION}) "
        f"WITH CHECK ({TENANT_POLICY_EXPRESSION})"
    )


def downgrade() -> None:
    op.execute(
        "DROP POLICY IF EXISTS salon_catalog_items_tenant_isolation "
        "ON salon_catalog_items"
    )
    op.drop_index(
        "ix_salon_catalog_tenant_active_kind",
        table_name="salon_catalog_items",
    )
    op.drop_table("salon_catalog_items")
