from functools import lru_cache

from pydantic import PostgresDsn, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: PostgresDsn = PostgresDsn(
        "postgresql+psycopg://cocha:local-only@localhost:5432/cocha"
    )
    cors_origins: list[str] = ["http://localhost:3000"]
    log_level: str = "INFO"
    gemini_api_key: SecretStr | None = None
    database_host: str | None = None
    postgres_db: str = "cocha"
    postgres_user: str = "cocha"
    postgres_password: SecretStr = SecretStr("local-only")


@lru_cache
def get_settings() -> Settings:
    return Settings()
