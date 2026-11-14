"""Publication gates for results and lifecycle columns for processing runs.

District numbers become unique per boundary_version so demo rectangles and an
official vector can coexist. assistant_requests is the central Gemini budget
ledger shared by every API host. Existing rows become 'draft'; nothing is
published by this migration. The district indicator identity is rebuilt with
NULLS NOT DISTINCT (PostgreSQL 15+) so rows without a processing run cannot
duplicate silently; the upgrade fails if such duplicates already exist and
must be resolved by hand first.
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None

PUBLICATION_CHECK = "publication_status IN ('draft', 'accepted', 'withdrawn')"
ACCEPTANCE_CHECK = (
    "publication_status <> 'accepted' OR (accepted_by IS NOT NULL AND accepted_at IS NOT NULL)"
)
MODEL_ACCEPTANCE_CHECK = (
    "publication_status <> 'accepted' OR ("
    "accepted_by IS NOT NULL AND accepted_at IS NOT NULL "
    "AND model_version IS NOT NULL AND artifact_checksum_sha256 IS NOT NULL "
    "AND uncertainty IS NOT NULL AND domain_of_use IS NOT NULL)"
)
PUBLISHED_TABLES = ("district_indicators", "trend_results", "model_runs", "scenario_runs")


def _publication_columns(table: str) -> None:
    op.add_column(
        table,
        sa.Column(
            "publication_status", sa.String(length=20), server_default="draft", nullable=False
        ),
    )
    op.add_column(table, sa.Column("accepted_by", sa.String(length=100), nullable=True))
    op.add_column(table, sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True))
    op.create_check_constraint(f"{table}_publication_status", table, PUBLICATION_CHECK)


def upgrade():
    # 0001 left the constraint unnamed; PostgreSQL named it districts_number_key.
    op.drop_constraint("districts_number_key", "districts", type_="unique")
    op.create_unique_constraint(
        "districts_boundary_number_key", "districts", ["boundary_version", "number"]
    )

    op.add_column(
        "processing_runs", sa.Column("idempotency_key", sa.String(length=200), nullable=True)
    )
    op.add_column(
        "processing_runs",
        sa.Column("attempt", sa.Integer(), server_default="1", nullable=False),
    )
    op.add_column(
        "processing_runs", sa.Column("heartbeat_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column("processing_runs", sa.Column("error_code", sa.String(length=100), nullable=True))
    op.create_index(
        "processing_runs_idempotency_key_uq",
        "processing_runs",
        ["idempotency_key"],
        unique=True,
        postgresql_where=sa.text("idempotency_key IS NOT NULL"),
    )
    op.create_index(
        "processing_runs_status_heartbeat_idx", "processing_runs", ["status", "heartbeat_at"]
    )

    for table in PUBLISHED_TABLES:
        _publication_columns(table)
    for table in ("district_indicators", "trend_results", "scenario_runs"):
        op.create_check_constraint(f"{table}_acceptance", table, ACCEPTANCE_CHECK)

    op.add_column(
        "district_indicators",
        sa.Column("provenance", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.drop_constraint("district_indicators_identity_key", "district_indicators", type_="unique")
    op.create_unique_constraint(
        "district_indicators_identity_key",
        "district_indicators",
        [
            "district_id",
            "boundary_version",
            "variable",
            "period_start",
            "period_end",
            "statistic",
            "processing_run_id",
        ],
        postgresql_nulls_not_distinct=True,
    )
    op.create_index(
        "district_indicators_publication_idx",
        "district_indicators",
        ["publication_status", "boundary_version", "variable", "period_start"],
    )

    op.add_column("model_runs", sa.Column("model_version", sa.String(length=64), nullable=True))
    op.add_column(
        "model_runs",
        sa.Column("uncertainty", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.add_column(
        "model_runs",
        sa.Column("domain_of_use", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.create_check_constraint("model_runs_acceptance", "model_runs", MODEL_ACCEPTANCE_CHECK)

    op.create_table(
        "assistant_requests",
        sa.Column("request_id", sa.String(length=100), nullable=False),
        sa.Column("model", sa.String(length=100), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("reserved_usd", sa.Numeric(12, 6), nullable=False),
        sa.Column("charged_usd", sa.Numeric(12, 6), nullable=True),
        sa.Column("input_tokens", sa.Integer(), nullable=True),
        sa.Column("output_tokens", sa.Integer(), nullable=True),
        sa.Column("response", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("settled_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("status IN ('reserved', 'settled')", name="assistant_requests_status"),
        sa.CheckConstraint("reserved_usd > 0", name="assistant_requests_reserved_positive"),
        sa.CheckConstraint(
            "charged_usd IS NULL OR charged_usd >= 0", name="assistant_requests_charged_nonneg"
        ),
        sa.PrimaryKeyConstraint("request_id"),
    )


def downgrade():
    op.drop_table("assistant_requests")
    op.drop_constraint("model_runs_acceptance", "model_runs", type_="check")
    op.drop_column("model_runs", "domain_of_use")
    op.drop_column("model_runs", "uncertainty")
    op.drop_column("model_runs", "model_version")

    op.drop_index("district_indicators_publication_idx", table_name="district_indicators")
    op.drop_constraint("district_indicators_identity_key", "district_indicators", type_="unique")
    op.create_unique_constraint(
        "district_indicators_identity_key",
        "district_indicators",
        [
            "district_id",
            "boundary_version",
            "variable",
            "period_start",
            "period_end",
            "statistic",
            "processing_run_id",
        ],
    )
    op.drop_column("district_indicators", "provenance")

    for table in ("district_indicators", "trend_results", "scenario_runs"):
        op.drop_constraint(f"{table}_acceptance", table, type_="check")
    for table in PUBLISHED_TABLES:
        op.drop_constraint(f"{table}_publication_status", table, type_="check")
        op.drop_column(table, "accepted_at")
        op.drop_column(table, "accepted_by")
        op.drop_column(table, "publication_status")

    op.drop_index("processing_runs_status_heartbeat_idx", table_name="processing_runs")
    op.drop_index("processing_runs_idempotency_key_uq", table_name="processing_runs")
    op.drop_column("processing_runs", "error_code")
    op.drop_column("processing_runs", "heartbeat_at")
    op.drop_column("processing_runs", "attempt")
    op.drop_column("processing_runs", "idempotency_key")

    # Fails if demo and official versions share numbers; remove one version first.
    op.drop_constraint("districts_boundary_number_key", "districts", type_="unique")
    op.create_unique_constraint("districts_number_key", "districts", ["number"])
