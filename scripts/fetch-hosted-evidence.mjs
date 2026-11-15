// Fetch the published scientific package during a hosted build, never in a request.
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";

const base = process.env.EVIDENCE_PACKAGE_URL;
const expected = process.env.EVIDENCE_CHECKSUMS_SHA256;
if (!base || !expected || !/^[a-f0-9]{64}$/.test(expected)) {
  throw new Error("EVIDENCE_PACKAGE_URL and EVIDENCE_CHECKSUMS_SHA256 are required.");
}
const url = new URL(base.endsWith("/") ? base : `${base}/`);
if (url.protocol !== "https:" || url.username || url.password) {
  throw new Error("The evidence package requires an HTTPS URL without credentials.");
}
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
async function download(name) {
  const response = await fetch(new URL(name, url), { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`Evidence download failed: ${name} (${response.status})`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 10 * 1024 * 1024) throw new Error(`Evidence file too large: ${name}`);
  return bytes;
}
const checksumBytes = await download("checksums.json");
if (digest(checksumBytes) !== expected) throw new Error("Evidence checksum manifest changed.");
const checksums = JSON.parse(checksumBytes.toString("utf8"));
const names = ["analysis.json", "explorer.json", "manifest.json", "series.csv", "trends.png"];
const files = await Promise.all(names.map(async name => {
  const bytes = await download(name);
  if (digest(bytes) !== checksums[name]) throw new Error(`Evidence checksum mismatch: ${name}`);
  return [name, bytes];
}));
const destination = new URL("../apps/web/public/pilot-analysis/", import.meta.url);
await mkdir(destination, { recursive: true });
for (const [name, bytes] of files) await writeFile(new URL(name, destination), bytes);
await writeFile(new URL("checksums.json", destination), checksumBytes);
console.log("Published scientific package downloaded and checksums verified.");
