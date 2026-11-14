"""Pure MONICA PM10 CSV QA helpers.

These data are particulate matter (PM10), not air temperature, and must never be
used to calibrate LST. Units and timezone remain undeclared until verified.
"""

from __future__ import annotations

import csv
import io
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Literal

QualityFlag = Literal[
    "valid", "zero", "negative", "invalid_value", "invalid_timestamp", "duplicate"
]

REQUIRED_COLUMNS = ("estacion", "pm10", "fecha_medicion")
TIMESTAMP_FORMATS = (
    "%Y-%m-%d %H:%M:%S.%f",
    "%Y-%m-%d %H:%M:%S",
    "%Y-%m-%d %H:%M",
)


@dataclass(frozen=True)
class MonicaRow:
    source_id: str
    pm10_raw: str
    observed_at_raw: str
    value: Decimal | None
    observed_at: datetime | None
    quality_flag: QualityFlag
    row_number: int


@dataclass(frozen=True)
class MonicaParseSummary:
    rows: tuple[MonicaRow, ...]
    duplicate_keys: tuple[tuple[str, str], ...]
    counts: dict[str, int]


def parse_timestamp(raw: str) -> datetime | None:
    text = raw.strip()
    if not text:
        return None
    for fmt in TIMESTAMP_FORMATS:
        try:
            return datetime.strptime(text, fmt)
        except ValueError:
            continue
    return None


def classify_pm10(raw: str) -> tuple[Decimal | None, QualityFlag]:
    text = raw.strip()
    if not text:
        return None, "invalid_value"
    try:
        value = Decimal(text)
    except InvalidOperation:
        return None, "invalid_value"
    if not value.is_finite():
        return None, "invalid_value"
    if value < 0:
        return value, "negative"
    if value == 0:
        return value, "zero"
    return value, "valid"


def parse_monica_csv(
    content: str | Iterable[str], *, source_label: str = "fixture"
) -> MonicaParseSummary:
    """Parse MONICA CSV text. Fixtures used in tests must be labeled as synthetic."""
    if isinstance(content, str):
        reader = csv.DictReader(io.StringIO(content))
    else:
        reader = csv.DictReader(content)

    if reader.fieldnames is None:
        raise ValueError(f"{source_label}: CSV has no header")
    missing = [column for column in REQUIRED_COLUMNS if column not in reader.fieldnames]
    if missing:
        raise ValueError(f"{source_label}: missing columns {missing}")

    rows: list[MonicaRow] = []
    seen: dict[tuple[str, str], int] = {}
    duplicate_keys: list[tuple[str, str]] = []

    for index, record in enumerate(reader, start=2):
        source_id = (record.get("estacion") or "").strip().lower()
        pm10_raw = record.get("pm10") or ""
        observed_raw = record.get("fecha_medicion") or ""
        observed_at = parse_timestamp(observed_raw)
        if observed_at is None:
            value, quality = None, "invalid_timestamp"
        else:
            value, quality = classify_pm10(pm10_raw)

        key = (source_id, observed_raw.strip())
        if key[0] and key[1] and key in seen:
            quality = "duplicate"
            duplicate_keys.append(key)
        elif key[0] and key[1]:
            seen[key] = index

        rows.append(
            MonicaRow(
                source_id=source_id or "unknown",
                pm10_raw=pm10_raw,
                observed_at_raw=observed_raw.strip(),
                value=value,
                observed_at=observed_at,
                quality_flag=quality,
                row_number=index,
            )
        )

    counts: dict[str, int] = {}
    for row in rows:
        counts[row.quality_flag] = counts.get(row.quality_flag, 0) + 1

    return MonicaParseSummary(
        rows=tuple(rows),
        duplicate_keys=tuple(duplicate_keys),
        counts=counts,
    )


def analysis_eligible(flag: QualityFlag) -> bool:
    """Physical analysis remains disabled while metadata is pending; helpers only."""
    return flag == "valid"
