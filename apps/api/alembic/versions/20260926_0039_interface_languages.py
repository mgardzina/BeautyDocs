"""Store each account's preferred interface language."""
from alembic import op
import sqlalchemy as sa

revision = "20260926_0039"
down_revision = "20260913_0038"
branch_labels = None
depends_on = None


def upgrade() -> None:
    for table in ("users", "consumer_accounts"):
        op.add_column(table, sa.Column("interface_language", sa.String(2), nullable=False, server_default="pl"))


def downgrade() -> None:
    for table in ("consumer_accounts", "users"):
        op.drop_column(table, "interface_language")
