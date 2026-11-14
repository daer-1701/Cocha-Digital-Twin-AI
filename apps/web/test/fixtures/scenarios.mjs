// Synthetic demo data for frontend development only. Values are generated, not observed.
import { valleySnapshot } from "./valley.mjs";

const BOUNDS = [-66.18, -17.41, -66.14, -17.37];
const GRID = 6;
const PIXELS_PER_CELL = 144;

const round = (value, digits) => Number(value.toFixed(digits));

function cells(lstBase, ndviBase, isMissing = () => false) {
  const [west, south, east, north] = BOUNDS;
  const width = (east - west) / GRID;
  const height = (north - south) / GRID;
  const result = [];
  for (let row = 0; row < GRID; row++) {
    for (let col = 0; col < GRID; col++) {
      const missing = isMissing(row, col);
      result.push({
        bounds: [
          round(west + col * width, 6),
          round(north - (row + 1) * height, 6),
          round(west + (col + 1) * width, 6),
          round(north - row * height, 6),
        ],
        lst: missing ? null : round(lstBase + row * 1.5 - col * 0.8, 2),
        ndvi: missing ? null : round(ndviBase - row * 0.03 + col * 0.02, 3),
      });
    }
  }
  return result;
}

function scene(year, lstBase, ndviBase, isMissing) {
  const grid = cells(lstBase, ndviBase, isMissing);
  const valid = grid.filter((cell) => cell.lst !== null);
  const mean = (key, digits) =>
    valid.length ? round(valid.reduce((sum, c) => sum + c[key], 0) / valid.length, digits) : null;
  return {
    id: `DEMO-SINTETICA-${year}-07`,
    acquired_at: `${year}-07-15T14:30:00Z`,
    platform: "demo-sintetica",
    source_url: "http://127.0.0.1:8100/__fixtures",
    valid_fraction: round(valid.length / grid.length, 4),
    valid_pixels: valid.length * PIXELS_PER_CELL,
    total_pixels: grid.length * PIXELS_PER_CELL,
    lst_mean: mean("lst", 4),
    ndvi_mean: mean("ndvi", 4),
    cells: grid,
  };
}

function snapshot(scenes) {
  return {
    status: "available",
    evidence: {
      schema_version: 1,
      generated_at: "2026-11-14T00:00:00Z",
      area_name: "DEMO · datos sintéticos sobre la ventana piloto",
      bounds: BOUNDS,
      collection: "landsat-c2-l2",
      product_version: "DEMO sintética · no es un producto Landsat",
      license: "Fixture de desarrollo; sin fuente real",
      method: "Valores generados por fórmula para probar la interfaz. No son mediciones.",
      limitations: [
        "Datos sintéticos de desarrollo: no representan Cochabamba ni ninguna adquisición.",
        "No usar en análisis, capturas de resultados ni presentaciones como evidencia.",
      ],
      scenes,
    },
  };
}

export const scenarios = {
  valle: {
    description:
      "Once escenas de julio (2015-2025), celdas de unos 360 m, nubes y distritos demo con indicadores, series y tendencias",
    status: 200,
    districts: true,
    body: valleySnapshot(),
  },
  available: {
    description: "Tres escenas completas",
    status: 200,
    body: snapshot([scene(2022, 24, 0.32), scene(2023, 25, 0.3), scene(2024, 26, 0.28)]),
  },
  wms: {
    description: "Tres escenas y capas GAMC sintéticas (imágenes rayadas, no límites reales)",
    status: 200,
    wms: true,
    body: snapshot([scene(2022, 24, 0.32), scene(2023, 25, 0.3), scene(2024, 26, 0.28)]),
  },
  "monica-review": {
    description:
      "Tres escenas, estaciones MÓNICA importadas con registros sintéticos paginados y 25 ejecuciones de procesamiento",
    status: 200,
    monica: "review",
    body: snapshot([scene(2022, 24, 0.32), scene(2023, 25, 0.3), scene(2024, 26, 0.28)]),
  },
  "monica-locked": {
    description: "Como monica-review, con la revisión local de registros desactivada en el servidor",
    status: 200,
    monica: "locked",
    body: snapshot([scene(2022, 24, 0.32), scene(2023, 25, 0.3), scene(2024, 26, 0.28)]),
  },
  quota: {
    description: "Tres escenas; el asistente informa el presupuesto de USD 4 completamente gastado",
    status: 200,
    quotaSpent: true,
    body: snapshot([scene(2022, 24, 0.32), scene(2023, 25, 0.3), scene(2024, 26, 0.28)]),
  },
  partial: {
    description: "Cobertura reducida, celdas sin datos y una escena sin píxeles válidos",
    status: 200,
    body: snapshot([
      scene(2022, 24, 0.32),
      scene(2023, 25, 0.3, (row, col) => row < 3 || col === 5),
      scene(2024, 26, 0.28, () => true),
    ]),
  },
  "no-scenes": {
    description: "Snapshot disponible sin escenas",
    status: 200,
    body: snapshot([]),
  },
  empty: {
    description: "Sin snapshot publicado",
    status: 200,
    body: { status: "empty", evidence: null },
  },
  error: {
    description: "Snapshot inválido en la API (503)",
    status: 503,
    body: { detail: "Evidence unavailable" },
  },
  slow: {
    description: "Respuesta que supera el timeout de 5 s de la web",
    status: 200,
    delayMs: 7000,
    body: snapshot([scene(2024, 26, 0.28)]),
  },
};
