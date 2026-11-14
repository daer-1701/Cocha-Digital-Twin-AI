"""Server-side permission gates.

Each role uses one shared bearer secret held by trusted services (web server,
operator shell). This separates capabilities; it does not identify people,
store users, rotate keys or audit individuals. Do not present it as an
account or role-management system.
"""

import hmac
from collections.abc import Callable
from typing import Annotated, Literal

from fastapi import Depends, Header, HTTPException
from pydantic import SecretStr

from cocha_api.core.config import Settings, get_settings

Role = Literal["operator", "reviewer", "assistant"]

MIN_TOKEN_LENGTH = 24

ROLE_SETTING: dict[Role, str] = {
    "operator": "api_operator_token",
    "reviewer": "api_reviewer_token",
    "assistant": "api_assistant_token",
}
ROLE_ENV: dict[Role, str] = {
    "operator": "API_OPERATOR_TOKEN",
    "reviewer": "API_REVIEWER_TOKEN",
    "assistant": "API_ASSISTANT_TOKEN",
}


def _configured(secret: SecretStr | None) -> str | None:
    if secret is None:
        return None
    value = secret.get_secret_value().strip()
    return value if len(value) >= MIN_TOKEN_LENGTH else None


def _bearer(authorization: str | None) -> str:
    if authorization is None or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Bearer token required")
    return authorization.removeprefix("Bearer ").strip()


def _matches(provided: str, expected: str) -> bool:
    return hmac.compare_digest(provided.encode("utf-8"), expected.encode("utf-8"))


def role_configured(role: Role, settings: Settings | None = None) -> bool:
    current = settings or get_settings()
    return _configured(getattr(current, ROLE_SETTING[role])) is not None


def check_role(role: Role, authorization: str | None, settings: Settings | None = None) -> None:
    """Raise 503 when the role is not configured, 401 without bearer, 403 on mismatch."""

    current = settings or get_settings()
    expected = _configured(getattr(current, ROLE_SETTING[role]))
    if expected is None:
        raise HTTPException(
            status_code=503,
            detail=(
                f"Role '{role}' is disabled until {ROLE_ENV[role]} is configured "
                f"with at least {MIN_TOKEN_LENGTH} characters"
            ),
        )
    if not _matches(_bearer(authorization), expected):
        raise HTTPException(status_code=403, detail=f"Token does not grant role '{role}'")


def require_role(role: Role) -> Callable[..., None]:
    def dependency(authorization: Annotated[str | None, Header()] = None) -> None:
        check_role(role, authorization)

    dependency.__name__ = f"require_{role}"
    return dependency


def require_write_token(
    authorization: Annotated[str | None, Header()] = None,
) -> None:
    """Legacy single write secret. Prefer require_role for new routes."""

    settings = get_settings()
    expected: SecretStr | None = settings.api_write_token
    if expected is None or not expected.get_secret_value().strip():
        raise HTTPException(
            status_code=503,
            detail="Write operations are disabled until API_WRITE_TOKEN is configured",
        )
    if not _matches(_bearer(authorization), expected.get_secret_value()):
        raise HTTPException(status_code=403, detail="Invalid write token")


RequireWriteToken = Annotated[None, Depends(require_write_token)]
RequireOperator = Annotated[None, Depends(require_role("operator"))]
RequireAssistant = Annotated[None, Depends(require_role("assistant"))]
