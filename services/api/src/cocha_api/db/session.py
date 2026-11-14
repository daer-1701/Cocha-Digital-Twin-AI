from functools import lru_cache

from sqlalchemy import URL, create_engine
from sqlalchemy.orm import Session

from cocha_api.core.config import get_settings


@lru_cache
def get_engine():
    settings = get_settings()
    url = (
        URL.create(
            "postgresql+psycopg",
            username=settings.postgres_user,
            password=settings.postgres_password.get_secret_value(),
            host=settings.database_host,
            database=settings.postgres_db,
        )
        if settings.database_host
        else str(settings.database_url)
    )
    return create_engine(
        url,
        pool_pre_ping=True,
        connect_args={"connect_timeout": 3},
        hide_parameters=True,
    )


def get_session():
    with Session(get_engine()) as session:
        yield session
