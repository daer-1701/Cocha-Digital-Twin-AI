# Traspaso a Cursor — Cocha Digital Twin AI

Actualizado el **14 de noviembre de 2026**, después del explorador 3D y de la
revisión de integridad de importaciones, comparación y presupuesto. Este
estado sustituye el traspaso antiguo que dejaba A01 y la migración 0002 pendientes.

## Primero

1. Leer `AGENTS.md`, las reglas del área, `README.md` y `docs/architecture.md`.
2. Ejecutar `git status --short` y revisar los diffs. Conservar los cambios del
   otro editor: dos ramas dentro de la misma carpeta no aíslan archivos.
3. Consultar `docs/review-fixes.md` para resultados actuales y su alcance.
4. Elegir pendientes de `docs/team-plan.md` según dependencias reales.

No hacer commit, push, merge ni despliegue sin solicitud que lo incluya.
No imprimir `.env`, credenciales o configuración resuelta. Las pruebas que
escriben requieren una base exclusiva `_test`; nunca la de desarrollo.

## Implementado

- Monorepo npm/uv; Next.js/React/TypeScript, FastAPI/Pydantic y PostGIS.
- Alembic `0001` y `0002`: catálogo, distritos, ejecuciones, estaciones,
  observaciones y tablas para resultados científicos. Tablas existentes no
  equivalen a datos oficiales ni modelos entrenados.
- Contratos generados en `packages/shared` desde OpenAPI.
- Piloto Landsat LST/NDVI con QA y snapshots fuera de Git. El caso real actual
  usa tres adquisiciones de julio 2022–2024, no una serie climática suficiente.
- Explorador 2D/3D MapLibre, comparación de fechas, procedencia, cobertura,
  estados vacíos y exportación CSV/JSON del piloto.
- Relieve Terrain Tiles de referencia; columnas con altura gráfica, nunca
  alturas urbanas medidas. Alternativas 2D y tabular.
- Proxy WMS GAMC en servidor, allowlist, caché y límite de tasa. Acceso real
  depende de clave y proveedor; las pruebas locales usan sustitutos sintéticos.
- MÓNICA: parser PM10, importador transaccional, fichas y metadatos pendientes.
  Un fallo revierte todos los datos de la ejecución y conserva la auditoría.
  Los duplicados y reimportaciones no sobrescriben la observación canónica.
- Fixture geográfico optativo `demo-synthetic-v1`: 15 rectángulos claramente
  rotulados. Comparación de una adquisición, más reciente por defecto y
  selector de fecha. No son distritos municipales ni estadísticas oficiales.
- Pendientes descriptivas por adquisición, sin significancia ni causalidad.
- Lectura de jobs y ejecutor local de QA en `services/workers/offline_runner.py`.
- Gemini: estado, proveedor simulado y ledger con bloqueo entre procesos que
  comparten disco. No existe adaptador de llamadas reales habilitado.
- GitHub Actions y comprobación aislada Docker/PostGIS definidas. Una ejecución
  local correcta no demuestra que CI haya pasado en GitHub.

## Pendiente y bloqueado

| Área | Próximo resultado necesario |
| --- | --- |
| A03/A06 | Vector oficial GAMC con fuente, versión, CRS y permiso; agregación zonal validada |
| A05/A07 | Ampliar cobertura temporal, validar estacionalidad, incertidumbre e inferencia |
| A08 | Huso, coordenadas, QA instrumental y licencia MÓNICA; análisis sigue apagado |
| A10–A12 | Objetivo compatible y evaluación suficiente antes de ML o escenarios |
| A13 | Cola, reintentos, recuperación de ejecuciones interrumpidas y operación sostenida |
| A14 | Almacén central para varios hosts, permisos/cuotas, evidencia, tarifas vigentes y proveedor real antes de autorizar gasto |
| A17 | Recorrido con API y datos oficiales; fixtures no sustituyen esta validación |
| A18 | Despliegue productivo y restauración de backup comprobada |

La importación no repara datos antiguos automáticamente. Corregir observaciones
publicadas por el proveedor requiere un procedimiento explícito de revisión.
No usar PM10 para calibrar LST ni confundir LST con temperatura del aire.

## Comandos de validación

Desde la raíz:

```powershell
uv sync --frozen --group science
uv run ruff check .
uv run ruff format --check .
uv run --group science pytest -q
uv run python scripts/export_openapi.py
npm run contracts:generate
npm run lint
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e -w @cocha/web
./scripts/check_containers.ps1
```

Sin `RUN_DB_TESTS=1`, pytest omite integración PostGIS. El script aislado usa
`compose.test.yaml`, una base temporal sin puertos ni volúmenes de desarrollo,
y comprueba migraciones en ambos sentidos. No lanzar pruebas de escritura
apuntando al `DATABASE_URL` habitual. Playwright usa 8110/3110 y fixtures sin
Docker ni APIs facturables. Ver resultados precisos en `docs/review-fixes.md`.

## Fuentes de verdad

- `docs/team-plan.md`: tareas de Andrés/Diego y prompts originales.
- `docs/architecture.md`, `docs/data-model.md`: contratos y persistencia.
- `docs/mvp.md`, `docs/science.md`: método, evidencia y límites.
- `docs/gamc-resources.md`, `docs/monica-status.md`: recursos y metadatos.
- `docs/andres-blockers.md`, `docs/ml-viability.md`: bloqueos científicos.
- `docs/manual.md`, `docs/ux.md`: comportamiento actual de la web.
- `docs/review-fixes.md`: correcciones y pruebas de esta revisión.
- `docs/ai-workflow.md`: reglas y skills compartidas.

Para continuar: escoger un resultado concreto, inspeccionar su implementación,
conservar cambios existentes y verificarlo con datos y pruebas apropiados.
No marcar tareas científicas como completas por tener solamente pantalla,
contrato o tabla de base de datos.
