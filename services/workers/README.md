# Procesamiento científico — planificado

Todavía no hay worker ejecutable ni dependencias Celery/Redis instaladas.
La primera etapa será un pipeline por lotes. Cuando requiera cola:

- Extraer cálculos a módulos Python independientes de FastAPI y Celery.
- Identificar cada trabajo mediante UUID y clave idempotente de entradas/parámetros.
- Registrar estado, progreso, versión, artefactos y errores sin secretos.
- Reintentar únicamente fallos transitorios con límites y backoff.
- Publicar resultados solo tras validar calidad y completar la transacción.
- Redis será broker/caché; PostgreSQL y almacenamiento de objetos serán persistencia.

Flujo previsto: ingesta → QA → indicadores → análisis → validación → publicación.
