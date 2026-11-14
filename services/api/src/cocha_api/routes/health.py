import logging

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from cocha_api.db.session import get_engine
from cocha_api.schemas.catalog import HealthResponse, ReadinessResponse

router = APIRouter(prefix="/health", tags=["health"])
logger = logging.getLogger(__name__)


@router.get("/live", response_model=HealthResponse)
def live() -> HealthResponse:
    return HealthResponse()


@router.get(
    "/ready",
    response_model=ReadinessResponse,
    responses={503: {"model": ReadinessResponse}},
)
def ready():
    try:
        with get_engine().connect() as connection:
            connection.execute(text("SELECT PostGIS_Version()"))
            connection.execute(text("SELECT version_num FROM alembic_version")).scalar_one()
    except SQLAlchemyError:
        logger.warning("Database readiness check failed")
        return JSONResponse(status_code=503, content={"status": "not_ready"})
    return ReadinessResponse(status="ready")
