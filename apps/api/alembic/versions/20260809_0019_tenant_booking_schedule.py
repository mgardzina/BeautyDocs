"""Add tenant booking schedules.

Revision ID: 20260809_0019
Revises: 20260808_0018
Create Date: 2026-08-09
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20260809_0019"
down_revision: str | None = "20260808_0018"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

DEFAULT_SCHEDULE = (
    '{"slotIntervalMinutes":30,"days":['
    '{"weekday":0,"enabled":true,"opensAt":"09:00","closesAt":"17:00"},'
    '{"weekday":1,"enabled":true,"opensAt":"09:00","closesAt":"17:00"},'
    '{"weekday":2,"enabled":true,"opensAt":"09:00","closesAt":"17:00"},'
    '{"weekday":3,"enabled":true,"opensAt":"09:00","closesAt":"17:00"},'
    '{"weekday":4,"enabled":true,"opensAt":"09:00","closesAt":"17:00"},'
    '{"weekday":5,"enabled":false,"opensAt":"09:00","closesAt":"17:00"},'
    '{"weekday":6,"enabled":false,"opensAt":"09:00","closesAt":"17:00"}'
    "]}"
)


def upgrade() -> None:
    op.add_column(
        "tenants",
        sa.Column(
            "booking_schedule",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.literal_column(f"'{DEFAULT_SCHEDULE}'::jsonb"),
        ),
    )


def downgrade() -> None:
    op.drop_column("tenants", "booking_schedule")
