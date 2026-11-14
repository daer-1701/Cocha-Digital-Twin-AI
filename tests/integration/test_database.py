import os
from uuid import uuid4

import pytest
from cocha_api.db.models import Dataset
from cocha_api.db.session import get_engine
from cocha_api.main import create_app
from fastapi.testclient import TestClient
from sqlalchemy import delete
from sqlalchemy.orm import Session

pytestmark = [
    pytest.mark.integration,
    pytest.mark.skipif(os.getenv("RUN_DB_TESTS") != "1", reason="Requires migrated PostGIS"),
]


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
