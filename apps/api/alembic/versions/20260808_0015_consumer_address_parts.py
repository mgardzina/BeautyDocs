"""Split the consumer address into street, house number and apartment number.

Adds optional ``house_number`` and ``apartment_number`` columns so clients who
live in apartment buildings can record the flat separately. ``street`` keeps the
street name; existing combined values remain untouched until re-edited.

Revision ID: 20260808_0015
Revises: 20260801_0014
Create Date: 2026-08-08
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260808_0015"
down_revision: str | None = "20260801_0014"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "consumer_accounts",
        sa.Column("house_number", sa.String(length=30), nullable=True),
    )
    op.add_column(
        "consumer_accounts",
        sa.Column("apartment_number", sa.String(length=30), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("consumer_accounts", "apartment_number")
    op.drop_column("consumer_accounts", "house_number")
