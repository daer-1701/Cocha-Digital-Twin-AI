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
| `available` | Tres escenas completas (predeterminado) |
| `wms` | Como `available`, con capas GAMC habilitadas que devuelven imágenes rayadas sintéticas |
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
disponible, estaciones Kanata/Semapa sin importar, y series, tendencias,
indicadores, modelos, escenarios y asistente como `unavailable`. Las capas WMS
solo están disponibles en el escenario `wms`; en los demás responden 503, como
la API sin `GAMC_WMS_API_KEY`.

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
