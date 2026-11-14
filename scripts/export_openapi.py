"""Export API contract without opening a database connection."""

import json
from pathlib import Path

from cocha_api.main import create_app

target = Path(__file__).resolve().parents[1] / "packages/shared/openapi.json"
target.write_text(json.dumps(create_app().openapi(), indent=2) + "\n", encoding="utf-8")
