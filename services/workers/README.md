# Procesamiento científico

No hay cola Celery/Redis. El paso local es `services/workers/offline_runner.py`:
resume el QA de un CSV MÓNICA y, si hay base, crea un `processing_run`. Sin base
sigue en local y no finge persistencia. No analiza físicamente el PM10 ni calibra LST.

```powershell
uv run --no-sync python services/workers/offline_runner.py --no-db --input-dir data/raw/gamc/monica
```

El lote piloto Landsat sigue en `uv run --group science python scripts/ingest_landsat.py`.
El cálculo puro vive en `cocha_api.science.landsat`, independiente de HTTP.
Cuando haga falta una cola:

- Extraer cálculos a módulos Python independientes de FastAPI y Celery.
- Identificar cada trabajo mediante UUID y clave idempotente de entradas/parámetros.
- Registrar estado, progreso, versión, artefactos y errores sin secretos.
- Reintentar únicamente fallos transitorios con límites y backoff.
- Publicar resultados solo tras validar calidad y completar la transacción.
- Redis será broker/caché; PostgreSQL y almacenamiento de objetos serán persistencia.

Flujo previsto: ingesta → QA → indicadores → análisis → validación → publicación.
