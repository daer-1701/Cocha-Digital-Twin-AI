# API compartida para Diego y Julio (AF03)

Estado: **configuración preparada, entorno no desplegado**. Andrés no publicó
servicios ni abrió puertos. Mientras no exista la API compartida, Diego y Julio
trabajan con las fixtures (`npm run dev:fixtures`), que se validan contra el
mismo OpenAPI al arrancar.

## Contratos

- Fuente: `packages/shared/openapi.json` (Pydantic → OpenAPI) y
  `packages/shared/src/api.d.ts` (tipos TypeScript generados). No editarlos a
  mano; Andrés los regenera con:

```powershell
uv run python scripts/export_openapi.py
npm run contracts:generate
```

- Todo recurso de dominio devuelve `status` (`available` | `empty` |
  `unavailable`) y `reason`. `unavailable` y `empty` son estados válidos que la
  interfaz debe mostrar; nunca convertirlos en cero.

## Endpoints añadidos en esta entrega

| Método | Ruta | Uso en la web | Estado hoy |
| --- | --- | --- | --- |
| GET | `/v1/territories/districts?boundary_version=&include_geometry=` | DF03: distritos oficiales | `unavailable` hasta EF03 |
| GET | `/v1/series?boundary_version=&district_number=&variable=&statistic=&period_from=&period_to=` | DF04: `official_items` aceptados | `unavailable` hasta MF04 |
| GET | `/v1/trends` | DF04: `official_trends` además de `pilot_trends`/`demo_trends` | `unavailable` hasta MF05 |
| GET | `/v1/models` | DF06: `accepted_models` | `unavailable` hasta MF08 |
| GET | `/v1/jobs?kind=&status=` | Historial con `attempt`, `heartbeat_at`, `error_code` | disponible con DB |
| GET | `/v1/stations/{id}/observations?quality_flag=&observed_from=&observed_to=` | DF05: `observed_at_raw` | requiere rol `reviewer` |
| POST | `/v1/assistant/ask` | DF07 (desde el servidor Next) | `unavailable` mientras las llamadas sigan apagadas |

Los campos nuevos son opcionales o listas vacías por defecto: las páginas
actuales siguen funcionando sin cambios.

## Errores

| Código | Significado |
| --- | --- |
| 401 | Falta `Authorization: Bearer …` en una ruta con rol |
| 403 | El token no concede ese rol |
| 404 | Recurso inexistente (estación, escena, trabajo) |
| 409 | `request_id` del asistente todavía en curso |
| 422 | Parámetros fuera de rango (límite, período invertido, fecha con huso) |
| 429 | Cuota del asistente agotada |
| 503 | Base de datos no disponible o rol sin configurar |

## Roles y secretos

Los tokens (`API_REVIEWER_TOKEN`, `API_ASSISTANT_TOKEN`, `API_OPERATOR_TOKEN`)
son secretos de servidor. Diego y Julio **no los reciben**: la web los lee en el
servidor de Next (`apps/web/src/lib/api.ts`, `server-only`) y nunca con
`NEXT_PUBLIC_*`. Quien abra una página que usa un token ve lo que ese token
desbloquea; por eso la revisión MÓNICA solo debe activarse en un entorno
privado.

## Entorno compartido propuesto (decisión pendiente)

Opciones, sin publicar nada hasta acordarla:

1. **Túnel privado** (recomendado): Andrés ejecuta Compose en su equipo y
   comparte la API mediante una red privada (por ejemplo, una VPN de malla o un
   túnel SSH). Los puertos siguen ligados a `127.0.0.1`; solo los miembros de la
   red llegan a la API.
2. **Servidor de desarrollo** con HTTPS, CORS limitado al origen de la web y
   base sin datos sensibles.

Para cualquiera de las dos:

- `CORS_ORIGINS` debe listar solo el origen real de la web.
- `MONICA_REVIEW_ENABLED=false` salvo acuerdo sobre la licencia.
- `GEMINI_CALLS_ENABLED=false`.
- Diego/Julio configuran `API_INTERNAL_URL` con la URL entregada.
- Datos permitidos: snapshot piloto Landsat, rectángulos demo rotulados y
  catálogo de estaciones; no registros MÓNICA sin permiso.

## Fixtures

- Escenario `valle` (predeterminado): las tendencias responden `unavailable`
  igual que la API real; `demo_trends` siguen visibles como vista previa.
- `/v1/territories/districts` responde `unavailable`. No se crearon distritos
  ni series «oficiales» sintéticos: se confundirían con resultados aceptados.
- El POST del asistente no tiene fixture: el servidor de fixtures solo
  acepta GET. Diego puede maquetar DF07 con los estados de `AskResponse`
  (`answered`, `ungrounded`, `unavailable`, `rejected`, `error`).
