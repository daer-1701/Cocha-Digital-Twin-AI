# Arquitectura

## Objetivo y límites

Separar presentación, contratos HTTP, persistencia y cálculo científico.
La API entrega evidencia calculada y trazable; no ejecuta descargas satelitales
ni entrenamiento dentro de una petición HTTP. El asistente futuro explica
evidencia y no calcula métricas científicas por su cuenta.

```mermaid
flowchart LR
    U[Usuario] --> W[Next.js]
    W --> A[FastAPI /v1]
    A --> DB[(PostgreSQL + PostGIS)]
    S[Fuentes científicas verificadas] -. pendiente .-> P[Pipeline Python por lotes]
    P -. metadatos e indicadores .-> DB
    P -. rásteres COG y artefactos .-> O[Archivos / almacenamiento de objetos]
    A -. consulta futura .-> G[Gemini en servidor]
```

Líneas continuas: base implementada. Líneas discontinuas: componentes planificados.

## Responsabilidades

| Área | Responsabilidad |
| --- | --- |
| `apps/web/src/app` | Composición de páginas y estados de interfaz |
| `apps/web/src/lib` | Adaptadores de comunicación; llamadas internas solo desde servidor |
| `services/api/src/cocha_api/routes` | HTTP, validación de entrada y respuestas |
| `services/api/src/cocha_api/schemas` | Contratos públicos Pydantic |
| `services/api/src/cocha_api/db` | ORM, sesiones y conexiones |
| `services/api/src/cocha_api/core` | Configuración y logs |
| `services/api/migrations` | Historial del esquema administrado por Alembic |
| `services/workers` | Diseño del pipeline futuro |
| `packages/shared` | Contratos generados, sin lógica científica duplicada |

El catálogo inicial es pequeño: las rutas consultan SQLAlchemy directamente.
Introducir servicios de aplicación y repositorios cuando aparezcan reglas de
dominio reutilizables; evitar capas sin responsabilidad real.

## Decisiones

El primer MVP añade una persistencia de evidencia basada en snapshots JSON
validados por Pydantic: el lote científico escribe `data/processed/explorer.json`
y `/v1/explorer` lo lee sin procesar rásteres en HTTP. Es un paso incremental
para el piloto sin límites distritales. No inserta resultados en el catálogo
PostGIS ni sustituye sus migraciones; la persistencia distrital se incorpora
cuando existan geometrías verificadas. Compose monta los snapshots en solo lectura.

1. **Monorepo:** npm workspaces para web y tipos; proyecto Python en la raíz.
2. **Contrato generado:** FastAPI genera OpenAPI y openapi-typescript genera tipos.
3. **Esquema versionado:** Alembic, sin `create_all` al iniciar la API.
4. **Rásteres fuera del ORM:** almacenar COG/Parquet y registrar URI, checksum y
   procedencia en una futura migración. PostGIS conserva geometrías e indicadores.
5. **Arranque explícito:** `migrate` termina antes de que arranque la API.
6. **Procesamiento diferido:** iniciar por scripts por lotes; Celery/Redis se
   incorporan cuando existan trabajos largos solicitados por usuarios.
7. **Dependencias mínimas:** MapLibre, deck.gl, Tailwind, bibliotecas científicas
   y Gemini se añaden junto con su funcionalidad y validación correspondientes.
8. **Sin datos de muestra ambiguos:** catálogo vacío hasta verificar fuentes.

El override de minimatch en la herramienta de lint evita GHSA-g3hv-75wg-m249.
Revisarlo al actualizar typescript-eslint; no es dependencia del runtime web.

## Contratos actuales

| Método | Ruta | Comportamiento |
| --- | --- | --- |
| GET | `/health/live` | Proceso HTTP disponible; no consulta DB |
| GET | `/health/ready` | Comprueba PostGIS y existencia de una revisión Alembic; 503 ante fallo |
| GET | `/v1/datasets?limit=50&offset=0` | Catálogo persistido; limit entre 1 y 100 |
| GET | `/openapi.json` | Contrato generado |
| GET | `/v1/explorer` | Snapshot Landsat validado; estado vacío si falta, 503 si es inválido |

Readiness no sustituye la comprobación `alembic check` de CI ni garantiza que
los datos científicos estén disponibles. No hay endpoints de escritura públicos,
autenticación, simulación ni conversación implementados.

## Referencias de implementación

- https://nextjs.org/docs/app/getting-started/installation
- https://fastapi.tiangolo.com/deployment/docker/
- https://docs.docker.com/compose/how-tos/use-secrets/
