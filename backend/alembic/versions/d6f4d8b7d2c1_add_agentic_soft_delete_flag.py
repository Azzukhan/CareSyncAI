"""add_agentic_soft_delete_flag

Revision ID: d6f4d8b7d2c1
Revises: 6fdff72dbf0b
Create Date: 2026-03-16 21:10:00.000000
"""

import sqlalchemy as sa
from alembic import op


revision = "d6f4d8b7d2c1"
down_revision = "6fdff72dbf0b"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "agentic_conversation",
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_index(
        op.f("ix_agentic_conversation_is_deleted"),
        "agentic_conversation",
        ["is_deleted"],
        unique=False,
    )
    op.alter_column("agentic_conversation", "is_deleted", server_default=None)


def downgrade() -> None:
    op.drop_index(op.f("ix_agentic_conversation_is_deleted"), table_name="agentic_conversation")
    op.drop_column("agentic_conversation", "is_deleted")
