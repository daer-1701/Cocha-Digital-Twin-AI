# A18 — operación (borrador, no despliegue)

Alcance local actual. No hay entorno de producción configurado en este repo.

## Desarrollo

- Compose: `docker compose up --build --wait` con `.env` (no commitear secretos).
- Prueba aislada: `./scripts/check_containers.ps1`.
- Migraciones: `uv run alembic upgrade head`.
- Backups: volumen `postgres_data` en Compose de desarrollo; no hay job de
  backup automatizado todavía.

## Antes de producción

- Secretos en gestor (no `.env` en imagen).
- `API_WRITE_TOKEN` / roles reales antes de escrituras.
- Cuota Gemini y ledger en almacenamiento compartido.
- HTTPS, backups PostGIS y monitoreo de `/health/ready`.
- Confirmar licencia de redistribución de datos municipales.
