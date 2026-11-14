"""Artifact publication and model delivery contract. Synthetic files only."""

import hashlib
from datetime import date

import pytest
from cocha_api.jobs import idempotency_key, publish_file
from cocha_api.science.model_registry import ModelManifest, out_of_domain, verify_artifact


def test_publish_is_idempotent_and_refuses_a_different_existing_artifact(tmp_path):
    destination = tmp_path / "result.json"
    first = tmp_path / "result.json.tmp"
    first.write_text('{"v": 1}', encoding="utf-8")
    checksum = publish_file(first, destination)
    assert checksum == hashlib.sha256(b'{"v": 1}').hexdigest()
    assert not first.exists()

    same = tmp_path / "same.tmp"
    same.write_text('{"v": 1}', encoding="utf-8")
    assert publish_file(same, destination) == checksum

    other = tmp_path / "other.tmp"
    other.write_text('{"v": 2}', encoding="utf-8")
    with pytest.raises(FileExistsError):
        publish_file(other, destination)
    assert destination.read_text(encoding="utf-8") == '{"v": 1}'


def test_idempotency_key_depends_on_every_part():
    assert idempotency_key("k", "a", "b") == idempotency_key("k", "a", "b")
    assert idempotency_key("k", "a", "b") != idempotency_key("k", "ab")


def _manifest(artifact: str, checksum: str) -> ModelManifest:
    return ModelManifest(
        objective="synthetic test contract",
        target_variable="lst_celsius",
        target_units="celsius",
        model_version="0.0.0-test",
        artifact_file=artifact,
        artifact_sha256=checksum,
        validation_partition="spatial blocks (synthetic)",
        metrics={"rmse": 1.0},
        baseline_metrics={"rmse": 2.0},
        uncertainty={"method": "test", "interval_level": 0.9, "description": "test only"},
        domain_of_use={
            "inputs": [{"name": "ndvi", "units": "dimensionless", "minimum": -1, "maximum": 1}],
            "bbox_wgs84": (-66.3, -17.5, -66.0, -17.3),
            "period_start": date(2015, 1, 1),
            "period_end": date(2025, 12, 31),
            "notes": "synthetic",
        },
    )


def test_registry_refuses_escaping_paths_unsafe_formats_and_bad_checksums(tmp_path):
    artifact = tmp_path / "model.json"
    artifact.write_text("{}", encoding="utf-8")
    good = hashlib.sha256(b"{}").hexdigest()
    assert verify_artifact(_manifest("model.json", good), tmp_path) == artifact.resolve()
    with pytest.raises(ValueError, match="checksum"):
        verify_artifact(_manifest("model.json", "0" * 64), tmp_path)
    with pytest.raises(ValueError, match="escapes"):
        verify_artifact(_manifest("../model.json", good), tmp_path)
    (tmp_path / "model.pkl").write_bytes(b"x")
    with pytest.raises(ValueError, match="not allowed"):
        verify_artifact(_manifest("model.pkl", good), tmp_path)


def test_out_of_domain_inputs_are_reported():
    manifest = _manifest("model.json", "0" * 64)
    assert out_of_domain(manifest, {"ndvi": 0.4}) == []
    assert out_of_domain(manifest, {"ndvi": 1.5}) == ["ndvi: outside [-1.0, 1.0]"]
    assert out_of_domain(manifest, {"ndvi": float("nan"), "x": 1.0}) == [
        "ndvi: missing",
        "x: not a model input",
    ]
