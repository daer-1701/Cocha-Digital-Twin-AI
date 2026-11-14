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
Ver `docs/gamc-resources.md` para la diferencia entre WMS y vector distrital completo.
