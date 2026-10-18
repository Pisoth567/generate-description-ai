"""Phase 1 additive verification, UI preference, and generation attempts.

Only existing Google-linked identities have prior verified-email evidence.
"""
from alembic import op
import sqlalchemy as sa
revision = "e10a1b2c3d40"
down_revision = "7b81e2ac940d"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("users", sa.Column("email_verified_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("ui_language", sa.String(2), server_default="en", nullable=False))
    op.execute("UPDATE users SET email_verified_at = CURRENT_TIMESTAMP WHERE google_sub IS NOT NULL")
    op.create_table("email_verification_codes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("code_digest", sa.String(64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True)))
    op.create_table("generation_attempts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False))
    op.create_index("ix_generation_attempts_user_id", "generation_attempts", ["user_id"])
    op.create_index("ix_generation_attempts_created_at", "generation_attempts", ["created_at"])


def downgrade():
    op.drop_table("generation_attempts")
    op.drop_table("email_verification_codes")
    op.drop_column("users", "ui_language")
    op.drop_column("users", "email_verified_at")
