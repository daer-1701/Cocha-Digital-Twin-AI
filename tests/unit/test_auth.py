"""Write-token gate. No real credentials."""

from unittest.mock import patch

import pytest
from cocha_api.core.auth import check_role, require_write_token
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


ROLE_TOKEN = "role-token-for-tests-only-0123456789"


def test_roles_are_disabled_until_configured_with_a_long_secret():
    short = Settings(api_reviewer_token=SecretStr("short"))
    with pytest.raises(HTTPException) as error:
        check_role("reviewer", f"Bearer {ROLE_TOKEN}", short)
    assert error.value.status_code == 503
    assert "short" not in str(error.value.detail)


def test_role_tokens_do_not_grant_each_other():
    settings = Settings(
        api_reviewer_token=SecretStr(ROLE_TOKEN),
        api_assistant_token=SecretStr(ROLE_TOKEN[::-1]),
    )
    check_role("reviewer", f"Bearer {ROLE_TOKEN}", settings)
    with pytest.raises(HTTPException) as wrong_role:
        check_role("assistant", f"Bearer {ROLE_TOKEN}", settings)
    assert wrong_role.value.status_code == 403
    with pytest.raises(HTTPException) as missing:
        check_role("reviewer", None, settings)
    assert missing.value.status_code == 401


def test_only_the_role_gated_assistant_route_mutates_and_cors_stays_get_only():
    from cocha_api.routes import assistant

    app = create_app()
    # FastAPI nests included routers, so app.routes does not list endpoints.
    mutating = [
        (path, method)
        for path, operations in app.openapi()["paths"].items()
        for method in operations
        if path.startswith("/v1") and method in {"post", "put", "patch", "delete"}
    ]
    assert mutating == [("/v1/assistant/ask", "post")]
    ask = next(
        route
        for route in assistant.router.routes
        if isinstance(route, APIRoute) and route.path.endswith("/assistant/ask")
    )
    dependencies = [dep.call.__name__ for dep in ask.dependant.dependencies]
    assert "require_assistant" in dependencies
    cors = [
        middleware
        for middleware in app.user_middleware
        if getattr(middleware, "cls", None) is CORSMiddleware
    ]
    assert cors
    assert cors[0].kwargs["allow_methods"] == ["GET"]
