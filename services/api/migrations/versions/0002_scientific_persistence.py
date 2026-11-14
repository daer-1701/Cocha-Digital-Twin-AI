"""Scientific persistence tables for runs, assets, stations, and results.

Rasters remain URI + checksum references; no binary blobs in the database.
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "processing_runs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("kind", sa.String(length=100), nullable=False),
        sa.Column("status", sa.String(length=40), nullable=False),
        sa.Column("git_commit", sa.String(length=64), nullable=True),
        sa.Column("environment_version", sa.String(length=100), nullable=True),
        sa.Column("parameters", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "assets",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("dataset_id", sa.Uuid(), nullable=True),
        sa.Column("processing_run_id", sa.Uuid(), nullable=True),
        sa.Column("uri", sa.Text(), nullable=False),
        sa.Column("checksum_sha256", sa.String(length=64), nullable=False),
        sa.Column("media_type", sa.String(length=100), nullable=True),
        sa.Column("acquired_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("crs", sa.String(length=64), nullable=True),
        sa.Column("resolution_m", sa.Float(), nullable=True),
        sa.Column("units", sa.String(length=64), nullable=True),
        sa.Column("qa_mask_uri", sa.Text(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(["dataset_id"], ["datasets.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["processing_run_id"], ["processing_runs.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "stations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("source_id", sa.String(length=100), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("network", sa.String(length=100), nullable=False),
        sa.Column("latitude", sa.Float(), nullable=True),
        sa.Column("longitude", sa.Float(), nullable=True),
        sa.Column("elevation_m", sa.Float(), nullable=True),
        sa.Column("unit_declared", sa.String(length=64), nullable=True),
        sa.Column("timezone_declared", sa.String(length=64), nullable=True),
        sa.Column("analysis_enabled", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("metadata_pending", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("source_id", name="stations_source_id_key"),
    )
    op.create_table(
        "observations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("station_id", sa.Uuid(), nullable=False),
        sa.Column("processing_run_id", sa.Uuid(), nullable=True),
        sa.Column("variable", sa.String(length=64), nullable=False),
        sa.Column("unit", sa.String(length=64), nullable=True),
        sa.Column("observed_at", sa.DateTime(timezone=False), nullable=False),
        sa.Column("observed_at_raw", sa.Text(), nullable=False),
        sa.Column("value", sa.Numeric(14, 4), nullable=True),
        sa.Column("quality_flag", sa.String(length=40), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(["processing_run_id"], ["processing_runs.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["station_id"], ["stations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "station_id",
            "variable",
            "observed_at",
            name="observations_station_variable_time_key",
        ),
    )
    op.create_table(
        "district_indicators",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("district_id", sa.Uuid(), nullable=False),
        sa.Column("boundary_version", sa.String(length=100), nullable=False),
        sa.Column("variable", sa.String(length=64), nullable=False),
        sa.Column("statistic", sa.String(length=64), nullable=False),
        sa.Column("period_start", sa.Date(), nullable=False),
        sa.Column("period_end", sa.Date(), nullable=False),
        sa.Column("value", sa.Float(), nullable=True),
        sa.Column("units", sa.String(length=64), nullable=True),
        sa.Column("valid_fraction", sa.Float(), nullable=True),
        sa.Column("n", sa.Integer(), nullable=True),
        sa.Column("processing_run_id", sa.Uuid(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(["district_id"], ["districts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["processing_run_id"], ["processing_runs.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "district_id",
            "boundary_version",
            "variable",
            "period_start",
            "period_end",
            "statistic",
            "processing_run_id",
            name="district_indicators_identity_key",
        ),
    )
    op.create_table(
        "trend_results",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("series_key", sa.String(length=200), nullable=False),
        sa.Column("method", sa.String(length=100), nullable=False),
        sa.Column("slope", sa.Float(), nullable=True),
        sa.Column("slope_units", sa.String(length=64), nullable=True),
        sa.Column("interval_low", sa.Float(), nullable=True),
        sa.Column("interval_high", sa.Float(), nullable=True),
        sa.Column("p_value", sa.Float(), nullable=True),
        sa.Column("p_adjusted", sa.Float(), nullable=True),
        sa.Column("hypothesis", sa.Text(), nullable=True),
        sa.Column("processing_run_id", sa.Uuid(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(["processing_run_id"], ["processing_runs.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "model_runs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("objective", sa.String(length=200), nullable=False),
        sa.Column("variables", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("validation_partition", sa.Text(), nullable=True),
        sa.Column("metrics", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("artifact_uri", sa.Text(), nullable=True),
        sa.Column("artifact_checksum_sha256", sa.String(length=64), nullable=True),
        sa.Column("provenance", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("processing_run_id", sa.Uuid(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(["processing_run_id"], ["processing_runs.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "scenario_runs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("model_run_id", sa.Uuid(), nullable=True),
        sa.Column("assumptions", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("intervention", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("result", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("uncertainty", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("processing_run_id", sa.Uuid(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(["model_run_id"], ["model_runs.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["processing_run_id"], ["processing_runs.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade():
    op.drop_table("scenario_runs")
    op.drop_table("model_runs")
    op.drop_table("trend_results")
    op.drop_table("district_indicators")
    op.drop_table("observations")
    op.drop_table("stations")
    op.drop_table("assets")
    op.drop_table("processing_runs")
