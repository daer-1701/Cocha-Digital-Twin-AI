"""Synthetic MONICA CSV fixtures for QA unit tests — not real observations."""

from cocha_api.science.monica import analysis_eligible, parse_monica_csv, station_import_profile

# Identified synthetic fixture: tiny CSV for CI only.
SYNTHETIC_CSV = """estacion,pm10,fecha_medicion
kanata,12.5,2022-07-06 17:30:00.000
kanata,0,2022-07-06 18:00:00.000
kanata,-3.2,2022-07-06 18:30:00.000
kanata,not-a-number,2022-07-06 19:00:00.000
kanata,8.1,not-a-date
kanata,9.0,2022-07-06 17:30:00.000
semapa,4.0,2022-08-24 03:30:00.000
"""


def test_parse_flags_negatives_zeros_duplicates_and_invalid_dates():
    summary = parse_monica_csv(SYNTHETIC_CSV, source_label="synthetic-fixture")
    flags = [row.quality_flag for row in summary.rows]
    assert "valid" in flags
    assert "zero" in flags
    assert "negative" in flags
    assert "invalid_value" in flags
    assert "invalid_timestamp" in flags
    assert "duplicate" in flags
    assert summary.counts["negative"] == 1
    assert summary.counts["zero"] == 1
    assert summary.counts["duplicate"] == 1
    assert summary.duplicate_keys == (("kanata", "2022-07-06 17:30:00.000"),)


def test_negative_and_zero_values_are_preserved_not_truncated():
    summary = parse_monica_csv(SYNTHETIC_CSV, source_label="synthetic-fixture")
    by_flag = {row.quality_flag: row for row in summary.rows}
    assert by_flag["negative"].value is not None and by_flag["negative"].value < 0
    assert by_flag["zero"].value == 0
    assert analysis_eligible("valid") is True
    assert analysis_eligible("negative") is False
    assert analysis_eligible("zero") is False


def test_import_profile_declares_unit_timezone_and_catalog_coordinates():
    profile = station_import_profile("kanata")
    assert profile.unit_declared == "ug/m3"
    assert profile.name == "Parque Kanata"
    assert profile.analysis_enabled is False
    assert profile.timezone_declared == "America/La_Paz"
    assert profile.latitude == -17.41252
    assert profile.longitude == -66.15897
    assert profile.elevation_m == 2564.0
    pending = " ".join(profile.metadata_pending).lower()
    assert "timezone" not in pending
    assert "coordinates" not in pending
    unknown = station_import_profile("not-a-station")
    assert unknown.name == "not-a-station"
    assert unknown.unit_declared == "ug/m3"
    assert unknown.latitude is None
    assert unknown.longitude is None
    assert unknown.timezone_declared is None


def test_missing_columns_raise():
    bad = "estacion,fecha_medicion\nkanata,2022-07-06 17:30:00.000\n"
    try:
        parse_monica_csv(bad, source_label="synthetic-fixture")
        raised = False
    except ValueError as exc:
        raised = True
        assert "missing columns" in str(exc)
    assert raised
