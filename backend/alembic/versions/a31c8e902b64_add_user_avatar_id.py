"""Add optional built-in avatar preference; preserve existing account data."""
from alembic import op
import sqlalchemy as sa

revision = "a31c8e902b64"
down_revision = "f20b2c3d4e50"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("avatar_id", sa.String(length=32), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "avatar_id")
