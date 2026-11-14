from datetime import datetime
from uuid import UUID, uuid4

from geoalchemy2 import Geometry
from geoalchemy2.elements import WKBElement
from sqlalchemy import CheckConstraint, DateTime, String, Text, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class Dataset(Base):
    __tablename__ = "datasets"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(200))
    source_url: Mapped[str] = mapped_column(Text)
    product_version: Mapped[str] = mapped_column(String(100))
    license: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class District(Base):
    __tablename__ = "districts"
    __table_args__ = (CheckConstraint("number BETWEEN 1 AND 15", name="district_number_range"),)

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    number: Mapped[int] = mapped_column(unique=True)
    name: Mapped[str] = mapped_column(String(200))
    source_url: Mapped[str] = mapped_column(Text)
    boundary_version: Mapped[str] = mapped_column(String(100))
    geometry: Mapped[WKBElement] = mapped_column(
        Geometry(geometry_type="MULTIPOLYGON", srid=4326, spatial_index=True)
    )
