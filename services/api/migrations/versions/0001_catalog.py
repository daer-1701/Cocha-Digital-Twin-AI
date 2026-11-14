"""Initial source catalog and verified district boundaries. No seed data."""

import geoalchemy2
import sqlalchemy as sa
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # The infrastructure administrator provisions PostGIS; application users need no superuser.
    op.create_table(
        "datasets",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("source_url", sa.Text(), nullable=False),
        sa.Column("product_version", sa.String(100), nullable=False),
        sa.Column("license", sa.Text(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "districts",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("number", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("source_url", sa.Text(), nullable=False),
        sa.Column("boundary_version", sa.String(100), nullable=False),
        sa.Column("geometry", geoalchemy2.Geometry("MULTIPOLYGON", srid=4326), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("number"),
        sa.CheckConstraint("number BETWEEN 1 AND 15", name="district_number_range"),
    )


def downgrade():
    op.drop_table("districts")
    op.drop_table("datasets")
