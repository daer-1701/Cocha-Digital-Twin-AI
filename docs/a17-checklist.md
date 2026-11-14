# A17 — checklist de validación integral

No sustituye una corrida independiente con datos oficiales. Marcar solo lo
verificado en local el 14 de noviembre de 2026.

| Ítem | Estado |
| --- | --- |
| A01 `./scripts/check_containers.ps1` | Hecho: 67 passed el 14/11/2026 (`docs/a01-validation.md`) |
| Contratos de disponibilidad y OpenAPI | Hecho en local, regenerar tras cambios de esquema |
| Ingesta Landsat piloto + `/v1/explorer` | Hecho en el MVP previo |
| WMS GAMC (proxy, allowlist, sin clave = 503) | Hecho en código; no probado contra el servicio real en esta pasada |
| Vector oficial de 15 distritos | Bloqueado. Falta el archivo o servicio de features autorizado |
| Fixture demo `demo-synthetic-v1` | Hecho como fixture. No es un límite GAMC |
| Indicadores y tendencias oficiales | Bloqueados. La API solo publica medias y pendientes demo si esas filas existen |
| Import MÓNICA | Parcial: unidad `ug/m3` declarada; huso, coordenadas y licencia pendientes |
| Modelos y escenarios (A10–A12) | Cerrados como bloqueados (`docs/andres-blockers.md`) |
| Runner local sin Celery | Hecho: `services/workers/offline_runner.py`. No es una cola de producción |
| Gemini con llamada real acotada | Pendiente a propósito. Precios verificados; llamadas apagadas |
| `require_write_token` | Probado. No hay POST público; CORS solo GET |
| Pruebas de navegador (D15, JF02) | Hecho con fixtures 14/11/2026 sobre `9bbbe8f` y `5458edd`: 108 pasan, 7 incidencias abiertas como `test.fixme` (`docs/qa-report.md`); falta contra la API real |
| Despliegue no local (A18) | Pendiente |

Pendiente de una reproducción con PostGIS de prueba: importar el fixture demo
y los CSV MÓNICA, y comprobar las filas. Las pruebas unitarias no abren la
base de desarrollo.
