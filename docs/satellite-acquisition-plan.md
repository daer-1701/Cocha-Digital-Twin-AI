# Plan de adquisición satelital acotada (EF07)

Actualizado: **14 de noviembre de 2026**. Responsable: Eduardo (inventario y
acceso); Mateo define el protocolo científico (MF01/MF03).

## Ya disponible (piloto)

| Campo | Valor |
| --- | --- |
| Producto | Landsat 8/9 Collection 2 Level-2 (`landsat-c2-l2`) |
| Acceso | Planetary Computer STAC, firma SAS anónima |
| Bandas | red, nir08, lwir11, qa_pixel, qa_radsat |
| Resolución | 30 m entregada; térmica nativa ~100 m |
| Período piloto | julio 2022, 2023, 2024 (una escena/año) |
| Ventana | `[-66.18, -17.41, -66.14, -17.37]` EPSG:4326 |
| QA | máscara bits 0–5 QA_PIXEL; QA_RADSAT ≠ 0; DN cero |
| Volumen piloto | tres escenas + recortes locales (fuera de Git) |
| Presupuesto | $0 (sin llamadas de pago) |
| Reproducción | `uv run --group science python scripts/ingest_landsat.py` |
| Estado en este clon | caché ausente hasta ejecutar la ingesta |

Detalle de método: `docs/mvp.md`.

## Ampliación candidata (no autorizada por defecto)

Antes de ampliar descargas: muestra de una escena adicional, estimar volumen y
confirmar con Mateo el criterio de aceptación.

| Producto | Uso potencial | Resolución | Acceso | Riesgo |
| --- | --- | --- | --- | --- |
| Landsat C2 L2 (más fechas) | Serie LST/NDVI | 30 m | Planetary Computer | Sesgo de días despejados |
| MODIS MOD11/MOD13 | Frecuencia mayor | 250 m–1 km | Earthdata en varios casos | Poco detalle intraurbano |
| MAIAC AOD | Contexto aerosoles | ~1 km | Earthdata | Relación con PM10 no validada |
| MERRA-2 / AIRS | Temperatura del aire regional | ≥0,5° | Earthdata | No distingue distritos |

No descargar colecciones enteras. Credenciales Earthdata solo en servidor.

## Checklist antes de ampliar

1. Producto, versión y bandas fijados por escrito (MF01).
2. BBOX y período acotados; estimación de GB y tiempo.
3. Una muestra validada (escalas, QA, NoData) antes del lote.
4. Manifiesto SHA-256 y originales en `data/raw/` (fuera de Git).
5. Presupuesto/cuota confirmados si el acceso deja de ser anónimo.

## Entrega a Mateo/Andrés

- Manifiesto de disponibilidad (este documento + `data/catalog/inventory.json`).
- Tras ingesta: `data/processed/landsat-manifest.json` y `explorer.json`.
- Limitaciones explícitas: tres fechas no son climatología; la ventana no es
  un distrito municipal.
