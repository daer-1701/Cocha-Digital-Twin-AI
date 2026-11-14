"""Delivery contract for model artifacts. No model is accepted or loaded today.

A manifest travels next to the artifact. verify_artifact checks location and
checksum before anything reads it. Pickle-like formats are refused: they run
code on load. Prediction stays outside HTTP requests until an accepted model
and a bounded execution path exist.
"""

from __future__ import annotations

import hashlib
import math
from datetime import date
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

SAFE_ARTIFACT_SUFFIXES = frozenset({".json", ".onnx", ".csv"})


class InputBound(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=64)
    units: str = Field(min_length=1, max_length=64)
    minimum: float
    maximum: float

    @model_validator(mode="after")
    def ordered(self) -> InputBound:
        if not (math.isfinite(self.minimum) and math.isfinite(self.maximum)):
            raise ValueError("bounds must be finite")
        if self.minimum > self.maximum:
            raise ValueError("minimum must not exceed maximum")
        return self


class DomainOfUse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    inputs: list[InputBound] = Field(min_length=1)
    bbox_wgs84: tuple[float, float, float, float]
    period_start: date
    period_end: date
    boundary_version: str | None = None
    notes: str = Field(min_length=1)


class Uncertainty(BaseModel):
    model_config = ConfigDict(extra="forbid")

    method: str = Field(min_length=1)
    interval_level: float = Field(gt=0, lt=1)
    description: str = Field(min_length=1)


class ModelManifest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    objective: str = Field(min_length=1, max_length=200)
    target_variable: str = Field(min_length=1)
    target_units: str = Field(min_length=1)
    model_version: str = Field(min_length=1, max_length=64)
    artifact_file: str = Field(min_length=1)
    artifact_sha256: str = Field(pattern=r"^[0-9a-f]{64}$")
    validation_partition: str = Field(min_length=1)
    metrics: dict[str, float] = Field(min_length=1)
    baseline_metrics: dict[str, float] = Field(min_length=1)
    uncertainty: Uncertainty
    domain_of_use: DomainOfUse
    nature: Literal["estimate"] = "estimate"
    reviewed_by: str | None = None


def verify_artifact(manifest: ModelManifest, root: Path) -> Path:
    """Return the artifact path only if it stays under root and matches the checksum."""

    base = root.resolve()
    path = (base / manifest.artifact_file).resolve()
    if not path.is_relative_to(base):
        raise ValueError("artifact path escapes the registry root")
    if path.suffix.lower() not in SAFE_ARTIFACT_SUFFIXES:
        raise ValueError(f"artifact format {path.suffix} is not allowed")
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    if digest.hexdigest() != manifest.artifact_sha256:
        raise ValueError("artifact checksum does not match the manifest")
    return path


def out_of_domain(manifest: ModelManifest, inputs: dict[str, float]) -> list[str]:
    """Names of missing, non-finite or out-of-range inputs. Empty means in domain."""

    problems: list[str] = []
    for bound in manifest.domain_of_use.inputs:
        value = inputs.get(bound.name)
        if value is None or not math.isfinite(value):
            problems.append(f"{bound.name}: missing")
        elif not bound.minimum <= value <= bound.maximum:
            problems.append(f"{bound.name}: outside [{bound.minimum}, {bound.maximum}]")
    unexpected = sorted(set(inputs) - {bound.name for bound in manifest.domain_of_use.inputs})
    problems.extend(f"{name}: not a model input" for name in unexpected)
    return problems
