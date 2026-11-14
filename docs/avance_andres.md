# Avance de Andrés — AF01 a AF11

Fecha: **14 de noviembre de 2026**. Integrado sobre `18f4829` (Mateo/Eduardo/Julio
en `main`) y listo para subir.

## Validación post-integración (14/11/2026, noche)

| Control | Resultado |
| --- | --- |
| `uv run ruff check .` / `ruff format --check .` | Pasan |
| `uv run --group science pytest -q` | 98 pasan, 13 omitidas |
| Contratos regenerados | Sin drift respecto a OpenAPI |
| `npm run lint` / `typecheck` / `build` | Pasan |
| `npm run test:e2e --workspace @cocha/web` | 97 pasan, 7 omitidas |
| `./scripts/check_containers.ps1` | 111 pasan; `alembic check` limpio; ciclo 0003 OK |

Conflictos del pull: solo `apps/web/test/fixtures/domain.mjs` (combinadas las
rutas `/v1/territories/districts` y `/v1/jobs` con MÓNICA). Ajustes de
compatibilidad: import oficial por `(boundary_version, number)`, prueba WMS
con clave vacía y aserción del bloqueador de Eduardo.

## Validación anterior (14/11/2026, tarde)

| Control | Resultado |
| --- | --- |
| `uv run ruff check .` / `ruff format --check .` | Pasan (se reformateó `routes/domain.py`) |
| `uv run --group science pytest -q` | 94 pasan, 6 omitidas (integración sin PostGIS local) |
| Contratos regenerados | Sin cambios respecto a lo entregado |
| `npm run lint` / `npm run typecheck` / `npm run build` | Pasan |
| `npm run test:e2e --workspace @cocha/web` | 46/46 pasan |
| `./scripts/check_containers.ps1` (stack aislado, DB efímera) | 100 pasan; `alembic check` sin diferencias; `downgrade base` → `upgrade head` (incluye 0003) → `check` correctos |

Correcciones hechas durante la validación:
- `tests/unit/test_auth.py`: dos líneas quedaban fuera del `patch` y dependían
  del `.env` local; y con FastAPI 0.162 `app.routes` agrupa routers, por lo
  que la prueba «sin POST» pasaba sin comprobar nada. Ahora recorre OpenAPI y
  verifica que `/v1/assistant/ask` exige el rol `assistant`.
- `tests/unit/test_security_and_exports.py`: la fila simulada de trabajos
  incluye los campos nuevos.
- `apps/web/test/e2e/explorer.spec.ts`: localizadores ambiguos tras el HUD 3D
  (región y etiqueta «Variable» duplicadas); ahora son exactos.
- Se instaló el navegador de Playwright (faltaba tras una actualización).

### Cobertura de integración añadida (14/11/2026, noche)

`tests/integration/test_lifecycle_and_publication.py` (solo con
`RUN_DB_TESTS=1` y una base cuyo nombre termina en `_test`; filas sintéticas
que se borran al terminar). Sobre el stack aislado: **105 pasan**,
`alembic check` sin diferencias.

| Camino | Qué se comprueba |
| --- | --- |
| `start_run`/`finish_run` | `started` → `already_running` → `retrying` (intento 2) → `exhausted`; una ejecución completada nunca se repite |
| `recover_stale` | El modo de prueba solo lista; `apply` marca `interrupted`/`stale_heartbeat` únicamente la ejecución sin latido y permite reintentarla |
| `CentralBudgetLedger` | 12 reservas concurrentes con margen para 5: exactamente 5 `reserved` y 7 `exceeded`; `duplicate` al repetir; la conciliación se aplica una sola vez |
| Carga y publicación | La carga queda en borrador y no aparece en `/v1/series`; repetirla da `already_completed`; `publish_results` en modo de prueba no cambia nada y con `--apply` acepta 1 fila; luego la serie muestra valor, unidades, estado y procedencia; filtros y período invertido (422) |
| Rectángulos demo | Nunca aparecen en `/v1/territories/districts` ni en `/v1/series` |

Defecto encontrado y corregido: `load_district_indicators.py` sumaba
`rowcount`, que con `INSERT … ON CONFLICT` ejecutado desde la sesión ORM vale
`-1`; informaba `inserted=-1, skipped=2`. Ahora cuenta con `RETURNING`.

Fallo intermitente corregido: en Windows, el ledger por archivo
(`science/assistant.py`) escribía un byte inicial en el archivo de bloqueo y,
si dos procesos lo veían vacío a la vez, uno recibía `PermissionError`
(`test_processes_share_a_single_file_budget`). Ya no escribe: Windows permite
bloquear más allá del final del archivo. Suite local: 94 pasan, 11 omitidas
(integración); la prueba del ledger pasó 5 de 5 repeticiones.

No se hizo commit, push ni despliegue, no se llamó a Gemini, no se leyó `.env`
y no se tocó la base de desarrollo.

## Estado por tarea

| ID | Estado | Resumen |
| --- | --- | --- |
| AF01 | En revisión | Matriz en `docs/matriz-alcance.md`; seis decisiones pendientes del equipo |
| AF02 | En curso (sin validar) | Corregidos dos defectos de esquema y la idempotencia de scripts; validación aislada documentada, no ejecutada |
| AF03 | En curso | Contratos regenerados, fixtures alineadas, guía `docs/api-compartida.md`; entorno compartido sin desplegar (decisión pendiente) |
| AF04 | Parcial; bloqueado por datos | Persistencia, carga, aceptación y API filtrada/paginada listas; sin vector oficial (EF03) ni estadísticas aceptadas (MF04/MF05) |
| AF05 | Parcial; bloqueado por datos | Rol `reviewer`, filtros, `observed_at_raw`; agregados siguen apagados hasta MF06 |
| AF06 | Bloqueado | Contrato de entrega y verificador de artefactos; sin modelo aceptado no hay inferencia ni escenarios |
| AF07 | Implementado, llamadas apagadas | Adaptador, citas, límites, timeout, caché, cuota y ledger central (probado con concurrencia); API y precios reverificados el 14/11/2026 |
| AF08 | Implementado (mínimo) | Roles por secreto de servidor; **no** es un sistema de cuentas |
| AF09 | Implementado (sin cola) | Estados, idempotencia, reintentos acotados, recuperación, publicación atómica |
| AF10 | Documentado | HTTPS, DB privada, privilegios mínimos, alertas, costos y rollback; entorno sin decidir |
| AF11 | En curso | Revisión de coherencia hecha y corregida; pendiente la validación del equipo |

## Cambios concretos

### AF01 — alcance
- `docs/matriz-alcance.md`: usuarios, funciones (obligatorias, condicionales y
  excluidas), criterios de aceptación, responsables, bloqueos y decisiones
  pendientes. No se eliminó ninguna función prometida; APK queda excluido por
  indicación del usuario (producto solo web).

### AF02 — estabilización
- **Defecto corregido**: `districts.number` era único en toda la tabla, así
  que el vector oficial no podía convivir con los rectángulos demo. La
  migración 0003 pasa a unicidad `(boundary_version, number)`, y
  `scripts/import_demo_districts.py` solo busca filas demo.
- **Defecto corregido**: la unicidad de `district_indicators` incluía
  `processing_run_id` nullable; en PostgreSQL dos `NULL` no chocan, así que se
  podían duplicar filas. Ahora usa `NULLS NOT DISTINCT`.
- `scripts/register_processing_run.py`: `--idempotency-key` evita duplicados.
- `services/workers/offline_runner.py`: con base de datos usa el ciclo de vida
  idempotente (`run_offline_idempotent`); `run_offline` se conserva para sus
  pruebas existentes.
- Revisado sin cambios: importador MÓNICA (transacciones separadas de
  auditoría y datos, observaciones inmutables al reimportar).

### AF03 — API compartida y contratos
- `packages/shared/openapi.json` y `src/api.d.ts` regenerados.
- `docs/api-compartida.md`: endpoints nuevos, errores, roles, opciones de
  entorno compartido sin publicar puertos, datos permitidos.
- Fixtures: `/v1/territories/districts` en estado `unavailable`; las tendencias
  de `valle` ahora responden `unavailable` como la API real. Antes la fixture
  decía `available` y el explorador mostraba «El servidor publicó tendencias
  por distrito», lo cual era falso.

### AF04 — territorios, indicadores, series y tendencias
- Migración `0003_publication_and_job_lifecycle.py`: estado de publicación,
  aceptación y procedencia; índice para consultas de series.
- `GET /v1/territories/districts`: versiones oficiales (excluye demo),
  paginación y GeoJSON opcional; con varias versiones exige elegir una.
- `GET /v1/series`: `official_items` aceptados con filtros (versión, distrito,
  variable, estadístico, período), paginación con `has_more`, unidades,
  `valid_fraction`, `n` y procedencia. Sin filas aceptadas sigue `unavailable`.
- `GET /v1/trends`: `official_trends` aceptados; el resto se mantiene.
- `scripts/load_district_indicators.py`: carga JSON Lines validado (sin
  NaN, períodos ordenados, procedencia obligatoria, rechaza versiones demo),
  idempotente por checksum, todo o nada, siempre como `draft`.
- `scripts/publish_results.py`: aceptar o retirar resultados de una ejecución;
  simulación por defecto y `--accepted-by` obligatorio.
- Los rectángulos demo no se convierten en distritos en ningún camino.

### AF05 — MÓNICA
- `/v1/stations/{id}/observations`: además de `MONICA_REVIEW_ENABLED`, exige
  el rol `reviewer`. Filtros por `quality_flag` y rango de fecha; se rechazan
  fechas con huso porque el de la fuente no está verificado.
- Devuelve `observed_at_raw` (texto original) junto al valor parseado.
- `apps/web/src/lib/api.ts`: el servidor Next reenvía `API_REVIEWER_TOKEN`
  solo en esa consulta (variable de servidor, sin `NEXT_PUBLIC_`).
- No se añadieron agregados físicos: dependen de MF06.

### AF06 — modelos y escenarios
- `services/api/src/cocha_api/science/model_registry.py`: manifiesto
  `ModelManifest`, `verify_artifact` (ruta contenida, formatos sin ejecución
  de código, SHA-256) y `out_of_domain`.
- La base rechaza un modelo `accepted` sin versión, checksum, incertidumbre y
  dominio. `/v1/models` lista `accepted_models` solo si existen.
- `docs/model-delivery.md`: qué entrega Mateo y cómo se publica. Inferencia y
  escenarios siguen bloqueados.

### AF07 — Gemini
- `services/api/src/cocha_api/science/gemini.py`:
  - evidencia numerada del snapshot piloto;
  - instrucciones científicas (LST no es temperatura del aire, asociación no es
    causalidad, datos demo identificados);
  - validación de citas: una respuesta sin citas válidas, o con citas
    inventadas, se retiene como `ungrounded`;
  - parser defensivo de la respuesta del proveedor;
  - los tokens de razonamiento se cuentan como salida;
  - caché LRU;
  - `CentralBudgetLedger` sobre PostgreSQL;
  - `GeminiHttpProvider`, que no se puede construir con las llamadas apagadas;
  - `FakeTextProvider`, identificado para pruebas.
- `POST /v1/assistant/ask`:
  - controles en orden: rol `assistant`, límite de pregunta, cuota por cliente
    y global, reserva central;
  - timeout acotado;
  - conciliación idempotente: repetir un `request_id` reproduce la respuesta
    guardada; si el costo es desconocido, se cobra la reserva completa.
- `GET /v1/assistant`: `available` solo con `GEMINI_CALLS_ENABLED=true`, clave y
  precios verificados; indica qué ledger usa.
- **Verificación (14/11/2026)** contra
  [precios](https://ai.google.dev/gemini-api/docs/pricing) y la
  [referencia de generateContent](https://aistudio.google.com/api-reference/generate-content):
  - `gemini-3.6-flash`, nivel de pago: 0.75 USD (entrada) y 3.75 USD (salida,
    **incluidos los tokens de razonamiento**) por millón hasta el 31/12/2026.
    **Desde el 1/1/2027 se duplican (1.50 / 7.50)**: actualizar
    `GEMINI_*_USD_PER_MILLION_TOKENS` y `GEMINI_PRICES_VERIFIED_ON` antes de
    usarlo en 2027. `gemini-3.8-flash` (más reciente) tiene la misma tarifa;
    cambiar de modelo es una decisión del equipo.
  - `POST /v1beta/models/{model}:generateContent`; `usageMetadata` trae
    `promptTokenCount`, `candidatesTokenCount` y `thoughtsTokenCount`, que el
    adaptador suma como salida. Coincide con `parse_generate_content`.
  - Estimación con los límites actuales (12 000 caracteres de contexto ≈ 3–4 mil
    tokens; 600 tokens de salida): ≈ 0.005 USD por pregunta en 2026 y ≈ 0.011
    en 2027, por debajo de la reserva de 0.02. Es una cota calculada, no una
    medición.

### AF08 — permisos
- `core/auth.py`:
  - roles `operator`, `reviewer` y `assistant`, cada uno con su secreto de al
    menos 24 caracteres;
  - comparación en tiempo constante;
  - `require_write_token` también corregido (antes comparaba con `!=`).
- `core/config.py`, `.env.example` y `compose.yaml`: solo nombres de variables,
  con valores vacíos o apagados.
- Limitación explícita: son secretos compartidos por capacidad, sin cuentas,
  auditoría individual ni rotación automática.

### AF09 — trabajos
- `services/api/src/cocha_api/jobs.py`:
  - `start_run` confirma la decisión antes de ejecutar y es seguro ante
    carreras por la clave única;
  - estados `started`, `retrying`, `already_completed`, `already_running` y
    `exhausted`, con intentos acotados por `JOB_MAX_ATTEMPTS`;
  - `heartbeat`, `finish_run` (códigos cortos, sin texto de excepción),
    `recover_stale` y `publish_file` (atómica, idempotente, no sobrescribe).
- `scripts/recover_jobs.py`: simulación por defecto, `--apply` explícito.
- `GET /v1/jobs`: filtros `kind`/`status` y campos `attempt`, `heartbeat_at`,
  `error_code`.
- Sin cola: los procesos son lotes offline de operador. Ciencia y descargas
  siguen fuera de HTTP.

### AF10 — producción
- `docs/deployment.md` cubre:
  - HTTPS, DB privada y secretos;
  - costos y alertas de facturación;
  - salud, disco y trabajos colgados;
  - despliegue con comprobación previa de duplicados y rollback de aplicación
    sin bajar el esquema;
  - procedimiento de respaldo de Eduardo, marcado como no ensayado.
- `infrastructure/postgres/least_privilege.sql`: plantilla de roles
  `cocha_migrator`, `cocha_api` y `cocha_worker`, sin ejecutar.

### AF11 — coherencia
- Corregidos: fixture de tendencias; documentación que decía «solo GET» y
  «ledger sin coordinación»; head de Alembic en `docs/data-model.md`; pruebas
  que exigían cero rutas POST (ahora verifican que la única exige rol).

## Archivos modificados

Nuevos:
- Migración: `services/api/migrations/versions/0003_publication_and_job_lifecycle.py`.
- Código de la API: `services/api/src/cocha_api/jobs.py`,
  `services/api/src/cocha_api/science/gemini.py` y
  `services/api/src/cocha_api/science/model_registry.py`.
- Scripts: `scripts/load_district_indicators.py`, `scripts/publish_results.py`
  y `scripts/recover_jobs.py`.
- Pruebas: `tests/unit/test_gemini_adapter.py` y
  `tests/unit/test_jobs_and_registry.py`.
- Infraestructura: `infrastructure/postgres/least_privilege.sql`.
- Documentación: `docs/avance_andres.md`, `docs/matriz-alcance.md`,
  `docs/api-compartida.md` y `docs/model-delivery.md`.

Modificados:
- Núcleo de la API: `services/api/src/cocha_api/core/auth.py`,
  `core/config.py` y `db/models.py`.
- Rutas: `routes/domain.py`, `routes/territories.py` y `routes/assistant.py`.
- Esquemas: `schemas/availability.py` y `schemas/assistant.py`.
- Procesos y scripts: `services/workers/offline_runner.py`,
  `scripts/register_processing_run.py` y `scripts/import_demo_districts.py`.
- Pruebas: `tests/unit/test_auth.py`.
- Web y fixtures: `apps/web/src/lib/api.ts`,
  `apps/web/test/fixtures/domain.mjs` y `apps/web/test/fixtures/valley.mjs`.
- Contratos generados: `packages/shared/openapi.json` y
  `packages/shared/src/api.d.ts`.
- Configuración: `.env.example` y `compose.yaml`.
- Documentación: `docs/architecture.md`, `docs/data-model.md`,
  `docs/deployment.md`, `docs/security-notes.md`,
  `docs/tareas_pendientes_finales.md` y `CONTINUAR_EN_CURSOR.md`.

## Qué necesita cada persona

| Persona | Entrega que desbloquea |
| --- | --- |
| Eduardo | EF02/EF03: vector oficial importado como `boundary_version` propia (no `demo-synthetic-*`) con `source_url`; EF04/EF05: huso, coordenadas, QA y permiso MÓNICA; EF10: ensayo de restauración en base nueva |
| Mateo | MF04: JSON Lines según `IndicatorRecord` en `scripts/load_district_indicators.py`; MF05: `trend_results` con método e intervalo; MF06: reglas de agregación MÓNICA; MF08/MF09: manifiesto según `docs/model-delivery.md`; firmar aceptaciones |
| Diego | DF03: `/v1/territories/districts`; DF04: `official_items`/`official_trends`; DF05: `observed_at_raw` y filtros; DF07: maquetar estados de `AskResponse` llamando desde el servidor |
| Julio | JF02: ejecutar la suite web con las fixtures actualizadas; JF05: probar contra la API compartida cuando exista; revisar la matriz AF01 |

## Bloqueos y decisiones pendientes

- Vector oficial de distritos (EF02/EF03): bloquea AF04 con datos reales.
- Estadísticas y tendencias aceptadas (MF04/MF05).
- Validación MÓNICA (MF06) y licencia de redistribución.
- Modelo aceptado (MF08): bloquea AF06.
- Decisiones del equipo: alcance de funciones condicionales; autorizar gasto
  de Gemini; entorno de la API compartida y del despliegue; firmantes de
  aceptación; licencia del código.
- Reverificar en fuentes oficiales el endpoint y los precios de Gemini.

## Comandos de validación (para el equipo; no ejecutados)

Backend (Andrés), sin base:

```powershell
uv sync --group dev --group science
uv run ruff check .
uv run ruff format --check .
uv run --group science pytest -q
```

Migraciones, **solo en una base exclusiva de pruebas con PostGIS** (nunca la de
desarrollo):

```powershell
# Stack aislado existente (DB efímera, sin .env ni datos crudos): migra y ejecuta pruebas.
./scripts/check_containers.ps1
# Ciclo explícito de la 0003, con DATABASE_URL apuntando a una base de pruebas aislada:
uv run alembic upgrade head
uv run alembic check
uv run alembic downgrade 0002
uv run alembic upgrade head
$env:RUN_DB_TESTS = "1"; uv run pytest -q -m integration
```

Contratos (sin diferencias tras regenerar):

```powershell
uv run python scripts/export_openapi.py
npm run contracts:generate
git diff --exit-code -- packages/shared
```

Web (Diego/Julio):

```powershell
npm run lint
npm run typecheck
npm run build
npm run test:e2e --workspace @cocha/web
```

Scripts en seco:

```powershell
uv run python scripts/load_district_indicators.py <entrega.jsonl> --dry-run
uv run python scripts/recover_jobs.py
uv run python scripts/publish_results.py district_indicators --processing-run-id <uuid> --accepted-by "<nombre>"
```

Docker sin imprimir secretos:

```powershell
docker compose --env-file .env.example config --quiet
```
## Riesgos conocidos y requisitos antes de desplegar

- Ciclo de vida, ledger central, carga y publicación ya tienen pruebas de
  integración con PostGIS, pero con datos sintéticos: falta un ensayo con una
  entrega real de MF04/MF05 y el vector oficial (EF03).
- Los precios de Gemini se duplican el 1/1/2027; la configuración debe
  actualizarse antes.
- La migración 0003 falla si ya hay indicadores duplicados con
  `processing_run_id` nulo; su downgrade falla si demo y oficial comparten
  número. Consultas previas en `docs/deployment.md`.
- Cuotas del asistente y del WMS en memoria por proceso: con varias réplicas,
  la cuota efectiva se multiplica (el presupuesto central sí es global).
- `GEMINI_RESERVE_USD_PER_REQUEST=0.02` es una cota inicial, no una medición:
  si el modelo razona mucho, el costo real podría superarla y se cobraría el
  real. Revisar tras las primeras llamadas autorizadas.
- Un token de revisor configurado en la web expone los registros MÓNICA a
  cualquiera que abra esa página.
- Los roles no son cuentas: un token filtrado concede la capacidad completa
  hasta rotarlo.
- Antes de desplegar: validación completa en verde sobre el mismo commit,
  ensayo de restauración (EF10), decisión de entorno, HTTPS, privilegios
  mínimos aplicados y autorización de entrega.

## Si se interrumpe, continuar desde aquí

1. Hecho: validación backend, web, e2e y migraciones en stack aislado.
2. Hecho: pruebas de integración de ciclo de vida, ledger, carga y publicación.
3. Hecho: API y precios de Gemini reverificados (actualizar antes de 2027).
4. Pedir a Diego los cambios DF03–DF07 y a Julio la revisión de la matriz.
5. Cerrar las decisiones pendientes de `docs/matriz-alcance.md`.
