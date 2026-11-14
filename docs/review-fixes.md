# Correcciones de la revisión — 14/11/2026

## Alcance

Correcciones locales de la importación MÓNICA, comparación demo, presupuesto
y documentación. No se habilitan APIs de pago ni se inventan límites oficiales.

| Problema | Comportamiento corregido | Regresión |
| --- | --- | --- |
| Importación fallida guardaba datos parciales | Transacción de datos completa y auditoría del fallo en sesión independiente | Archivo ausente después del primero y error SQL real en PostGIS |
| Duplicados reemplazaban observaciones válidas | Primera fila canónica; duplicados excluidos y claves existentes conservadas con su procedencia | Fechas equivalentes, valores contradictorios y reimportación |
| Comparación truncada y primera escena implícita | Una adquisición antes de paginar, última fecha por defecto y selector explícito; hasta 30 indicadores por escena | 15 rectángulos × 3 escenas desordenadas; paginación y fecha inexistente; navegación entre fechas |
| Ledger solo sincronizado dentro de una instancia | Bloqueo de archivo estable y recarga bajo bloqueo en Windows/Linux | Procesos simultáneos, instancias desactualizadas y conciliación idempotente |

El ledger en archivo requiere el mismo disco y ruta compartidos. Su modo en
memoria sigue limitado a una instancia. Varios hosts requieren un almacén
transaccional central antes de habilitar llamadas reales. Una actualización
de observaciones ya importadas requiere revisión explícita del proveedor;
no se modificaron datos de desarrollo durante esta corrección.

El target de pruebas Docker incluye ahora scripts, el ejecutor local y los
fixtures geográficos que usa la suite actual. Esos recursos no se añaden al
runtime de producción. No cambió el esquema de la base de datos.

## Validación

En ejecución; los resultados se registran al terminar. Comandos reproducibles:

```powershell
uv run --group science pytest -q
uv run ruff check .
uv run ruff format --check .
uv run python scripts/export_openapi.py
npm run contracts:generate
npm run lint
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e -w @cocha/web
./scripts/check_containers.ps1
```

Sin `RUN_DB_TESTS=1`, pytest omite las pruebas con PostGIS. El script de
contenedores usa `cocha_test` en tmpfs, sin puertos publicados ni volúmenes
de desarrollo, comprueba Alembic y restaura su stack al terminar. Playwright
usa fixtures sintéticas en 8110 y la web en 3110. Ninguna de estas pruebas
comprueba disponibilidad actual del GAMC ni consume Gemini.

## Pendientes del producto

Vector distrital oficial y agregación zonal verificada; metadatos y validación
MÓNICA; cobertura multitemporal suficiente; inferencia, ML y escenarios
validados; proveedor Gemini real; orquestación distribuida; despliegue y
restauración de backups. Ver `team-plan.md` y `andres-blockers.md`.
