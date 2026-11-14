"""Job lifecycle, central Gemini ledger and official publication on a dedicated _test DB.

Synthetic rows only, removed afterwards. No provider is called.
"""

import importlib.util
import json
import os
import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from pathlib import Path
from uuid import uuid4

import pytest
from cocha_api.db.models import AssistantRequest, District, DistrictIndicator, ProcessingRun
from cocha_api.db.session import get_engine
from cocha_api.jobs import finish_run, heartbeat, recover_stale, start_run
from cocha_api.main import create_app
from cocha_api.science.gemini import CentralBudgetLedger
from fastapi.testclient import TestClient
from geoalchemy2.elements import WKTElement
from sqlalchemy import delete
from sqlalchemy.orm import Session

pytestmark = [
    pytest.mark.integration,
    pytest.mark.skipif(os.getenv("RUN_DB_TESTS") != "1", reason="Requires migrated PostGIS"),
]
ROOT = Path(__file__).resolve().parents[2]


@pytest.fixture
def engine():
    current = get_engine()
    if not (current.url.database or "").endswith("_test"):
        pytest.fail("Integration tests require a dedicated _test database")
    return current


def _script(name: str):
    spec = importlib.util.spec_from_file_location(name, ROOT / "scripts" / f"{name}.py")
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def test_run_lifecycle_retries_until_exhausted_and_never_reruns_completed(engine):
    key = f"test-lifecycle:{uuid4()}"
    try:
        with Session(engine) as session:
            first = start_run(session, kind="test", key=key, max_attempts=2)
            assert (first.decision, first.attempt) == ("started", 1)
            assert start_run(session, kind="test", key=key).decision == "already_running"
            heartbeat(session, first.run_id)
            finish_run(session, first.run_id, status="failed", error_code="synthetic")

            retry = start_run(session, kind="test", key=key, max_attempts=2)
            assert (retry.decision, retry.run_id, retry.attempt) == ("retrying", first.run_id, 2)
            finish_run(session, retry.run_id, status="failed", error_code="synthetic")
            assert start_run(session, kind="test", key=key, max_attempts=2).decision == "exhausted"

        completed_key = f"{key}:ok"
        with Session(engine) as session:
            run = start_run(session, kind="test", key=completed_key)
            finish_run(session, run.run_id, status="completed")
            again = start_run(session, kind="test", key=completed_key)
            assert (again.decision, again.run_id) == ("already_completed", run.run_id)
    finally:
        with Session(engine) as session, session.begin():
            session.execute(
                delete(ProcessingRun).where(ProcessingRun.idempotency_key.like(f"{key}%"))
            )


def test_recovery_marks_only_stale_running_runs(engine):
    key = f"test-recovery:{uuid4()}"
    try:
        with Session(engine) as session:
            stale = start_run(session, kind="test", key=f"{key}:stale")
            fresh = start_run(session, kind="test", key=f"{key}:fresh")
            row = session.get(ProcessingRun, stale.run_id)
            row.heartbeat_at = datetime.now(UTC) - timedelta(hours=3)
            session.commit()

            listed = recover_stale(session, stale_after=timedelta(hours=1), apply=False)
            assert stale.run_id in listed and fresh.run_id not in listed
            assert session.get(ProcessingRun, stale.run_id).status == "running"

            recover_stale(session, stale_after=timedelta(hours=1), apply=True)
            session.expire_all()
            recovered = session.get(ProcessingRun, stale.run_id)
            assert (recovered.status, recovered.error_code) == ("interrupted", "stale_heartbeat")
            assert session.get(ProcessingRun, fresh.run_id).status == "running"

            retried = start_run(session, kind="test", key=f"{key}:stale")
            assert (retried.decision, retried.attempt) == ("retrying", 2)
    finally:
        with Session(engine) as session, session.begin():
            session.execute(
                delete(ProcessingRun).where(ProcessingRun.idempotency_key.like(f"{key}%"))
            )


def test_central_ledger_never_overspends_under_concurrency_and_settles_once(engine):
    prefix = f"test-ledger-{uuid4().hex[:12]}"
    try:
        with Session(engine) as session:
            baseline = CentralBudgetLedger(session, budget_usd=1000, model="test").committed_usd()
        budget = float(baseline + Decimal("0.05"))

        def reserve(index: int) -> str:
            with Session(engine) as session:
                ledger = CentralBudgetLedger(session, budget_usd=budget, model="test")
                return ledger.reserve(f"{prefix}-{index}", 0.01)

        with ThreadPoolExecutor(max_workers=8) as pool:
            outcomes = list(pool.map(reserve, range(12)))
        assert outcomes.count("reserved") == 5
        assert outcomes.count("exceeded") == 7

        with Session(engine) as session:
            ledger = CentralBudgetLedger(session, budget_usd=budget, model="test")
            granted = outcomes.index("reserved")
            request_id = f"{prefix}-{granted}"
            assert ledger.reserve(request_id, 0.01) == "duplicate"
            answer = {"status": "answered", "request_id": request_id}
            ledger.reconcile(
                request_id, actual_usd=0.002, input_tokens=10, output_tokens=5, response=answer
            )
            ledger.reconcile(
                request_id, actual_usd=0.009, input_tokens=1, output_tokens=1, response=None
            )
            row = session.get(AssistantRequest, request_id)
            assert (row.status, row.charged_usd, row.response) == (
                "settled",
                Decimal("0.002000"),
                answer,
            )
    finally:
        with Session(engine) as session, session.begin():
            session.execute(
                delete(AssistantRequest).where(AssistantRequest.request_id.like(f"{prefix}%"))
            )


def test_loaded_indicators_stay_private_until_accepted(engine, tmp_path, capsys):
    version = f"test-official-{uuid4().hex[:10]}"
    record = {
        "district_number": 3,
        "boundary_version": version,
        "variable": "lst_celsius",
        "statistic": "mean",
        "period_start": "2024-07-01",
        "period_end": "2024-07-31",
        "value": 31.25,
        "units": "celsius",
        "valid_fraction": 0.8,
        "n": 120,
        "provenance": {
            "source_url": "https://example.invalid/synthetic",
            "product": "synthetic",
            "product_version": "test",
            "qa_mask": "synthetic",
            "resolution_m": 30,
            "crs": "EPSG:32719",
        },
    }
    delivery = tmp_path / "delivery.jsonl"
    delivery.write_text(json.dumps(record) + "\n", encoding="utf-8")
    with Session(engine) as session, session.begin():
        session.add(
            District(
                id=uuid4(),
                number=3,
                name="Synthetic official district",
                source_url="https://example.invalid/synthetic",
                boundary_version=version,
                geometry=WKTElement("MULTIPOLYGON(((0 0,1 0,1 1,0 1,0 0)))", srid=4326),
            )
        )
    loader = _script("load_district_indicators")
    publisher = _script("publish_results")
    client = TestClient(create_app())
    query = f"/v1/series?boundary_version={version}"
    run_id = None
    try:
        assert loader.main([str(delivery)]) == 0
        loaded = json.loads(capsys.readouterr().out)
        run_id = loaded["run_id"]
        assert (loaded["inserted"], loaded["skipped"]) == (1, 0)
        assert loader.main([str(delivery)]) == 0
        assert json.loads(capsys.readouterr().out)["status"] == "already_completed"

        with client:
            assert client.get(query).json()["official_items"] == []
            args = ["district_indicators", "--processing-run-id", run_id, "--accepted-by", "test"]
            assert publisher.main(args) == 0
            assert json.loads(capsys.readouterr().out) == {
                "applied": False,
                "table": "district_indicators",
                "rows": 1,
            }
            assert publisher.main([*args, "--apply"]) == 0
            applied = json.loads(capsys.readouterr().out)
            assert (applied["applied"], applied["rows"]) == (True, 1)
            body = client.get(query).json()
            other = client.get(f"{query}&variable=ndvi").json()
            reversed_period = client.get(f"{query}&period_from=2024-08-01&period_to=2024-07-01")
            districts = client.get(f"/v1/territories/districts?boundary_version={version}")

        assert body["status"] == "available"
        assert version in body["boundary_versions"]
        item = body["official_items"][0]
        assert (item["district_number"], item["value"], item["units"]) == (3, 31.25, "celsius")
        assert item["publication_status"] == "accepted"
        assert item["provenance"]["product_version"] == "test"
        assert other["status"] == "empty"
        assert reversed_period.status_code == 422
        assert [row["number"] for row in districts.json()["items"]] == [3]
    finally:
        with Session(engine) as session, session.begin():
            session.execute(
                delete(DistrictIndicator).where(DistrictIndicator.boundary_version == version)
            )
            session.execute(delete(District).where(District.boundary_version == version))
            if run_id is not None:
                session.execute(delete(ProcessingRun).where(ProcessingRun.id == run_id))


def test_demo_rectangles_never_appear_as_official(engine):
    del engine
    with TestClient(create_app()) as client:
        districts = client.get("/v1/territories/districts").json()
        series = client.get("/v1/series?boundary_version=demo-synthetic-v1").json()
    assert all(not v.startswith("demo-synthetic") for v in districts.get("boundary_versions", []))
    assert series.get("official_items", []) == []
