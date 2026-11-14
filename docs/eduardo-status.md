# Estado Eduardo — EF01 a EF11

Actualizado: **14 de noviembre de 2026** (sesión con PostGIS local).

| ID | Estado | Evidencia | Pendiente humano |
| --- | --- | --- | --- |
| EF01 | entregado | `data/catalog/inventory.json` | Revisión |
| EF02 | **resuelto** | KMZ GAMC `limite_distritos` → GeoJSON D1–D15 | Andrés debe exponerlo en `/v1/territories` |
| EF03 | **ensayado** | Import `gamc-official-20261114`; ST_IsValid; 0 solapes | Revisión humana / zonal stats Mateo |
| EF04 | **actualizado** | Huso `America/La_Paz` + coords en catálogo/DB; `docs/monica-status.md` | Códigos QA fabricante; permiso escrito extra |
| EF05 | **ensayado** | Import PostGIS: kanata 54 711 + semapa 71 154; `monica_import_audit.json` | Aceptación del equipo / MF06 |
| EF06 | parcial | RAR transporte oficial descargado; WMS verdes/población **live OK** | Extracción RAR; equipamientos ausentes |
| EF07 | entregado | `docs/satellite-acquisition-plan.md` | Mateo/protocolo |
| EF08 | **bloqueada (AF01)** | ML térmico solo con temp. aire Semapa; `docs/af01-scope.md` | Esperar series GAMC |
| EF09 | **ensayado** | GetMap live OK en 5 capas (`wms_verification.json`); clave solo en `.env` | Cuotas/licencia WMS formales |
| EF10 | **ensayado** | Dump + restore `cocha_restore_test` verificado (conteos = origen) | Retención externa del equipo |
| EF11 | parcial | Paquete + audits; faltan vector oficial y WMS live | Cierre tras EF02/EF09 |

## Datos oficiales usados hoy

- **MÓNICA** (ZIP GAMC público): importado; huso y coords aplicados en DB;
  `analysis_enabled=false` hasta MF06; unidad `ug/m3`.
- **Líneas de transporte** (RAR GAMC): descargado a
  `data/raw/gamc/socioenvironmental/` (sin extraer: no hay unrar/7z en el host).

## Qué no es oficial (y no se importó como tal)

- Extracción de 15 polígonos INE `030101` desde hogaria/ciudatoslab:
  `cochabamba_15_candidate_unverified.geojson`.
  Etiquetado `not_gamc_official` / `do_not_import_as_official=true`.
  **No** se pasó `--i-confirm-authorized-gamc-vector`.

## Operación local

- PostGIS Compose en **`127.0.0.1:5434`** (5432 ocupado por otro contenedor).
- `DATABASE_URL` del `.env` apunta a ese puerto.
- Backup: `data/backups/cocha-20261114.dump` (+ manifiesto con
  `restoration_verified=true`).
