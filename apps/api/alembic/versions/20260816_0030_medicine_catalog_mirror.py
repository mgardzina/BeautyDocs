"""Add the global RPL mirror and versioned medicine safety rules.

Revision ID: 20260816_0030
Revises: 20260816_0029
Create Date: 2026-08-16
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20260816_0030"
down_revision: str | None = "20260816_0029"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "medicine_products",
        sa.Column("rpl_id", sa.BigInteger(), nullable=False),
        sa.Column("name", sa.String(length=250), nullable=False),
        sa.Column("common_name", sa.String(length=500), nullable=True),
        sa.Column("active_substance", sa.String(length=1000), nullable=True),
        sa.Column("pharmaceutical_form", sa.String(length=300), nullable=True),
        sa.Column("strength", sa.String(length=300), nullable=True),
        sa.Column(
            "marketing_authorisation_holder",
            sa.String(length=300),
            nullable=True,
        ),
        sa.Column("registry_number", sa.String(length=100), nullable=True),
        sa.Column("atc_code", sa.String(length=100), nullable=True),
        sa.Column("search_text", sa.Text(), nullable=False),
        sa.Column(
            "source_payload",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False),
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
        sa.PrimaryKeyConstraint("rpl_id", name="pk_medicine_products"),
    )
    op.create_index("ix_medicine_products_name", "medicine_products", ["name"])
    op.create_index(
        "ix_medicine_products_active_substance",
        "medicine_products",
        ["active_substance"],
    )
    op.create_index("ix_medicine_products_atc", "medicine_products", ["atc_code"])
    op.create_index("ix_medicine_products_active", "medicine_products", ["is_active"])

    op.create_table(
        "medicine_safety_rules",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("code", sa.String(length=100), nullable=False),
        sa.Column(
            "substance_names",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
        ),
        sa.Column(
            "pharmaceutical_form_terms",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
        ),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("label", sa.String(length=120), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column(
            "flags",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
        ),
        sa.Column(
            "treatment_families",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
        ),
        sa.Column("evidence_label", sa.String(length=250), nullable=False),
        sa.Column("evidence_url", sa.String(length=2048), nullable=False),
        sa.Column("reviewed_by", sa.String(length=200), nullable=False),
        sa.Column("reviewed_at", sa.Date(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
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
            "status IN ('PHOTOSENSITIZING', 'VERIFY')",
            name="medicine_safety_rule_status_allowed",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_medicine_safety_rules"),
        sa.UniqueConstraint("code", name="uq_medicine_safety_rules_code"),
    )
    op.create_index(
        "ix_medicine_safety_rules_active",
        "medicine_safety_rules",
        ["is_active"],
    )

    op.create_table(
        "medicine_catalog_sync_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("products_seen", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("products_imported", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error_message", sa.String(length=500), nullable=True),
        sa.CheckConstraint(
            "status IN ('RUNNING', 'COMPLETED', 'FAILED')",
            name="medicine_catalog_sync_status_allowed",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_medicine_catalog_sync_runs"),
    )
    op.create_index(
        "ix_medicine_catalog_sync_started",
        "medicine_catalog_sync_runs",
        ["started_at"],
    )

    op.execute(
        sa.text(
            """
            INSERT INTO medicine_safety_rules (
                id, code, substance_names, pharmaceutical_form_terms,
                status, label, summary, flags, treatment_families,
                evidence_label, evidence_url, reviewed_by, reviewed_at, version
            ) VALUES (
                '3c286ddf-9a1e-4bd8-b9f6-cf31317da299',
                'topical-ketoprofen-photosensitivity',
                '["ketoprofen", "ketoprofenum"]'::jsonb,
                '["żel", "krem", "maść", "plaster", "na skórę"]'::jsonb,
                'PHOTOSENSITIZING',
                'Światłouczulający',
                'Oficjalna ocena EMA wskazuje ryzyko reakcji nadwrażliwości na ' ||
                'światło, w tym fotoalergii, dla ketoprofenu stosowanego miejscowo.',
                '["PHOTOSENSITIVITY"]'::jsonb,
                '["LASER", "IPL", "UV"]'::jsonb,
                'EMA — ketoprofen stosowany miejscowo',
                'https://www.ema.europa.eu/en/medicines/human/referrals/ketoprofen-topical',
                'BeautyDocs — reguła źródłowa EMA',
                DATE '2026-08-16',
                1
            )
            """
        )
    )


def downgrade() -> None:
    op.drop_index(
        "ix_medicine_catalog_sync_started",
        table_name="medicine_catalog_sync_runs",
    )
    op.drop_table("medicine_catalog_sync_runs")
    op.drop_index(
        "ix_medicine_safety_rules_active",
        table_name="medicine_safety_rules",
    )
    op.drop_table("medicine_safety_rules")
    op.drop_index("ix_medicine_products_active", table_name="medicine_products")
    op.drop_index("ix_medicine_products_atc", table_name="medicine_products")
    op.drop_index(
        "ix_medicine_products_active_substance",
        table_name="medicine_products",
    )
    op.drop_index("ix_medicine_products_name", table_name="medicine_products")
    op.drop_table("medicine_products")
