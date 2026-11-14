"""Synthetic CSV regression cases; writes only to a dedicated migrated test DB."""

import importlib.util
import os
from pathlib import Path
from uuid import uuid4

import pytest
from cocha_api.db.models import Observation, ProcessingRun, Station
from cocha_api.db.session import get_engine
from sqlalchemy import delete, select, text
from sqlalchemy.exc import DataError
from sqlalchemy.orm import Session

pytestmark = [
    pytest.mark.integration,
    pytest.mark.skipif(os.getenv("RUN_DB_TESTS") != "1", reason="Requires migrated PostGIS"),
]


@pytest.fixture
def import_context(tmp_path):
    engine = get_engine()
    if not (engine.url.database or "").endswith("_test"):
        pytest.fail("MONICA regression tests require a dedicated _test database")
    path = Path(__file__).resolve().parents[2] / "scripts" / "import_monica.py"
    spec = importlib.util.spec_from_file_location("import_monica", path)
    assert spec is not None and spec.loader is not None
    importer = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(importer)
    source = f"synthetic-{uuid4()}"
    csv = tmp_path / "synthetic.csv"
    csv.write_text(
        f"estacion,pm10,fecha_medicion\n{source},12,2022-07-10 12:00:00\n",
        encoding="utf-8",
    )
    try:
        yield importer, engine, source, csv
    finally:
        with Session(engine) as session, session.begin():
            station_ids = select(Station.id).where(Station.source_id == source)
            session.execute(delete(Observation).where(Observation.station_id.in_(station_ids)))
            session.execute(delete(Station).where(Station.source_id == source))
            session.execute(
                delete(ProcessingRun).where(
                    ProcessingRun.parameters["input_dir"].astext == str(tmp_path)
                )
            )


@pytest.mark.parametrize("failure", ["missing_file", "sql_error"])
def test_failed_import_rolls_back_data_and_retains_failed_run(import_context, monkeypatch, failure):
    importer, engine, source, csv = import_context
    names = [csv.name, "missing.csv"]
    expected_error = FileNotFoundError
    if failure == "sql_error":
        names = [csv.name, csv.name]
        expected_error = DataError
        original = importer.import_file
        calls = 0

        def import_then_fail(session, path, run):
            nonlocal calls
            calls += 1
            if calls == 2:
                session.execute(text("SELECT 1 / 0"))
            return original(session, path, run)

        monkeypatch.setattr(importer, "import_file", import_then_fail)
    with pytest.raises(expected_error):
        importer.import_files(engine, csv.parent, names)
    with Session(engine) as session:
        assert session.scalar(select(Station).where(Station.source_id == source)) is None
        run = session.scalars(
            select(ProcessingRun).where(
                ProcessingRun.parameters["input_dir"].astext == str(csv.parent)
            )
        ).one()
        assert run.status == "failed"
        assert run.finished_at is not None
        assert run.parameters["error_type"] == expected_error.__name__


def test_duplicates_and_reimports_preserve_canonical_value_and_provenance(import_context):
    importer, engine, source, csv = import_context
    csv.write_text(
        csv.read_text(encoding="utf-8") + f"{source},99,2022-07-10 12:00:00.000\n",
        encoding="utf-8",
    )
    first = importer.import_files(engine, csv.parent, [csv.name])[0]
    assert first["upserted"] == 1
    assert first["skipped_duplicates"] == 1
    with Session(engine) as session:
        observation = session.scalars(
            select(Observation).join(Station).where(Station.source_id == source)
        ).one()
        identity = observation.id, observation.processing_run_id
    # A later source correction must not silently overwrite an accepted record.
    csv.write_text(
        f"estacion,pm10,fecha_medicion\n{source},88,2022-07-10 12:00:00\n",
        encoding="utf-8",
    )
    second = importer.import_files(engine, csv.parent, [csv.name])[0]
    assert second["upserted"] == 0
    assert second["skipped_existing"] == 1
    with Session(engine) as session:
        observation = session.scalars(
            select(Observation).join(Station).where(Station.source_id == source)
        ).one()
        assert observation.value == 12
        assert observation.quality_flag == "valid"
        assert (observation.id, observation.processing_run_id) == identity
