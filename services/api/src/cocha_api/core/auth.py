"""Write-path guards. Public API remains read-only until auth is enabled."""

from typing import Annotated

from fastapi import Depends, Header, HTTPException
from pydantic import SecretStr

from cocha_api.core.config import get_settings


def require_write_token(
    authorization: Annotated[str | None, Header()] = None,
) -> None:
    """Reject mutating routes until a server-side write token is configured.

    This is a minimal shared-secret gate, not a full role model. Do not treat
    its presence as production-grade authentication.
    """

    settings = get_settings()
    expected: SecretStr | None = settings.api_write_token
    if expected is None or not expected.get_secret_value().strip():
        raise HTTPException(
            status_code=503,
            detail="Write operations are disabled until API_WRITE_TOKEN is configured",
        )
    if authorization is None or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Bearer token required")
    provided = authorization.removeprefix("Bearer ").strip()
    if provided != expected.get_secret_value():
        raise HTTPException(status_code=403, detail="Invalid write token")


RequireWriteToken = Annotated[None, Depends(require_write_token)]
