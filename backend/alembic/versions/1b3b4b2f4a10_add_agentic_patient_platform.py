"""add_agentic_patient_platform

Revision ID: 1b3b4b2f4a10
Revises: fa3d5634185f
Create Date: 2026-03-14 07:30:00.000000
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision = "1b3b4b2f4a10"
down_revision = "fa3d5634185f"
branch_labels = None
depends_on = None


careagenttype = postgresql.ENUM(
    "MEDICAL", "EXERCISE", "DIET", name="careagenttype", create_type=False
)
agentpreferredpanel = postgresql.ENUM(
    "SUMMARY", "PLAN", "CALENDAR", "HISTORY", name="agentpreferredpanel", create_type=False
)
careplantype = postgresql.ENUM(
    "EXERCISE", "DIET", name="careplantype", create_type=False
)
careplanstatus = postgresql.ENUM(
    "ACTIVE", "ARCHIVED", "DRAFT", name="careplanstatus", create_type=False
)
careplanitemtype = postgresql.ENUM(
    "EXERCISE", "MEAL", name="careplanitemtype", create_type=False
)
careplancheckinstatus = postgresql.ENUM(
    "COMPLETED",
    "MISSED",
    "SKIPPED",
    "REPLACED",
    name="careplancheckinstatus",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    careagenttype.create(bind, checkfirst=True)
    agentpreferredpanel.create(bind, checkfirst=True)
    careplantype.create(bind, checkfirst=True)
    careplanstatus.create(bind, checkfirst=True)
    careplanitemtype.create(bind, checkfirst=True)
    careplancheckinstatus.create(bind, checkfirst=True)

    op.create_table(
        "agentic_conversation",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("agent", careagenttype, nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("starred", sa.Boolean(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_agentic_conversation_user_id"),
        "agentic_conversation",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_agentic_conversation_agent"),
        "agentic_conversation",
        ["agent"],
        unique=False,
    )
    op.create_index(
        op.f("ix_agentic_conversation_is_active"),
        "agentic_conversation",
        ["is_active"],
        unique=False,
    )
    op.create_index(
        op.f("ix_agentic_conversation_created_at"),
        "agentic_conversation",
        ["created_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_agentic_conversation_updated_at"),
        "agentic_conversation",
        ["updated_at"],
        unique=False,
    )

    op.create_table(
        "agentic_message",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("conversation_id", sa.String(length=36), nullable=False),
        sa.Column("prompt", sa.Text(), nullable=False),
        sa.Column("response_data", sa.JSON(), nullable=True),
        sa.Column("preferred_panel", agentpreferredpanel, nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["conversation_id"], ["agentic_conversation.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_agentic_message_user_id"), "agentic_message", ["user_id"], unique=False)
    op.create_index(
        op.f("ix_agentic_message_conversation_id"),
        "agentic_message",
        ["conversation_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_agentic_message_is_active"),
        "agentic_message",
        ["is_active"],
        unique=False,
    )
    op.create_index(
        op.f("ix_agentic_message_created_at"),
        "agentic_message",
        ["created_at"],
        unique=False,
    )

    op.create_table(
        "agentic_profile",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("goals", sa.JSON(), nullable=False),
        sa.Column("allergies", sa.JSON(), nullable=False),
        sa.Column("injuries_pain_points", sa.Text(), nullable=True),
        sa.Column("dietary_constraints", sa.JSON(), nullable=False),
        sa.Column("motivation_style", sa.String(length=80), nullable=True),
        sa.Column("equipment_access", sa.Text(), nullable=True),
        sa.Column("schedule_preferences", sa.JSON(), nullable=False),
        sa.Column("sleep_work_routine", sa.Text(), nullable=True),
        sa.Column("preferred_plan_horizon_days", sa.Integer(), nullable=False),
        sa.Column("share_medical_history", sa.Boolean(), nullable=False),
        sa.Column("share_medications", sa.Boolean(), nullable=False),
        sa.Column("share_health_metrics", sa.Boolean(), nullable=False),
        sa.Column("additional_notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )
    op.create_index(op.f("ix_agentic_profile_user_id"), "agentic_profile", ["user_id"], unique=True)

    op.create_table(
        "care_plan",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("plan_type", careplantype, nullable=False),
        sa.Column("status", careplanstatus, nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("supersedes_plan_id", sa.String(length=36), nullable=True),
        sa.Column("created_from_conversation_id", sa.String(length=36), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["created_from_conversation_id"], ["agentic_conversation.id"]),
        sa.ForeignKeyConstraint(["supersedes_plan_id"], ["care_plan.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_care_plan_user_id"), "care_plan", ["user_id"], unique=False)
    op.create_index(op.f("ix_care_plan_plan_type"), "care_plan", ["plan_type"], unique=False)
    op.create_index(op.f("ix_care_plan_status"), "care_plan", ["status"], unique=False)
    op.create_index(op.f("ix_care_plan_start_date"), "care_plan", ["start_date"], unique=False)
    op.create_index(op.f("ix_care_plan_end_date"), "care_plan", ["end_date"], unique=False)
    op.create_index(
        op.f("ix_care_plan_supersedes_plan_id"),
        "care_plan",
        ["supersedes_plan_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_care_plan_created_from_conversation_id"),
        "care_plan",
        ["created_from_conversation_id"],
        unique=False,
    )
    op.create_index(op.f("ix_care_plan_created_at"), "care_plan", ["created_at"], unique=False)
    op.create_index(op.f("ix_care_plan_updated_at"), "care_plan", ["updated_at"], unique=False)

    op.create_table(
        "care_plan_item",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("plan_id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("item_type", careplanitemtype, nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("scheduled_day", sa.String(length=16), nullable=True),
        sa.Column("scheduled_date", sa.Date(), nullable=True),
        sa.Column("meal_slot", sa.String(length=30), nullable=True),
        sa.Column("target_time", sa.String(length=10), nullable=True),
        sa.Column("duration_minutes", sa.Integer(), nullable=True),
        sa.Column("calories", sa.Float(), nullable=True),
        sa.Column("intensity", sa.String(length=20), nullable=True),
        sa.Column("instructions", sa.Text(), nullable=True),
        sa.Column("details", sa.JSON(), nullable=True),
        sa.Column("order_index", sa.Integer(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["plan_id"], ["care_plan.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_care_plan_item_plan_id"), "care_plan_item", ["plan_id"], unique=False)
    op.create_index(op.f("ix_care_plan_item_user_id"), "care_plan_item", ["user_id"], unique=False)
    op.create_index(op.f("ix_care_plan_item_item_type"), "care_plan_item", ["item_type"], unique=False)
    op.create_index(
        op.f("ix_care_plan_item_scheduled_day"),
        "care_plan_item",
        ["scheduled_day"],
        unique=False,
    )
    op.create_index(
        op.f("ix_care_plan_item_scheduled_date"),
        "care_plan_item",
        ["scheduled_date"],
        unique=False,
    )
    op.create_index(
        op.f("ix_care_plan_item_is_active"),
        "care_plan_item",
        ["is_active"],
        unique=False,
    )

    op.create_table(
        "care_plan_item_override",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("plan_item_id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("override_date", sa.Date(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=True),
        sa.Column("target_time", sa.String(length=10), nullable=True),
        sa.Column("duration_minutes", sa.Integer(), nullable=True),
        sa.Column("calories", sa.Float(), nullable=True),
        sa.Column("intensity", sa.String(length=20), nullable=True),
        sa.Column("instructions", sa.Text(), nullable=True),
        sa.Column("details", sa.JSON(), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["plan_item_id"], ["care_plan_item.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("plan_item_id", "override_date", name="uq_care_plan_item_override"),
    )
    op.create_index(
        op.f("ix_care_plan_item_override_plan_item_id"),
        "care_plan_item_override",
        ["plan_item_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_care_plan_item_override_user_id"),
        "care_plan_item_override",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_care_plan_item_override_override_date"),
        "care_plan_item_override",
        ["override_date"],
        unique=False,
    )

    op.create_table(
        "care_plan_checkin",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("plan_item_id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("checkin_date", sa.Date(), nullable=False),
        sa.Column("status", careplancheckinstatus, nullable=False),
        sa.Column("pain_level", sa.Integer(), nullable=True),
        sa.Column("energy_level", sa.Integer(), nullable=True),
        sa.Column("hunger_level", sa.Integer(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("replacement_title", sa.String(length=200), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["plan_item_id"], ["care_plan_item.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("plan_item_id", "checkin_date", name="uq_care_plan_checkin"),
    )
    op.create_index(
        op.f("ix_care_plan_checkin_plan_item_id"),
        "care_plan_checkin",
        ["plan_item_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_care_plan_checkin_user_id"),
        "care_plan_checkin",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_care_plan_checkin_checkin_date"),
        "care_plan_checkin",
        ["checkin_date"],
        unique=False,
    )
    op.create_index(
        op.f("ix_care_plan_checkin_status"),
        "care_plan_checkin",
        ["status"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_care_plan_checkin_status"), table_name="care_plan_checkin")
    op.drop_index(op.f("ix_care_plan_checkin_checkin_date"), table_name="care_plan_checkin")
    op.drop_index(op.f("ix_care_plan_checkin_user_id"), table_name="care_plan_checkin")
    op.drop_index(op.f("ix_care_plan_checkin_plan_item_id"), table_name="care_plan_checkin")
    op.drop_table("care_plan_checkin")

    op.drop_index(
        op.f("ix_care_plan_item_override_override_date"),
        table_name="care_plan_item_override",
    )
    op.drop_index(op.f("ix_care_plan_item_override_user_id"), table_name="care_plan_item_override")
    op.drop_index(
        op.f("ix_care_plan_item_override_plan_item_id"),
        table_name="care_plan_item_override",
    )
    op.drop_table("care_plan_item_override")

    op.drop_index(op.f("ix_care_plan_item_is_active"), table_name="care_plan_item")
    op.drop_index(op.f("ix_care_plan_item_scheduled_date"), table_name="care_plan_item")
    op.drop_index(op.f("ix_care_plan_item_scheduled_day"), table_name="care_plan_item")
    op.drop_index(op.f("ix_care_plan_item_item_type"), table_name="care_plan_item")
    op.drop_index(op.f("ix_care_plan_item_user_id"), table_name="care_plan_item")
    op.drop_index(op.f("ix_care_plan_item_plan_id"), table_name="care_plan_item")
    op.drop_table("care_plan_item")

    op.drop_index(op.f("ix_care_plan_updated_at"), table_name="care_plan")
    op.drop_index(op.f("ix_care_plan_created_at"), table_name="care_plan")
    op.drop_index(
        op.f("ix_care_plan_created_from_conversation_id"),
        table_name="care_plan",
    )
    op.drop_index(op.f("ix_care_plan_supersedes_plan_id"), table_name="care_plan")
    op.drop_index(op.f("ix_care_plan_end_date"), table_name="care_plan")
    op.drop_index(op.f("ix_care_plan_start_date"), table_name="care_plan")
    op.drop_index(op.f("ix_care_plan_status"), table_name="care_plan")
    op.drop_index(op.f("ix_care_plan_plan_type"), table_name="care_plan")
    op.drop_index(op.f("ix_care_plan_user_id"), table_name="care_plan")
    op.drop_table("care_plan")

    op.drop_index(op.f("ix_agentic_profile_user_id"), table_name="agentic_profile")
    op.drop_table("agentic_profile")

    op.drop_index(op.f("ix_agentic_message_created_at"), table_name="agentic_message")
    op.drop_index(op.f("ix_agentic_message_is_active"), table_name="agentic_message")
    op.drop_index(op.f("ix_agentic_message_conversation_id"), table_name="agentic_message")
    op.drop_index(op.f("ix_agentic_message_user_id"), table_name="agentic_message")
    op.drop_table("agentic_message")

    op.drop_index(op.f("ix_agentic_conversation_updated_at"), table_name="agentic_conversation")
    op.drop_index(op.f("ix_agentic_conversation_created_at"), table_name="agentic_conversation")
    op.drop_index(op.f("ix_agentic_conversation_is_active"), table_name="agentic_conversation")
    op.drop_index(op.f("ix_agentic_conversation_agent"), table_name="agentic_conversation")
    op.drop_index(op.f("ix_agentic_conversation_user_id"), table_name="agentic_conversation")
    op.drop_table("agentic_conversation")

    bind = op.get_bind()
    careplancheckinstatus.drop(bind, checkfirst=True)
    careplanitemtype.drop(bind, checkfirst=True)
    careplanstatus.drop(bind, checkfirst=True)
    careplantype.drop(bind, checkfirst=True)
    agentpreferredpanel.drop(bind, checkfirst=True)
    careagenttype.drop(bind, checkfirst=True)
