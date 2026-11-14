# A01 — arranque y validación técnica

## Alcance

Comprobar API y web standalone en Linux, PostGIS, migraciones y contratos sin
usar la base de desarrollo ni datos satelitales locales.

## Prueba reproducible

```powershell
./scripts/check_containers.ps1
```

Usa `compose.test.yaml` con proyecto `cocha-a01-test`.

## Resultado confirmado — 14/11/2026

```text
67 passed, 1 warning
Isolated Linux stack, tests and migrations passed.
```

Incluye: build API/web/tests, PostGIS, `alembic check`, pytest del contenedor,
`python -m cocha_api.runtime_guard` (sin NumPy/Rasterio en runtime), ciclo
downgrade → upgrade → check y limpieza del stack temporal.
