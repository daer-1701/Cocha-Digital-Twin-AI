# A18 — operación (borrador, no despliegue)

Alcance local actual. No hay entorno de producción configurado en este repo.

## Hecho en local

- A01: `./scripts/check_containers.ps1` pasó el 14/11/2026 (67 pruebas).
- Compose de desarrollo: `docker compose up --build --wait` con `.env`
  (no commitear secretos).
- Migraciones: `uv run alembic upgrade head`.
- QA sin cola: `services/workers/offline_runner.py` (`--no-db` si no hay Postgres).
- Distritos demo, solo desarrollo: `scripts/import_demo_districts.py --i-understand-demo-only`.
  No cargarlos como límites oficiales.
- Escrituras: `API_WRITE_TOKEN` existe, pero la API pública sigue en GET.

## Sin hacer

- Backups: el volumen `postgres_data` es de desarrollo. No hay job de backup
  ni una restauración probada en otra base.
- No hay HTTPS, monitoreo de costos ni despliegue fuera de la máquina local.

## Antes de producción

- Secretos en gestor (no `.env` en imagen).
- Roles reales antes de escrituras. El token compartido no es ese modelo.
- Cuota Gemini y ledger en almacenamiento compartido.
- HTTPS, backups PostGIS y monitoreo de `/health/ready`.
- Confirmar licencia de redistribución de datos municipales.
