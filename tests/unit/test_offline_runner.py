"""Offline QA runner. No Celery, Redis, or paid calls."""

import importlib.util
import json
from pathlib import Path

import pytest

RUNNER_PATH = Path(__file__).resolve().parents[2] / "services" / "workers" / "offline_runner.py"

SYNTHETIC_CSV = """estacion,pm10,fecha_medicion
kanata,12.5,2022-07-06 17:30:00.000
kanata,-1,2022-07-06 18:00:00.000
"""


def _runner():
    spec = importlib.util.spec_from_file_location("offline_runner", RUNNER_PATH)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class _Session:
    def __init__(self) -> None:
        self.added: list[object] = []
        self.commits = 0

    def add(self, obj: object) -> None:
        self.added.append(obj)

    def flush(self) -> None:
        return None

    def commit(self) -> None:
        self.commits += 1


def test_qa_summary_runs_without_a_database(tmp_path: Path):
    runner = _runner()
    path = tmp_path / "sample.csv"
    path.write_text(SYNTHETIC_CSV, encoding="utf-8")
    payload = runner.run_offline([path], None)
    assert payload["persisted"] is False
    assert payload["run_id"] is None
    assert payload["status"] == "completed_local_only"
    summary = payload["qa"]["files"][0]
    assert summary["analysis_enabled"] is False
    assert summary["unit_declared"] == "ug/m3"
    assert summary["pm10_is_not_air_temperature"] is True
    assert summary["quality_counts"]["negative"] == 1


def test_database_session_records_completed_and_failed_runs(tmp_path: Path):
    runner = _runner()
    path = tmp_path / "sample.csv"
    path.write_text(SYNTHETIC_CSV, encoding="utf-8")
    session = _Session()
    payload = runner.run_offline([path], session)
    assert payload["persisted"] is True
    assert payload["status"] == "completed"
    assert session.commits == 1
    stored = session.added[0]
    assert stored.kind == "offline_monica_qa"
    assert stored.status == "completed"
    assert stored.parameters["analysis_enabled"] is False

    bad = tmp_path / "bad.csv"
    bad.write_text("estacion,fecha_medicion\nkanata,2022-07-06 17:30\n", encoding="utf-8")
    failed = _Session()
    with pytest.raises(ValueError):
        runner.run_offline([bad], failed)
    assert failed.added[0].status == "failed"
    assert failed.commits == 1


def test_cli_no_db_does_not_open_the_engine(
    monkeypatch, tmp_path: Path, capsys: pytest.CaptureFixture[str]
):
    runner = _runner()
    path = tmp_path / "sample.csv"
    path.write_text(SYNTHETIC_CSV, encoding="utf-8")

    def forbid_engine():
        raise AssertionError("database should stay closed")

    monkeypatch.setattr(runner, "get_engine", forbid_engine)
    code = runner.main(["--no-db", "--input-dir", str(tmp_path), "--files", "sample.csv"])
    assert code == 0
    payload = json.loads(capsys.readouterr().out)
    assert payload["persisted"] is False
    missing = runner.main(["--no-db", "--input-dir", str(tmp_path), "--files", "absent.csv"])
    assert missing == 2
