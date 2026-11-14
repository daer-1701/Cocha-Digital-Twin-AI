"""Portable evidence snapshot contract, shared by ingestion and HTTP."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class EvidenceModel(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False, extra="forbid")


class Cell(EvidenceModel):
    bounds: tuple[float, float, float, float]
    lst: float | None
    ndvi: float | None


class Scene(EvidenceModel):
    id: str
    acquired_at: datetime
    platform: str
    source_url: str
    valid_fraction: float = Field(ge=0, le=1)
    valid_pixels: int = Field(ge=0)
    total_pixels: int = Field(gt=0)
    lst_mean: float | None
    ndvi_mean: float | None
    cells: list[Cell]


class Snapshot(EvidenceModel):
    schema_version: Literal[1] = 1
    generated_at: datetime
    area_name: str
    bounds: tuple[float, float, float, float]
    collection: Literal["landsat-c2-l2"] = "landsat-c2-l2"
    product_version: str
    license: str
    method: str
    limitations: list[str]
    scenes: list[Scene]


class ExplorerResponse(EvidenceModel):
    status: Literal["available", "empty"]
    evidence: Snapshot | None = None
