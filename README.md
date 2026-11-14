# Cocha Digital Twin AI

Para continuar el desarrollo desde Cursor: [traspaso completo](CONTINUAR_EN_CURSOR.md).
Estado vigente y pendientes del equipo de cinco: [entrega del proyecto](docs/release-status.md).
Reparto completo según herramientas de cada integrante: [tareas pendientes finales](docs/tareas_pendientes_finales.md).

Base de una plataforma de evidencia ambiental para Cochabamba: temperatura
superficial, vegetación y tendencias territoriales reproducibles.

**Estado: primer recorrido MVP con ingesta real Landsat, API y explorador.**
Incluye LST, NDVI, QA, explorador 2D/3D, comparación descriptiva y exportación
de la ventana piloto. MÓNICA tiene importador y fichas, con análisis desactivado
por metadatos pendientes. Los 15 rectángulos de desarrollo están identificados
como sintéticos y no sustituyen límites oficiales. No incluye tendencias
inferenciales, ML validado ni llamadas reales a Gemini. No es un gemelo digital validado.

Se añaden historial de procesamiento, revisión local de registros MÓNICA,
lectura guiada de evidencia sin IA y herramientas de respaldo. Estas ampliaciones
están pendientes de pruebas por solicitud del usuario.

## Ejecutar el piloto con datos reales

Desde la raíz, sin credenciales NASA ni servicios de pago:

```powershell
uv sync --frozen --group science
uv run --group science python scripts/ingest_landsat.py
# En una terminal:
uv run uvicorn cocha_api.main:app --reload --no-access-log
# En otra:
npm ci
npm run dev
```

Abrir http://localhost:3000. Esta ruta piloto no requiere PostgreSQL; el catálogo
`/v1/datasets` y readiness sí lo requieren. La ingesta consulta Planetary Computer
y lee ventanas COG de cinco bandas para una escena de julio por año (2022–2024).
Los archivos originales recortados y manifiestos quedan fuera de Git. Una copia
nueva del repositorio debe ejecutar la ingesta para mostrar observaciones.

También funciona con Compose tras la ingesta: monta `data/processed` en la API
en solo lectura. No descarga datos al iniciar contenedores. Sin snapshot se
muestra un estado vacío; si falla la API se informa un error de conexión.

Detalles de método, alcance y verificación: [MVP Landsat](docs/mvp.md).

## Requisitos

- Docker Desktop con motor Linux y Docker Compose v2 para el entorno completo.
- Para desarrollo local: Node.js 22, npm 10+, Python 3.12 o 3.13 y uv 0.12.3.
- Git.

## Inicio con Docker

Desde la raíz, en PowerShell:

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
# Editar POSTGRES_PASSWORD en .env antes de continuar.
docker compose up --build --wait
```

Servicios:

- Web: http://localhost:3000
- API y OpenAPI interactivo: http://localhost:8000/docs
- Estado del proceso: http://localhost:8000/health/live
- Estado de PostGIS y presencia de migraciones: http://localhost:8000/health/ready
- Catálogo real, inicialmente vacío: http://localhost:8000/v1/datasets

Compose inicia PostGIS, ejecuta las migraciones con un servicio de una sola
ejecución, inicia la API y después la web. La web consulta la API desde su servidor.
Los puertos se exponen únicamente en localhost. Este Compose es para desarrollo
y demostración local; revisar [despliegue](docs/deployment.md) para producción.

```powershell
docker compose logs -f api
docker compose down
```

`down` conserva los datos en el volumen `postgres_data`. No uses `down -v` si
necesitas conservarlos. Cambiar POSTGRES_PASSWORD no cambia la contraseña de una
base ya inicializada; debe rotarse también dentro de PostgreSQL.

## Desarrollo local

```powershell
npm ci
uv sync --frozen
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
if (-not (Test-Path apps/web/.env.local)) { Copy-Item apps/web/.env.example apps/web/.env.local }
# Editar .env: DATABASE_URL debe coincidir con el usuario/contraseña locales.
docker compose up -d db
uv run alembic upgrade head
uv run uvicorn cocha_api.main:app --reload --no-access-log
```

En otra terminal:

```powershell
npm run dev
```

La API lee `.env` desde la raíz. Next.js lee `apps/web/.env.local`.
Compose usa POSTGRES_* y el hostname interno `db`; la ejecución local usa
DATABASE_URL. No necesitas credenciales NASA o Gemini para esta base.

## Estructura

```text
apps/web/                 Next.js App Router + TypeScript
services/api/             FastAPI, configuración, rutas, modelos y migraciones
services/workers/         Ejecutor local de QA; cola distribuida pendiente
packages/shared/          OpenAPI y tipos TypeScript generados
data/                     Política de datos; artefactos locales ignorados por Git
notebooks/                Exploración, sin lógica exclusiva de producción
scripts/                  Utilidades reproducibles
tests/unit/               API, límites y manejo de fallos
tests/integration/        Integración con PostGIS migrado
docs/                     Arquitectura, modelo de datos y plan científico
infrastructure/docker/    Imágenes para API y web
.github/workflows/        Validaciones para push y pull request
```

## Calidad y contratos

Comprobación aislada de contenedores y PostGIS (solo Andrés; Diego no necesita Docker):

```powershell
./scripts/check_containers.ps1
```

Usa una base temporal sin puertos ni datos de desarrollo. Ver [A01](docs/a01-validation.md).

```powershell
uv run ruff check .
uv run ruff format --check .
uv run --group science pytest -q
npm run lint
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e -w @cocha/web
```

Las pruebas científicas requieren `--group science`:
`uv run --group science pytest -q`. CI instala ese grupo explícitamente.
Playwright usa puertos exclusivos y fixtures sintéticas; no necesita Docker
ni consume APIs de pago. La validación de correcciones está en
[correcciones y pruebas](docs/review-fixes.md).

Las pruebas de integración se omiten sin RUN_DB_TESTS. Para ejecutarlas usa una
base exclusiva cuyo nombre termine en `_test`: las pruebas escriben fixtures.

```powershell
# Establecer DATABASE_URL apuntando a una base exclusiva de pruebas.
uv run alembic upgrade head
$env:RUN_DB_TESTS = "1"
uv run pytest -q
Remove-Item Env:RUN_DB_TESTS
```

Después de cambiar esquemas o rutas:

```powershell
uv run python scripts/export_openapi.py
npm run contracts:generate
```

Versionar los contratos y ambos lockfiles (`package-lock.json`, `uv.lock`).
CI también prueba migraciones, detecta divergencias del esquema y construye
los contenedores en Linux.

## Subir a GitHub

El repositorio local se prepara en la rama `main`. Revisa y crea el primer commit:

```powershell
git status --short
git add .
git diff --cached --stat
git commit -m "chore: initialize Cocha Digital Twin architecture"
git remote add origin https://github.com/TU_USUARIO/TU_REPOSITORIO.git
git push -u origin main
```

Crear primero un repositorio vacío en GitHub, sin README automático.
`.env`, credenciales, dependencias y datos descargados quedan excluidos.
No se ha elegido una licencia de distribución: definirla con el equipo antes
de publicar código para reutilización. Las licencias de datos son independientes.

## Documentación

- [Manual de uso y guion de demostración](docs/manual.md)
- [Interfaz y accesibilidad](docs/ux.md)
- [Arquitectura y decisiones](docs/architecture.md)
- [Modelo de datos](docs/data-model.md)
- [Plan científico y procedencia](docs/science.md)
- [Etapas de implementación](docs/roadmap.md)
- [Despliegue y operación](docs/deployment.md)
- [Cómo contribuir](CONTRIBUTING.md)
- [Seguridad](SECURITY.md)
- [Skills y reglas para Codex y Cursor](docs/ai-workflow.md)
