"""add_health_app_connections

Revision ID: c2b7a4f19e21
Revises: d6f4d8b7d2c1
Create Date: 2026-03-18 11:20:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "c2b7a4f19e21"
down_revision = "d6f4d8b7d2c1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "healthappconnection",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("provider", sa.String(length=40), nullable=False),
        sa.Column("is_connected", sa.Boolean(), nullable=False),
        sa.Column("sync_method", sa.String(length=30), nullable=False),
        sa.Column("connected_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_synced_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "provider", name="uq_healthappconnection_user_provider"),
    )
    op.create_index(
        op.f("ix_healthappconnection_user_id"),
        "healthappconnection",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_healthappconnection_provider"),
        "healthappconnection",
        ["provider"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_healthappconnection_provider"), table_name="healthappconnection")
    op.drop_index(op.f("ix_healthappconnection_user_id"), table_name="healthappconnection")
    op.drop_table("healthappconnection")
