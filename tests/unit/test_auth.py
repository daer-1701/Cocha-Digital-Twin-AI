"""Write-token gate. No real credentials."""

from unittest.mock import patch

import pytest
from cocha_api.core.auth import require_write_token
from cocha_api.core.config import Settings
from fastapi import HTTPException
from pydantic import SecretStr


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
