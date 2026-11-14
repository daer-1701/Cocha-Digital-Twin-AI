# A01 — arranque y validación técnica

## Alcance

Comprobar API y web standalone en Linux, PostGIS, migraciones y contratos sin
usar la base de desarrollo ni datos satelitales locales. No ejecutar descargas
científicas, Gemini o acciones remotas de GitHub para esta comprobación.

## Prueba reproducible

Con Docker Desktop Linux iniciado, desde la raíz en PowerShell:

```powershell
./scripts/check_containers.ps1
```

El script usa únicamente `compose.test.yaml` con nombre `cocha-a01-test`:

- Sin puertos publicados, `.env` locales ni credenciales personales.
- Base `cocha_test` en tmpfs desechable, sin volumen de desarrollo.
- Sin montaje de `data/raw` o `data/processed`: comprueba también el estado vacío.
- Imágenes construidas desde lockfiles, sin usar dependencias de la computadora.
- Runner de pruebas con dependencias científicas; runtime API sin NumPy/Rasterio.
- Construcciones secuenciales para limitar presión de memoria y disco.
- `alembic check`, pruebas HTTP/DB y downgrade → upgrade → check en la base temporal.
- Limpieza del proyecto de pruebas al finalizar, incluso si una comprobación falla.

## Salud y migraciones

`/health/live` verifica el proceso HTTP sin abrir una conexión a la base.
`/health/ready` requiere PostGIS y que la revisión Alembic coincida con la del
código desplegado; una revisión antigua produce 503. Esto no sustituye
`alembic check` ni valida la calidad científica de los datos.

Las pruebas que escriben en DB exigen `RUN_DB_TESTS=1` y nombre de base acabado
en `_test`. El esquema de desarrollo no se utiliza para estas verificaciones.

## Resultados (14/11/2026)

### Confirmado

- Docker Desktop disponible (engine 29.x, Compose v2).
- Imágenes construidas en esta sesión: `cocha-api:a01-test`,
  `cocha-a01-test-tests`, `cocha-a01-test-web`.
- Contenedor API de prueba: importación OK, UID 10001, sin NumPy/Rasterio,
  head Alembic leído desde código (`0001` en la sesión temprana; el head
  vigente del árbol actual incluye también `0002` tras A04).
- Pruebas unitarias locales: **32 passed, 3 skipped** (DB/stack sin flags).
- Ruff check/format OK. OpenAPI regenerado y tipado web alineado.
- CI definida para ejecutar el mismo chequeo aislado en GitHub Actions;
  **no se ejecutó** el workflow remoto en esta sesión.

### No validado (bloqueo de entorno)

- Descarga completa de `postgis/postgis:17-3.5` incompleta o excesivamente lenta
  en el host (RAM libre &lt; 1 GB durante el intento; transferencia previa con
  `unexpected EOF` en Codex).
- Por eso **no** se afirma el arranque integral de `compose.test.yaml`, las
  pruebas PostGIS, el ciclo downgrade→upgrade ni la limpieza final del stack.
- Relanzar `./scripts/check_containers.ps1` cuando haya más RAM/disco y la
  imagen PostGIS completa. No usar `down -v` sobre la base de desarrollo.

### Nota

Los cambios de código A01 (Compose de prueba, health de revisión, Dockerfile
`test`, script y CI) quedan versionados. La aceptación plena de A01 requiere
una ejecución exitosa del runner aislado.

## Validación Docker dejada pendiente

En el tramo A05–A16 la validación Docker completa se dejó **pendiente a
propósito**. No se ejecutó `./scripts/check_containers.ps1` ni el ciclo
aislado de `compose.test.yaml`. A01 no queda aceptado por ese trabajo. El
estado en `docs/team-plan.md` es pendiente hasta una corrida exitosa del
runner.
