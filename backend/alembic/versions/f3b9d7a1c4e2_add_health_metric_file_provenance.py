"""add health metric file provenance

Revision ID: f3b9d7a1c4e2
Revises: e4a1b6c9d2f3
Create Date: 2026-03-19 10:15:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "f3b9d7a1c4e2"
down_revision = "e4a1b6c9d2f3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "healthmetric",
        sa.Column("health_data_file_id", sa.String(length=36), nullable=True),
    )
    op.create_index(
        "ix_healthmetric_health_data_file_id",
        "healthmetric",
        ["health_data_file_id"],
        unique=False,
    )
    op.create_foreign_key(
        "fk_healthmetric_health_data_file_id_healthdatafile",
        "healthmetric",
        "healthdatafile",
        ["health_data_file_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_healthmetric_health_data_file_id_healthdatafile",
        "healthmetric",
        type_="foreignkey",
    )
    op.drop_index("ix_healthmetric_health_data_file_id", table_name="healthmetric")
    op.drop_column("healthmetric", "health_data_file_id")
