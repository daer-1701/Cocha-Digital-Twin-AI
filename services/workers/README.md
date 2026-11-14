# Procesamiento científico — planificado

Todavía no hay worker ejecutable ni dependencias Celery/Redis instaladas.
El lote piloto se ejecuta con `uv run --group science python scripts/ingest_landsat.py`
desde la raíz. El cálculo puro vive en `cocha_api.science.landsat`, independiente
de HTTP. Publica snapshots; todavía no hay cola ni agregación distrital.
La primera etapa será un pipeline por lotes. Cuando requiera cola:

- Extraer cálculos a módulos Python independientes de FastAPI y Celery.
- Identificar cada trabajo mediante UUID y clave idempotente de entradas/parámetros.
- Registrar estado, progreso, versión, artefactos y errores sin secretos.
- Reintentar únicamente fallos transitorios con límites y backoff.
- Publicar resultados solo tras validar calidad y completar la transacción.
- Redis será broker/caché; PostgreSQL y almacenamiento de objetos serán persistencia.

Flujo previsto: ingesta → QA → indicadores → análisis → validación → publicación.
