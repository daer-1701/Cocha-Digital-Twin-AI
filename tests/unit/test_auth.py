"""Write-token gate. No real credentials."""

from unittest.mock import patch

import pytest
from cocha_api.core.auth import require_write_token
from cocha_api.core.config import Settings
from cocha_api.main import create_app
from fastapi import HTTPException
from fastapi.routing import APIRoute
from pydantic import SecretStr
from starlette.middleware.cors import CORSMiddleware


def test_write_token_disabled_without_configuration():
    settings = Settings(api_write_token=None)
    with patch("cocha_api.core.auth.get_settings", return_value=settings):
        with pytest.raises(HTTPException) as error:
            require_write_token(authorization=None)
    assert error.value.status_code == 503


def test_write_token_rejects_invalid_bearer():
    settings = Settings(api_write_token=SecretStr("local-test-token"))
    with patch("cocha_api.core.auth.get_settings", return_value=settings):
        with pytest.raises(HTTPException) as missing:
            require_write_token(authorization=None)
        assert missing.value.status_code == 401
        with pytest.raises(HTTPException) as wrong:
            require_write_token(authorization="Bearer other")
        assert wrong.value.status_code == 403
        require_write_token(authorization="Bearer local-test-token")


def test_public_api_stays_get_only_so_the_write_token_is_not_mounted():
    app = create_app()
    mutating = [
        route.path
        for route in app.routes
        if isinstance(route, APIRoute)
        and route.path.startswith("/v1")
        and route.methods & {"POST", "PUT", "PATCH", "DELETE"}
    ]
    assert mutating == []
    cors = [
        middleware
        for middleware in app.user_middleware
        if getattr(middleware, "cls", None) is CORSMiddleware
    ]
    assert cors
    assert cors[0].kwargs["allow_methods"] == ["GET"]
