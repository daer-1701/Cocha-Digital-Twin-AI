"""Bounded July 2014–2025 Landsat 8 analysis; no API or database writes."""

import argparse
import csv
import hashlib
import json
import subprocess
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import httpx
import matplotlib
import numpy as np
import rasterio
from cocha_api.science.landsat import (
    PILOT_BOUNDS_WGS84,
    build_pilot_snapshot,
    get_json,
    read_scene,
    read_scene_grids,
    scene_manifest,
    stac_search_params,
    stac_search_url,
)
from rasterio.enums import Resampling
from rasterio.warp import reproject, transform
from scipy import stats

matplotlib.use("Agg")
from matplotlib import pyplot as plt  # noqa: E402

OUTPUT = Path("data/processed/pilot-trends")
RAW = Path("data/raw/landsat-pilot")
YEARS = list(range(2014, 2026))


def trend_statistics(years: list[int], values: list[float]) -> dict[str, Any]:
    """OLS with Bartlett HAC lag 1/2 sensitivity, t approximation; exploratory."""
    x, y = np.asarray(years, dtype=float), np.asarray(values, dtype=float)
    if (
        len(x) != len(y)
        or len(x) < 8
        or len(set(years)) != len(x)
        or not np.isfinite(x).all()
        or not np.isfinite(y).all()
    ):
        raise ValueError("Require at least eight distinct years and finite values")
    if not np.all(np.diff(x) == 1):
        raise ValueError("HAC requires consecutive annual observations")
    design = np.column_stack((np.ones(len(x)), x - x.mean()))
    beta = np.linalg.lstsq(design, y, rcond=None)[0]
    residual = y - design @ beta
    bread = np.linalg.inv(design.T @ design)
    fit = stats.linregress(x, y)
    constant = bool(np.ptp(y) == 0)
    standard_errors = [0.0 if constant else float(fit.stderr)]
    for lag in (1, 2):
        scores = design * residual[:, None]
        meat = scores.T @ scores
        for offset in range(1, lag + 1):
            cross = scores[offset:].T @ scores[:-offset]
            meat += (1 - offset / (lag + 1)) * (cross + cross.T)
        covariance = bread @ meat @ bread * len(x) / (len(x) - 2)
        standard_errors.append(float(np.sqrt(max(0, covariance[1, 1]))))
    # A conservative envelope across the predeclared IID/HAC sensitivities.
    se = max(standard_errors)
    slope = 0.0 if constant else float(beta[1])
    p = (
        float(2 * stats.t.sf(abs(slope / se), len(x) - 2))
        if se > 0
        else (1.0 if slope == 0 else 0.0)
    )
    half = float(stats.t.ppf(0.975, len(x) - 2) * se)
    rho = (
        float(np.corrcoef(residual[:-1], residual[1:])[0, 1])
        if np.std(residual[:-1]) > 1e-12 and np.std(residual[1:]) > 1e-12
        else None
    )
    loo = [float(stats.linregress(np.delete(x, i), np.delete(y, i)).slope) for i in range(len(x))]
    return {
        "n": len(x),
        "slope_per_year": slope,
        "intercept_at_mean_year": float(beta[0]),
        "mean_year": float(x.mean()),
        "ci95": [slope - half, slope + half],
        "p_value": p,
        "iid_p_value": 1.0 if constant else float(fit.pvalue),
        "standard_errors_iid_hac1_hac2": standard_errors,
        "residual_lag1_correlation": rho,
        "leave_one_year_out_slope_range": [min(loo), max(loo)],
        "method": "OLS; maximum SE of IID and Bartlett HAC(1,2); t(n-2) approximation",
        "nature": "exploratory_statistical_analysis",
    }


def holm_adjust(pvalues: list[float]) -> list[float]:
    order = sorted(range(len(pvalues)), key=pvalues.__getitem__)
    adjusted = [0.0] * len(pvalues)
    previous = 0.0
    for rank, index in enumerate(order):
        previous = max(previous, min(1.0, (len(pvalues) - rank) * pvalues[index]))
        adjusted[index] = previous
    return adjusted


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--offline", action="store_true")
    args = parser.parse_args()
    OUTPUT.mkdir(parents=True, exist_ok=True)
    manifest_path = OUTPUT / "manifest.json"
    if args.offline:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        entries = manifest["scenes"]
        if manifest["years"] != YEARS or manifest["bounds"] != list(PILOT_BOUNDS_WGS84):
            raise ValueError("Unexpected study manifest")
    else:
        entries = []
    scenes, grids, manifests = [], [], []
    selection_audit: list[dict[str, Any]] = []
    with httpx.Client(timeout=40, follow_redirects=True) as client:
        for index, year in enumerate(YEARS):
            if args.offline:
                entry = entries[index]
                folder = RAW / entry["id"]
                for name, expected in entry["files"].items():
                    if hashlib.sha256((folder / name).read_bytes()).hexdigest() != expected:
                        raise ValueError(f"Checksum mismatch: {entry['id']} / {name}")
                item = json.loads((folder / "stac.json").read_text(encoding="utf-8"))
            else:
                payload = get_json(client, stac_search_url(), stac_search_params(year))
                if any(link.get("rel") == "next" for link in payload.get("links", [])):
                    raise ValueError("Search truncated; refuse biased scene selection")
                candidates = [
                    item
                    for item in payload["features"]
                    if item["properties"].get("platform") == "landsat-8"
                    and item["properties"].get("landsat:correction") == "L2SP"
                ]
                candidates.sort(
                    key=lambda candidate: (
                        candidate["properties"].get("eo:cloud_cover", 100),
                        candidate["id"],
                    )
                )
                trials = []
                for candidate in candidates[:3]:
                    folder = RAW / candidate["id"]
                    folder.mkdir(parents=True, exist_ok=True)
                    metadata = folder / "stac.json"
                    if metadata.exists():
                        candidate = json.loads(metadata.read_text(encoding="utf-8"))
                    else:
                        metadata.write_text(
                            json.dumps(candidate, indent=2) + "\n", encoding="utf-8"
                        )
                    trial = read_scene(client, candidate, folder)
                    trials.append((trial.valid_fraction, candidate, folder))
                    selection_audit.append(
                        {"year": year, "id": trial.id, "valid_fraction": trial.valid_fraction}
                    )
                    if trial.valid_fraction >= 0.95:
                        break
                if not trials:
                    raise ValueError(f"No compatible July scene for {year}")
                _, item, folder = max(trials, key=lambda trial: trial[0])
            acquired = datetime.fromisoformat(item["properties"]["datetime"])
            if (acquired.year, acquired.month) != (year, 7):
                raise ValueError("Unexpected acquisition date")
            scene = read_scene(None if args.offline else client, item, folder)
            scenes.append(scene)
            grids.append(read_scene_grids(None, item, folder))
            manifests.append(scene_manifest(folder, item))
            print(f"{year}: {scene.id}, valid={scene.valid_fraction:.1%}", flush=True)
    manifest = {
        "years": YEARS,
        "month": 7,
        "platform": "landsat-8",
        "bounds": PILOT_BOUNDS_WGS84,
        "scenes": manifests,
        "selection": "Up to 3 candidates ordered by global cloud/ID; stop at 95% local QA; "
        "otherwise choose highest local valid fraction. Never select by LST/NDVI.",
        "selection_audit": (manifest["selection_audit"] if args.offline else selection_audit),
        "commit": subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip(),
        "script_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "lock_sha256": hashlib.sha256(Path("uv.lock").read_bytes()).hexdigest(),
    }
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    reference, crs = grids[0][2:]
    shape = grids[0][0].shape
    aligned = []
    for lst, ndvi, source_transform, source_crs in grids:
        pair = []
        for array in (lst, ndvi):
            target = np.full(shape, np.nan)
            reproject(
                array,
                target,
                src_transform=source_transform,
                src_crs=source_crs,
                dst_transform=reference,
                dst_crs=crs,
                src_nodata=np.nan,
                dst_nodata=np.nan,
                resampling=Resampling.nearest,
            )
            pair.append(target)
        aligned.append(pair)
    # Pixel centres within the requested rectangle, same grid and same valid pixels every year.
    rows, cols = np.indices(shape)
    xs, ys = rasterio.transform.xy(reference, rows.ravel(), cols.ravel())
    longitude, latitude = transform(crs, "EPSG:4326", xs, ys)
    west, south, east, north = PILOT_BOUNDS_WGS84
    inside = (
        (np.asarray(longitude) >= west)
        & (np.asarray(longitude) <= east)
        & (np.asarray(latitude) >= south)
        & (np.asarray(latitude) <= north)
    ).reshape(shape)
    cube = np.asarray(aligned)
    common = np.isfinite(cube).all(axis=(0, 1)) & inside
    coverage = float(common.sum() / inside.sum())
    if coverage < 0.8 or any(scene.valid_fraction < 0.8 for scene in scenes):
        raise ValueError(f"Insufficient spatial coverage: common={coverage:.1%}; no inference")
    series = []
    for scene, pair in zip(scenes, aligned, strict=True):
        series.append(
            {
                "scene_id": scene.id,
                "year": scene.acquired_at.year,
                "acquired_at": scene.acquired_at.isoformat(),
                "scene_valid_fraction": scene.valid_fraction,
                "lst_celsius": float(pair[0][common].mean()),
                "ndvi": float(pair[1][common].mean()),
            }
        )
    results = {
        key: trend_statistics(YEARS, [row[key] for row in series])
        for key in ("lst_celsius", "ndvi")
    }
    for result, adjusted in zip(
        results.values(),
        holm_adjust([result["p_value"] for result in results.values()]),
        strict=True,
    ):
        result["p_value_holm"] = adjusted
        result["significant_at_005_holm"] = adjusted < 0.05
    limitations = [
        "Análisis exploratorio de la ventana piloto, no distritos ni todo Cochabamba.",
        "Una adquisición despejada de julio por año; no es media mensual ni anual.",
        "LST es temperatura superficial al paso del satélite, no del aire.",
        "12 años: inferencia aproximada, sensible al muestreo meteorológico y fechas de paso.",
        "QA del piloto sin ST_QA ni aerosol: persisten incertidumbres de recuperación.",
        "HAC(1,2) y exclusión de un año son sensibilidad, no prueba de independencia.",
        "IC 95% marginales; decisiones de dos variables corregidas por Holm.",
        "No demuestra causalidad, tendencia climática regional ni validación con estaciones.",
    ]
    report = {
        "generated_at": datetime.now(UTC).isoformat(),
        "bounds": PILOT_BOUNDS_WGS84,
        "common_valid_fraction": coverage,
        "common_pixels": int(common.sum()),
        "series": series,
        "results": results,
        "limitations": limitations,
        "manifest_sha256": hashlib.sha256(manifest_path.read_bytes()).hexdigest(),
    }
    (OUTPUT / "analysis.json").write_text(
        json.dumps(report, indent=2, allow_nan=False) + "\n", encoding="utf-8"
    )
    with (OUTPUT / "series.csv").open("w", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(stream, fieldnames=list(series[0]))
        writer.writeheader()
        writer.writerows(series)
    snapshot = build_pilot_snapshot(scenes)
    snapshot.limitations = limitations + [
        "Mapa: medias por escena; análisis: soporte común. Consultar series.csv y analysis.json."
    ]
    (OUTPUT / "explorer.json").write_text(snapshot.model_dump_json(indent=2), encoding="utf-8")
    fig, axes = plt.subplots(2, 1, figsize=(10, 8), layout="constrained")
    for ax, (key, result), label in zip(axes, results.items(), ("LST (°C)", "NDVI"), strict=True):
        values = [row[key] for row in series]
        fitted = (np.asarray(YEARS) - result["mean_year"]) * result["slope_per_year"]
        fitted += result["intercept_at_mean_year"]
        ax.plot(YEARS, values, "o-", label="Adquisición de julio · soporte común")
        ax.plot(YEARS, fitted, "--", label="Ajuste lineal exploratorio")
        low, high = result["ci95"]
        ax.set_title(
            f"{label}: {result['slope_per_year']:+.4f}/año · "
            f"IC95% [{low:.4f}, {high:.4f}] · p Holm={result['p_value_holm']:.3f}"
        )
        ax.set_ylabel(label)
        ax.set_xticks(YEARS)
        ax.grid(alpha=0.2)
        ax.legend(fontsize=8)
    fig.suptitle(
        "Cochabamba · ventana piloto · Landsat 8 · julio 2014–2025\n"
        "Análisis exploratorio; no medias anuales ni tendencia climática regional"
    )
    fig.savefig(OUTPUT / "trends.png", dpi=180)
    plt.close(fig)
    print(json.dumps({"common_coverage": coverage, "results": results}, indent=2))


if __name__ == "__main__":
    main()
