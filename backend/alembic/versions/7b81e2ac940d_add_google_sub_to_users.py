"""add google sub to users

Revision ID: 7b81e2ac940d
Revises: c63cd9d855c4
"""
from alembic import op
import sqlalchemy as sa

revision = "7b81e2ac940d"
down_revision = "c63cd9d855c4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("google_sub", sa.String(255), nullable=True))
    op.create_index("ix_users_google_sub", "users", ["google_sub"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_users_google_sub", table_name="users")
    op.drop_column("users", "google_sub")
