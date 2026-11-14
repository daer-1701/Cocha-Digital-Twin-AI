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
- Historial de ejecuciones en `/procesamiento`, con estado y referencias.
- `scripts/database_archive.py`: creación de dump y manifiesto SHA-256,
  restauración únicamente hacia una base nueva `_restore_test`. Código preparado,
  aún no ejecutado ni validado.

## Sin hacer

- Backups: falta ejecutar y comprobar el script, programar copias y ensayar
  recuperación. El volumen `postgres_data` sigue siendo de desarrollo.
- No hay HTTPS, monitoreo de costos ni despliegue fuera de la máquina local.

## Antes de producción

- Secretos en gestor (no `.env` en imagen).
- Roles reales antes de escrituras. El token compartido no es ese modelo.
- Cuota Gemini y ledger en almacenamiento compartido.
- HTTPS, backups PostGIS y monitoreo de `/health/ready`.
- Confirmar licencia de redistribución de datos municipales.
