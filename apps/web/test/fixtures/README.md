# Fixtures sintéticas del frontend

Servidor Node que imita la API para desarrollar la web sin Python, Docker ni
base de datos. **Todos sus valores son generados**: no representan Cochabamba
ni ninguna adquisición Landsat.

## Uso

```powershell
npm ci
# Terminal 1
npm run dev:fixtures
# Terminal 2, con API_INTERNAL_URL=http://127.0.0.1:8100 en apps/web/.env.local
npm run dev
```

Para volver a la API real, restaurar `API_INTERNAL_URL=http://localhost:8000`
(o la URL acordada con Andrés) y reiniciar `npm run dev`. Next.js lee
`.env.local` solo al arrancar.

## Escenarios

| Nombre | Comportamiento |
| --- | --- |
| `valle` | Predeterminado. Once escenas de julio (2015-2025) en una malla de 15 × 15 celdas (unos 320 m), con nubes en 2017 y 2021. Activa indicadores, series y tendencias descriptivas sobre los 15 rectángulos `demo-synthetic-v1`. Patrón espacial inventado (núcleo cálido, piedemonte y corredor verdes); no es un mapa de Cochabamba |
| `available` | Tres escenas completas |
| `wms` | Como `available`, con capas GAMC habilitadas que devuelven imágenes rayadas sintéticas |
| `monica-review` | Como `available`, con dos estaciones importadas (Kanata: 60 registros PM10 con ceros, negativos y faltantes; Semapa: sin filas) y 25 ejecuciones de procesamiento paginadas |
| `monica-locked` | Como `monica-review`, con la revisión de registros desactivada en el servidor (`MONICA_REVIEW_ENABLED` apagado) |
| `quota` | Como `available`, con el presupuesto de USD 4 del asistente completamente gastado |
| `partial` | Cobertura reducida, celdas sin datos y una escena sin píxeles válidos |
| `no-scenes` | Snapshot sin escenas |
| `empty` | Sin snapshot publicado |
| `error` | 503 como la API ante un snapshot inválido |
| `slow` | Supera el timeout de 5 s de la web |

Elegir al iniciar: `npm run dev:fixtures -- --scenario=partial`.
Cambiar en caliente y recargar la página:

```powershell
Invoke-RestMethod -Method Post http://127.0.0.1:8100/__fixtures/scenario/empty
```

`GET http://127.0.0.1:8100/__fixtures` lista escenarios y el activo.
Puerto alternativo: variable `FIXTURES_PORT` (el enlace de escena seguirá
apuntando a 8100).

Los escenarios cambian `/v1/explorer`. El resto de rutas (`domain.mjs`) reproduce
los estados honestos por defecto de la API: territorios con vector distrital no
disponible, dos estaciones sintéticas sin importar (unidad declarada,
coordenadas pendientes), historial de procesamiento vacío, y series,
indicadores, modelos, escenarios y asistente como `unavailable`. Los
escenarios `monica-*` y `quota` cambian estaciones, registros, ejecuciones y
gasto del asistente. Además, derivadas del snapshot del escenario activo:

- `/v1/trends` es `unavailable` por distrito, con `pilot_trends`: pendiente
  descriptiva por mínimos cuadrados sobre el índice de escena, con la misma regla
  que el backend (mínimo 3 valores; si no, `inconclusive`).
- `/v1/reports` es `available` con `observation_export` cuando hay snapshot, y
  `empty` cuando no lo hay.

Las capas WMS solo están disponibles en el escenario `wms`; en los demás
responden 503, como la API sin `GAMC_WMS_API_KEY`. El escenario `wms` también
marca precios del asistente como verificados, con valores de relleno, para
probar esa vista.

## Pruebas de navegador (D15)

`apps/web/test/e2e/` contiene pruebas Playwright que arrancan estas fixtures en
el puerto 8110 y `next start` en el 3110, sin tocar servidores de desarrollo:

```powershell
npm run build
npx playwright install chromium   # una vez, desde apps/web
npm run test:e2e -w @cocha/web
```

Cubren territorio, fecha, comparación y variable en la URL; estados vacío,
error, parcial y API lenta; tabla; capas WMS y validación del proxy; pendiente
piloto; secciones sin datos; escenario rotulado; asistente sin cuota, con
precios verificados y con presupuesto gastado; lectura guiada; estaciones,
revisión de registros MÓNICA e historial de procesamiento; descargas CSV/JSON
coherentes con la pantalla y enlaces compartidos; interacción 3D; axe-core
WCAG 2.2 AA, teclado, nombres accesibles, ids duplicados, falta de WebGL y
desbordamiento a 320 y 390 px. Las incidencias abiertas son `test.fixme` con
el ID de `docs/qa-report.md`. CI las ejecuta en el job `web`. **Pasar estas pruebas valida la interfaz contra el contrato,
no los datos reales ni la integración con la API de Andrés.**

## Garantías

- Cada respuesta lleva `x-cocha-data-source: synthetic-fixture`. La web muestra
  entonces una franja **DEMO** permanente y rotula los indicadores como
  «Sintético», no «Observación».
- Un build de producción rechaza esas respuestas salvo con
  `ALLOW_SYNTHETIC_FIXTURES=1`, y el servidor no arranca con `NODE_ENV=production`.
  La web nunca usa fixtures como respaldo si falla la API real.
- Escucha solo en `127.0.0.1`.
- Al arrancar valida los escenarios y todas las rutas de `domain.mjs` contra `packages/shared/openapi.json`. Si
  el contrato cambia, falla con la ruta del campo incompatible: actualizar
  `scenarios.mjs`, no copiar tipos a mano.
- La respuesta 503 reproduce la API (`tests/unit/test_explorer.py`); OpenAPI
  aún no documenta ese código.
