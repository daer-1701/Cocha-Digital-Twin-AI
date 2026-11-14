# Datos

`raw/`, `processed/` y `models/` son directorios locales ignorados por Git.
Pueden contener descargas y resultados locales. Versionar código, manifiestos
pequeños y documentación de procedencia, no rásteres o pesos de modelos.

Cada descarga deberá registrar fuente, versión, licencia, fecha, checksum,
CRS, unidades, calidad y parámetros de consulta. Credenciales fuera de manifiestos.

`catalog/gamc.json` es un catálogo sanitizado versionado, con recursos municipales
y diagnóstico inicial de archivos. Los originales MÓNICA, CSV extraídos y sus
manifiestos de descarga están en `raw/gamc/monica/`, fuera de Git.
Descarga reproducible: `python scripts/download_gamc.py`.

Inventario on-disk (EF01): `python scripts/audit_local_inventory.py` →
`catalog/inventory.json`. Auditoría MÓNICA: `uv run --no-sync python scripts/audit_monica.py`.
Paquete reproducible: `docs/data-package.md`. Estado Eduardo: `docs/eduardo-status.md`.

Ver `docs/gamc-resources.md` para la diferencia entre WMS, vector oficial y el
fixture sintético `fixtures/demo_districts.geojson` (no es un límite GAMC).
No colocar el vector oficial en `fixtures/`; usar `raw/gamc/districts/` fuera de Git.
