import os
from uuid import uuid4

import pytest
from cocha_api.db.models import Dataset, District
from cocha_api.db.session import get_engine
from cocha_api.main import create_app
from fastapi.testclient import TestClient
from geoalchemy2.elements import WKTElement
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

pytestmark = [
    pytest.mark.integration,
    pytest.mark.skipif(os.getenv("RUN_DB_TESTS") != "1", reason="Requires migrated PostGIS"),
]


@pytest.fixture(autouse=True)
def require_test_database():
    name = get_engine().url.database or ""
    if not name.endswith("_test"):
        pytest.fail("Integration tests require a dedicated database whose name ends in _test")


def test_readiness_and_catalog_roundtrip():
    dataset_id = uuid4()
    with Session(get_engine()) as session:
        session.add(
            Dataset(
                id=dataset_id,
                name="Integration fixture",
                source_url="https://example.org/test",
                product_version="test-only",
                license="test-only",
            )
        )
        session.commit()
    try:
        with TestClient(create_app()) as client:
            assert client.get("/health/ready").status_code == 200
            response = client.get("/v1/datasets?limit=100")
        assert response.status_code == 200
        assert any(item["id"] == str(dataset_id) for item in response.json())
    finally:
        with Session(get_engine()) as session:
            session.execute(delete(Dataset).where(Dataset.id == dataset_id))
            session.commit()


def test_postgis_preserves_geometry_and_rejects_invalid_district_number():
    """Synthetic square used only to check DB constraints, never a municipal boundary."""
    from sqlalchemy.exc import IntegrityError

    district_id = uuid4()
    geometry = WKTElement("MULTIPOLYGON(((0 0,0 1,1 1,1 0,0 0)))", srid=4326)
    with Session(get_engine()) as session:
        try:
            session.add(
                District(
                    id=district_id,
                    number=15,
                    name="Synthetic test fixture",
                    source_url="https://example.org/test",
                    boundary_version="synthetic",
                    geometry=geometry,
                )
            )
            session.flush()
            srid, valid = session.execute(
                select(func.ST_SRID(District.geometry), func.ST_IsValid(District.geometry)).where(
                    District.id == district_id
                )
            ).one()
            assert srid == 4326
            assert valid is True
            session.rollback()
            session.add(
                District(
                    number=16,
                    name="Invalid test fixture",
                    source_url="https://example.org/test",
                    boundary_version="synthetic",
                    geometry=geometry,
                )
            )
            with pytest.raises(IntegrityError):
                session.flush()
        finally:
            session.rollback()
