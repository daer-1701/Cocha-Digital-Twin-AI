from functools import lru_cache
from pathlib import Path

from pydantic import Field, PostgresDsn, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: PostgresDsn = PostgresDsn(
        "postgresql+psycopg://cocha:local-only@localhost:5432/cocha"
    )
    cors_origins: list[str] = ["http://localhost:3000"]
    log_level: str = "INFO"
    evidence_path: Path = Path("data/processed/explorer.json")
    gemini_api_key: SecretStr | None = None
    # Verified 2026-11-14 against https://ai.google.dev/gemini-api/docs/pricing
    # Paid tier for gemini-3.6-flash through 2026-12-31; rates rise on 2027-01-01.
    gemini_model: str = "gemini-3.6-flash"
    gemini_budget_usd: float = Field(default=4.0, gt=0, le=1000)
    gemini_input_usd_per_million_tokens: float | None = Field(default=0.75, ge=0)
    gemini_output_usd_per_million_tokens: float | None = Field(default=3.75, ge=0)
    gemini_prices_verified_on: str | None = "2026-11-14"
    gemini_prices_source_url: str | None = "https://ai.google.dev/gemini-api/docs/pricing"
    gemini_ledger_path: Path = Path("data/local/gemini-ledger.json")
    gamc_wms_api_key: SecretStr | None = None
    wms_rate_limit_requests: int = Field(default=60, ge=1, le=1000)
    wms_rate_limit_window_seconds: float = Field(default=60.0, gt=0, le=3600)
    gamc_wms_endpoint: str = "https://serviciosgamc.cochabamba.bo/api/gs/wms"
    gamc_wms_timeout_seconds: float = Field(default=20.0, gt=0, le=60)
    # Shared secret for future write routes. Empty keeps writes disabled.
    api_write_token: SecretStr | None = None
    database_host: str | None = None
    postgres_db: str = "cocha"
    postgres_user: str = "cocha"
    postgres_password: SecretStr = SecretStr("local-only")


@lru_cache
def get_settings() -> Settings:
    return Settings()
