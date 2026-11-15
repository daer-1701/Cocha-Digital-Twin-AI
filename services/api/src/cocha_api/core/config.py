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
    monica_review_enabled: bool = False
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
    # Second switch besides the key. Keep false until the team authorizes spending.
    gemini_calls_enabled: bool = False
    gemini_api_base_url: str = "https://generativelanguage.googleapis.com/v1beta"
    gemini_timeout_seconds: float = Field(default=20.0, gt=0, le=60)
    gemini_max_question_chars: int = Field(default=800, ge=50, le=4000)
    gemini_max_context_chars: int = Field(default=12000, ge=1000, le=60000)
    gemini_max_output_tokens: int = Field(default=2048, ge=50, le=4096)
    # Upper bound per request; thinking tokens are billed as output.
    gemini_reserve_usd_per_request: float = Field(default=0.02, gt=0, le=1)
    gemini_rate_limit_requests: int = Field(default=10, ge=1, le=1000)
    gemini_rate_limit_window_seconds: float = Field(default=3600.0, gt=0, le=86400)
    gemini_cache_entries: int = Field(default=128, ge=0, le=10000)
    gamc_wms_api_key: SecretStr | None = None
    wms_rate_limit_requests: int = Field(default=60, ge=1, le=1000)
    wms_rate_limit_window_seconds: float = Field(default=60.0, gt=0, le=3600)
    gamc_wms_endpoint: str = "https://serviciosgamc.cochabamba.bo/api/gs/wms"
    gamc_wms_timeout_seconds: float = Field(default=20.0, gt=0, le=60)
    # Shared secret for future write routes. Empty keeps writes disabled.
    api_write_token: SecretStr | None = None
    # One shared secret per capability, held by trusted servers. Not user accounts.
    api_operator_token: SecretStr | None = None
    api_reviewer_token: SecretStr | None = None
    api_assistant_token: SecretStr | None = None
    # Runs whose heartbeat is older than this are marked interrupted by recovery.
    job_stale_after_seconds: int = Field(default=3600, ge=60, le=7 * 86400)
    job_max_attempts: int = Field(default=3, ge=1, le=10)
    database_host: str | None = None
    postgres_db: str = "cocha"
    postgres_user: str = "cocha"
    postgres_password: SecretStr = SecretStr("local-only")


@lru_cache
def get_settings() -> Settings:
    return Settings()
