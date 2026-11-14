# MÓNICA — confirmado y pendiente

Actualizado: **14 de noviembre de 2026**. PM10 nunca se presenta como temperatura.

## Confirmado

- Archivos: `red_monica.kanata (1).csv` y `red_monica.semapa (1).csv`, columnas
  `estacion`, `pm10`, `fecha_medicion`.
- Variable: PM10. No es temperatura del aire y no calibra LST.
- Unidad: `ug/m3` desde el informe 2021 (no del CSV).
- **Huso:** `America/La_Paz`. Los timestamps del CSV siguen sin offset; se
  guardan naive y se declara el huso en la estación.
- **Coordenadas (2026-11-14):**

| Estación | Lat | Lon | Elevación |
| --- | --- | --- | --- |
| Parque Kanata | -17.41252 | -66.15897 | ~2564 m (rango 2554–2574) |
| SEMAPA | -17.36470 | -66.16245 | ~2600 m |

- Import PostGIS: kanata 54 711 + semapa 71 154 (`monica_import_audit.json`).
- `analysis_enabled=false` hasta que Mateo acepte series (MF06).

## Política de ceros y negativos

Sin códigos de instrumento del proveedor. Decisión del proyecto:

- Conservar el valor crudo.
- Marcar `zero` / `negative`.
- Excluirlos de agregados físicos (`analysis_eligible` solo `valid`).
- No truncar negativos a cero ni convertir ceros en faltantes.

## Licencia / uso

- Se puede mostrar en la app del proyecto (`MONICA_REVIEW_ENABLED=true` local).
- CSV/ZIP crudos fuera de Git.
- No republicar el archivo fuente en público sin permiso escrito adicional.

## Pendiente

- Códigos QA del fabricante / procedimiento oficial de corrección.
- Permiso escrito de redistribución más allá de la app.
- Vector oficial de 15 distritos (aparte de MÓNICA).

## Importación y duplicados

`scripts/import_monica.py` importa en una transacción. Duplicados no sobrescriben.
Metadatos de estación: `scripts/sync_monica_station_metadata.py`.
