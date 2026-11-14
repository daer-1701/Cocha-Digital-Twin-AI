# Cocha Digital Twin AI

Base de una plataforma de evidencia ambiental para Cochabamba: temperatura
superficial, vegetación y tendencias territoriales reproducibles.

**Estado: arquitectura inicial funcional, sin datos científicos integrados.**
No incluye predicciones, estaciones inventadas, mapas distritales aproximados
ni llamadas a Gemini. No es todavía un gemelo digital validado.

## Requisitos

- Docker Desktop con motor Linux y Docker Compose v2 para el entorno completo.
- Para desarrollo local: Node.js 22, npm 10+, Python 3.12 o 3.13 y uv 0.12.3.
- Git.

## Inicio con Docker

Desde la raíz, en PowerShell:

```powershell
Copy-Item .env.example .env
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
Copy-Item .env.example .env
Copy-Item apps/web/.env.example apps/web/.env.local
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
services/workers/         Contrato del futuro procesamiento científico
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

```powershell
uv run ruff check .
uv run ruff format --check .
uv run pytest -q
npm run lint
npm run typecheck
npm run build
```

Las pruebas de integración se omiten sin RUN_DB_TESTS. Para ejecutarlas usa una
base exclusiva de pruebas: la prueba inserta y elimina un registro de fixture.

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

- [Arquitectura y decisiones](docs/architecture.md)
- [Modelo de datos](docs/data-model.md)
- [Plan científico y procedencia](docs/science.md)
- [Etapas de implementación](docs/roadmap.md)
- [Despliegue y operación](docs/deployment.md)
- [Cómo contribuir](CONTRIBUTING.md)
- [Seguridad](SECURITY.md)
- [Skills y reglas para Codex y Cursor](docs/ai-workflow.md)
