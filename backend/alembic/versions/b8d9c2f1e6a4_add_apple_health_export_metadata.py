"""add apple health export metadata

Revision ID: b8d9c2f1e6a4
Revises: f3b9d7a1c4e2
Create Date: 2026-03-19 14:05:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "b8d9c2f1e6a4"
down_revision = "f3b9d7a1c4e2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("healthdatafile") as batch_op:
        batch_op.add_column(sa.Column("export_date", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column("export_locale", sa.String(length=80), nullable=True))
        batch_op.add_column(sa.Column("source_date_start", sa.Date(), nullable=True))
        batch_op.add_column(sa.Column("source_date_end", sa.Date(), nullable=True))
        batch_op.add_column(sa.Column("source_tag_counts", sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column("source_profile", sa.JSON(), nullable=True))

    with op.batch_alter_table("healthmetric") as batch_op:
        batch_op.add_column(sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column("source_unit", sa.String(length=60), nullable=True))
        batch_op.add_column(sa.Column("source_created_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column("source_start_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column("source_end_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column("source_record_count", sa.Integer(), nullable=False, server_default="1"))
        batch_op.add_column(sa.Column("source_metadata", sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column("raw_device", sa.Text(), nullable=True))

    op.execute("UPDATE healthmetric SET source_record_count = 1 WHERE source_record_count IS NULL")

    with op.batch_alter_table("healthmetric") as batch_op:
        batch_op.alter_column("source_record_count", server_default=None)


def downgrade() -> None:
    with op.batch_alter_table("healthmetric") as batch_op:
        batch_op.drop_column("raw_device")
        batch_op.drop_column("source_metadata")
        batch_op.drop_column("source_record_count")
        batch_op.drop_column("source_end_at")
        batch_op.drop_column("source_start_at")
        batch_op.drop_column("source_created_at")
        batch_op.drop_column("source_unit")
        batch_op.drop_column("recorded_at")

    with op.batch_alter_table("healthdatafile") as batch_op:
        batch_op.drop_column("source_profile")
        batch_op.drop_column("source_tag_counts")
        batch_op.drop_column("source_date_end")
        batch_op.drop_column("source_date_start")
        batch_op.drop_column("export_locale")
        batch_op.drop_column("export_date")
