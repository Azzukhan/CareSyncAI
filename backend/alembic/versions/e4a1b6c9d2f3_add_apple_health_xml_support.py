"""add_apple_health_xml_support

Revision ID: e4a1b6c9d2f3
Revises: c2b7a4f19e21
Create Date: 2026-03-18 22:40:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "e4a1b6c9d2f3"
down_revision = "c2b7a4f19e21"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("healthdatafile") as batch_op:
        batch_op.add_column(sa.Column("provider", sa.String(length=40), nullable=True))
        batch_op.create_index(batch_op.f("ix_healthdatafile_provider"), ["provider"], unique=False)

    with op.batch_alter_table("healthmetric") as batch_op:
        batch_op.add_column(sa.Column("provider", sa.String(length=40), nullable=True))
        batch_op.add_column(sa.Column("external_type", sa.String(length=120), nullable=True))
        batch_op.add_column(sa.Column("source_name", sa.String(length=120), nullable=True))
        batch_op.add_column(sa.Column("source_version", sa.String(length=40), nullable=True))
        batch_op.add_column(sa.Column("device_name", sa.String(length=255), nullable=True))
        batch_op.create_index(batch_op.f("ix_healthmetric_provider"), ["provider"], unique=False)

    op.execute(
        "DELETE FROM healthappconnection WHERE provider NOT IN ('apple_health', 'google_fit')"
    )


def downgrade() -> None:
    with op.batch_alter_table("healthmetric") as batch_op:
        batch_op.drop_index(batch_op.f("ix_healthmetric_provider"))
        batch_op.drop_column("device_name")
        batch_op.drop_column("source_version")
        batch_op.drop_column("source_name")
        batch_op.drop_column("external_type")
        batch_op.drop_column("provider")

    with op.batch_alter_table("healthdatafile") as batch_op:
        batch_op.drop_index(batch_op.f("ix_healthdatafile_provider"))
        batch_op.drop_column("provider")
