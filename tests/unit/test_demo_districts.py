"""Synthetic demo districts. They are not GAMC boundaries."""

import importlib.util
from pathlib import Path
from unittest.mock import MagicMock

import pytest
from cocha_api.science.demo_districts import DEMO_SOURCE, load_demo_fixture

FIXTURE = Path(__file__).resolve().parents[2] / "data" / "fixtures" / "demo_districts.geojson"
IMPORTER = Path(__file__).resolve().parents[2] / "scripts" / "import_demo_districts.py"


def _importer():
    spec = importlib.util.spec_from_file_location("import_demo_districts", IMPORTER)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_fixture_has_fifteen_labeled_rectangles_near_the_pilot():
    polygons = load_demo_fixture(FIXTURE)
    assert [item.number for item in polygons] == list(range(1, 16))
    assert all(item.source == DEMO_SOURCE for item in polygons)
    assert all(item.boundary_version == "demo-synthetic-v1" for item in polygons)
    assert all(item.ring[0] == item.ring[-1] for item in polygons)


def test_import_refuses_to_run_without_the_demo_acknowledgement():
    importer = _importer()
    with pytest.raises(SystemExit, match="not an official GAMC boundary"):
        importer.main([])


def test_upsert_is_idempotent_and_refuses_non_demo_boundaries():
    importer = _importer()
    polygon = load_demo_fixture(FIXTURE)[0]
    session = MagicMock()
    session.scalar.return_value = None
    created = importer.upsert_demo_districts(
        session, [polygon], source_url="data/fixtures/demo_districts.geojson"
    )
    assert created == {"inserted": 1, "updated": 0}
    assert session.add.called

    existing = MagicMock()
    existing.boundary_version = "demo-synthetic-v1"
    session.scalar.return_value = existing
    updated = importer.upsert_demo_districts(
        session, [polygon], source_url="data/fixtures/demo_districts.geojson"
    )
    assert updated == {"inserted": 0, "updated": 1}
    assert existing.name == polygon.name
    assert existing.boundary_version == "demo-synthetic-v1"
    assert existing.source_url == "data/fixtures/demo_districts.geojson"

    existing.boundary_version = "gamc-unverified"
    with pytest.raises(importer.DemoOverwriteError, match="gamc-unverified"):
        importer.upsert_demo_districts(
            session, [polygon], source_url="data/fixtures/demo_districts.geojson"
        )
