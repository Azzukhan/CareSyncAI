"""add_patient_history_access_controls

Revision ID: 6fdff72dbf0b
Revises: 1b3b4b2f4a10
Create Date: 2026-03-15 10:15:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "6fdff72dbf0b"
down_revision = "1b3b4b2f4a10"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "gpvisit",
        sa.Column("shared_with_gp", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "gpvisit",
        sa.Column(
            "shared_with_specialist",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )

    op.add_column(
        "specialistreferral",
        sa.Column(
            "is_hidden_by_patient",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.add_column(
        "specialistreferral",
        sa.Column("shared_with_gp", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "specialistreferral",
        sa.Column(
            "shared_with_specialist",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )

    op.add_column(
        "laborder",
        sa.Column("shared_with_gp", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "laborder",
        sa.Column(
            "shared_with_specialist",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )

    op.add_column(
        "medicationorder",
        sa.Column("shared_with_gp", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "medicationorder",
        sa.Column(
            "shared_with_specialist",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )

    op.alter_column("gpvisit", "shared_with_gp", server_default=None)
    op.alter_column("gpvisit", "shared_with_specialist", server_default=None)
    op.alter_column("specialistreferral", "is_hidden_by_patient", server_default=None)
    op.alter_column("specialistreferral", "shared_with_gp", server_default=None)
    op.alter_column("specialistreferral", "shared_with_specialist", server_default=None)
    op.alter_column("laborder", "shared_with_gp", server_default=None)
    op.alter_column("laborder", "shared_with_specialist", server_default=None)
    op.alter_column("medicationorder", "shared_with_gp", server_default=None)
    op.alter_column("medicationorder", "shared_with_specialist", server_default=None)


def downgrade() -> None:
    op.drop_column("medicationorder", "shared_with_specialist")
    op.drop_column("medicationorder", "shared_with_gp")
    op.drop_column("laborder", "shared_with_specialist")
    op.drop_column("laborder", "shared_with_gp")
    op.drop_column("specialistreferral", "shared_with_specialist")
    op.drop_column("specialistreferral", "shared_with_gp")
    op.drop_column("specialistreferral", "is_hidden_by_patient")
    op.drop_column("gpvisit", "shared_with_specialist")
    op.drop_column("gpvisit", "shared_with_gp")
