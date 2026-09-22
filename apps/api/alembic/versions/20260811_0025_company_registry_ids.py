"""Store REGON and KRS identifiers returned by the GUS registry.

Revision ID: 20260811_0025
Revises: 20260809_0024
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260811_0025"
down_revision: str | None = "20260809_0024"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("tenants", sa.Column("regon", sa.String(length=14), nullable=True))
    op.add_column("tenants", sa.Column("krs", sa.String(length=10), nullable=True))


def downgrade() -> None:
    op.drop_column("tenants", "krs")
    op.drop_column("tenants", "regon")
