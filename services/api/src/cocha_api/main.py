import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError

from cocha_api.core.config import get_settings
from cocha_api.core.logging import configure_logging
from cocha_api.routes import datasets, explorer, health


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging(get_settings().log_level)
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Cocha Digital Twin AI",
        version="0.1.0",
        description="Read-only evidence. Run Landsat ingestion to publish a snapshot.",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=False,
        allow_methods=["GET"],
        allow_headers=["Accept"],
    )

    @app.exception_handler(SQLAlchemyError)
    async def database_error(request: Request, exc: SQLAlchemyError):
        logging.getLogger(__name__).error("Database operation failed")
        return JSONResponse(status_code=503, content={"detail": "Data service unavailable"})

    app.include_router(health.router)
    app.include_router(datasets.router)
    app.include_router(explorer.router)
    return app


app = create_app()
