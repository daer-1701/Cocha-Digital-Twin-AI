"""Reproduce MF05–MF07 with synthetic data, without network or database access."""

import json
from dataclasses import asdict
from datetime import date
from pathlib import Path
from statistics import correlation
from tempfile import TemporaryDirectory

from audit_monica import audit_file, reconciliation_differences
from cocha_api.science.indicators import PairedPixelIntersection, summarize_paired_intersections
from cocha_api.science.trends import (
    SeasonalObservation,
    seasonal_anomalies,
    seasonal_descriptive_slope,
)


def main() -> None:
    observations = []
    pairs = []
    for year, lst, ndvi in [(2021, 20, 0.6), (2022, 22, 0.4), (2024, 26, 0.2)]:
        thermal, vegetation = summarize_paired_intersections(
            [PairedPixelIntersection(8, lst, ndvi), PairedPixelIntersection(2, 99, None)],
            district_area_m2=10,
        )
        observations.append(
            SeasonalObservation(date(year, 7, 10), thermal.mean, thermal.valid_fraction)
        )
        pairs.append((thermal.mean, vegetation.mean))

    slope = seasonal_descriptive_slope(observations, month=7, min_valid_fraction=0.75, min_n=3)
    anomalies = seasonal_anomalies(
        observations, month=7, reference_years={2021, 2022}, min_valid_fraction=0.75, min_n=2
    )

    with TemporaryDirectory() as directory:
        path = Path(directory) / "synthetic.csv"
        path.write_text(
            "estacion,pm10,fecha_medicion\n"
            "demo,15,2024-07-01 10:00\n"
            "demo,15,2024-07-01 10:00\n"
            "demo,0,2024-07-01 11:00\n"
            "demo,20,invalid\n",
            encoding="utf-8",
        )
        audit = audit_file(path)
        # Fixture representing an import report; the demo performs no import.
        recorded = {
            "sha256": audit["sha256"],
            "rows": 4,
            "quality_counts": {"valid": 1, "duplicate": 1, "zero": 1, "invalid_timestamp": 1},
            "upserted": 2,
            "skipped_existing": 0,
            "skipped_duplicates": 1,
            "skipped_invalid_time": 1,
        }
        differences = reconciliation_differences(audit, recorded)

    complete = [(x, y) for x, y in pairs if x is not None and y is not None]
    pearson_r = correlation(*zip(*complete, strict=True))
    print(
        json.dumps(
            {
                "nature": "synthetic_demo",
                "mf05": {
                    "slope": asdict(slope),
                    "reference_years": [2021, 2022],
                    "anomalies_celsius": dict(
                        zip(
                            (point.acquired_on.isoformat() for point in observations),
                            anomalies,
                            strict=True,
                        )
                    ),
                },
                "mf06": {"audit": audit, "report": "synthetic_fixture", "differences": differences},
                "mf07": {"pearson_r": pearson_r, "n_pairs": len(complete)},
            },
            indent=2,
            allow_nan=False,
        )
    )


if __name__ == "__main__":
    main()
