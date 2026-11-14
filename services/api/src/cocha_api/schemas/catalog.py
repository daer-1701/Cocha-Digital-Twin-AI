from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, HttpUrl


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    service: Literal["cocha-api"] = "cocha-api"


class ReadinessResponse(BaseModel):
    status: Literal["ready", "not_ready"]


class DatasetResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    source_url: HttpUrl
    product_version: str
    license: str
    created_at: datetime
