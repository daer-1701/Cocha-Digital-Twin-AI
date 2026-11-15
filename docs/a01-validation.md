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

## Preparación del equipo actual — 14/11/2026

Esta revisión es independiente del resultado histórico anterior:

- Docker Desktop instalado en `D:\DockerDesktop`, con disco de datos configurado
  en `D:\DockerData` por falta de espacio en C:. WSL 3.0.5 instalado.
- Windows habilitó `VirtualMachinePlatform`; DISM informó que requiere reinicio.
- `docker compose config --quiet` pasó para `compose.yaml` y
  `compose.test.yaml` (este último con `.env.example`).
- Script `scripts/start_docker.ps1`: sintaxis válida, creación local de `.env`
  y conservación de su contenido al volver a ejecutar `-PrepareOnly` comprobadas.
- Ruff check y format check pasaron.
- Pytest con grupo science en Windows: **75 passed, 3 skipped, 1 failed**.
  `test_dataset_pagination_is_bounded` falló al importar la DLL de psycopg_binary:
  Control de aplicaciones de Windows bloqueó el archivo. No se deshabilitó la
  protección del sistema. Las pruebas de integración se omitieron sin base de pruebas.

## Validación tras el reinicio — 14/11/2026

La instalación por usuario dejó de ser reconocida en el registro. Se ejecutó
el instalador oficial con elevación para todos los usuarios, conservando
`D:\DockerDesktop` y `D:\DockerData`. La instalación terminó con código 0 y
Docker Desktop pudo iniciar el motor Linux. No fue necesario entrar a la BIOS.

- `scripts/start_docker.ps1` completado: imágenes construidas, migraciones
  ejecutadas y servicios `db`, `api` y `web` saludables.
- Web en contenedores: `npm run build`, `npm run lint` y `npm run typecheck`
  completados sin errores; lint y typecheck se ejecutaron en la etapa builder.
- Readiness de API y web comprobadas desde Windows con HTTP 200.
- Las siete páginas principales respondieron HTTP 200: `/`, `/comparar`,
  `/estaciones`, `/informes`, `/modelos`, `/escenarios` y `/asistente`.
- Playwright con Chrome: navegación real por Explorador, Estaciones e Informes,
  sin errores ni advertencias de consola en las comprobaciones realizadas.
- `scripts/check_containers.ps1` completado: **79 passed, 1 warning** en Linux,
  `alembic check`, guard de runtime y ciclo downgrade → upgrade → check.
  El warning corresponde a la deprecación de httpx en Starlette TestClient.
- El stack temporal se eliminó al terminar; el stack local permanece levantado.

No existe `data/processed/explorer.json` en este equipo. El estado vacío de la
web es esperado; no se descargaron datos satelitales ni se publicaron fixtures.
Los módulos científicos pendientes siguen pendientes: arrancar Docker no los
implementa ni valida evidencia ambiental.
