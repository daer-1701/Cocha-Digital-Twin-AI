// Keep MapLibre's worker on the same origin and at the installed library version.
import { copyFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const destination = new URL("../apps/web/public/", import.meta.url);
mkdirSync(destination, { recursive: true });
copyFileSync(
  fileURLToPath(import.meta.resolve("maplibre-gl/dist/maplibre-gl-worker.mjs")),
  new URL("maplibre-worker.mjs", destination),
);
