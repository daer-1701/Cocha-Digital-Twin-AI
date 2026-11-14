"""Runtime dependency guard for the slim API image."""

from __future__ import annotations

import importlib.util
import sys

FORBIDDEN = ("numpy", "rasterio")


def main() -> int:
    missing_ok = True
    for name in FORBIDDEN:
        if importlib.util.find_spec(name) is not None:
            print(f"unexpected dependency present: {name}", file=sys.stderr)
            missing_ok = False
    if not missing_ok:
        return 1
    print("API runtime excludes scientific dependencies")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
