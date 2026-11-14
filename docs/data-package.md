# Paquete de datos reproducible (EF11)

Actualizado: **14 de noviembre de 2026**. Entrega de Eduardo hacia Andrés/Mateo
y, en demo, hacia Diego/Julio vía API/fixtures.

## Contenido del paquete

| Pieza | Ubicación | En Git |
| --- | --- | --- |
| Catálogo sanitizado GAMC | `data/catalog/gamc.json` | Sí |
| Inventario on-disk | `data/catalog/inventory.json` | Sí (sin secretos) |
| Auditoría MÓNICA | `data/catalog/monica_audit.json` | Sí (resumen) |
| Verificación WMS/relieve | `data/catalog/wms_verification.json` | Sí |
| Fixture demo distritos | `data/fixtures/demo_districts.geojson` | Sí (sintético) |
| CSV MÓNICA + manifiesto | `data/raw/gamc/monica/` | **No** |
| Landsat raw/processed | `data/raw/landsat-pilot/`, `data/processed/` | **No** |
| Dumps PostGIS | `data/backups/` | **No** |
| Vector oficial 15 distritos | pendiente EF02 | — |

## Cómo reproducir en otro clon

```powershell
git clone <repo>
cd Cocha-Digital-Twin-AI
python scripts/download_gamc.py
python scripts/audit_local_inventory.py
# Con PYTHONPATH o desde uv:
uv run --no-sync python scripts/audit_monica.py
uv run --no-sync python scripts/verify_gamc_wms.py
# Opcional satélite (red + science deps):
uv run --group science python scripts/ingest_landsat.py
# PostGIS aislado (Andrés/Eduardo con Docker):
# docker compose up --build --wait
# uv run alembic upgrade head
# uv run --no-sync python scripts/import_monica.py
```

Diego/Julio **no** necesitan estos pasos: usan `npm run dev:fixtures` o la API
compartida.

## Permisos

- No redistribuir CSV MÓNICA ni dumps hasta confirmar licencia GAMC.
- No commitear `.env`, claves WMS ni archivos grandes.
- Rotular siempre demo vs oficial.

## Bloqueos que impiden cerrar EF11 como “completo”

1. Vector oficial de 15 distritos (EF02/EF03).
2. Capas socioambientales autorizadas con fechas/unidades (EF06).
3. Ensayo de restore aceptado (EF10) sobre Compose del proyecto.
4. Licencia de redistribución MÓNICA.

Mientras tanto, este paquete documenta lo reproducible **hoy** y lo ausente.
