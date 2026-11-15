// Package verified local scientific artifacts for the web, without new HTTP APIs.
import { createHash } from "node:crypto";
import { readFileSync, mkdirSync, copyFileSync } from "node:fs";

const source = new URL("../data/processed/pilot-trends/", import.meta.url);
const destination = new URL("../apps/web/public/pilot-analysis/", import.meta.url);
const read = (name) => readFileSync(new URL(name, source));
const report = JSON.parse(read("analysis.json"));
const snapshot = JSON.parse(read("explorer.json"));
const manifestBytes = read("manifest.json");
const manifest = JSON.parse(manifestBytes);
if (createHash("sha256").update(manifestBytes).digest("hex") !== report.manifest_sha256)
  throw new Error("Analysis manifest checksum mismatch");
if (snapshot.scenes.length !== report.series.length || report.series.length !== 12)
  throw new Error("Analysis and explorer scene counts differ");
for (const row of report.series) {
  const scene = snapshot.scenes.find((s) => s.id === row.scene_id);
  if (!scene || Date.parse(scene.acquired_at) !== Date.parse(row.acquired_at) ||
      !manifest.scenes.some((s) => s.id === scene.id))
    throw new Error("Scene provenance mismatch");
}
const csv = read("series.csv").toString("utf8").trim().split(/\r?\n/);
if (csv.length !== report.series.length + 1) throw new Error("CSV row count mismatch");
const headers = csv[0].split(",");
for (let i = 0; i < report.series.length; i++) {
  const cells = csv[i + 1].split(",");
  for (const key of ["lst_celsius", "ndvi", "scene_valid_fraction", "year"])
    if (Number(cells[headers.indexOf(key)]) !== report.series[i][key])
      throw new Error(`CSV differs from analysis: ${key}`);
}
mkdirSync(destination, { recursive: true });
const names = ["analysis.json", "explorer.json", "manifest.json", "series.csv", "trends.png"];
const checksums = {};
for (const name of names) {
  copyFileSync(new URL(name, source), new URL(name, destination));
  checksums[name] = createHash("sha256").update(read(name)).digest("hex");
}
const { writeFileSync } = await import("node:fs");
writeFileSync(new URL("checksums.json", destination), JSON.stringify(checksums, null, 2));
console.log("Web: 12 acquisitions, CSV and analysis verified and packaged.");
