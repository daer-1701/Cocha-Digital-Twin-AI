# Plan de trabajo — Andrés y Diego

## Reparto y punto de partida

**Andrés:** arquitectura, GIS, procesamiento, estadística, modelos, backend,
seguridad e infraestructura. Aquí quedan las tareas de mayor complejidad técnica.

**Diego:** experiencia de usuario, frontend, visualización, investigación de
fuentes, pruebas de navegador y presentación. **Ninguna tarea de Diego exige
Docker, PostgreSQL local ni ejecutar los workers de Andrés.**

Ya existe un piloto con tres escenas Landsat, LST/NDVI, QA, snapshot, API,
mapa y tabla. No rehacerlo. Estas tareas amplían y endurecen esa base. Revisar
el código actual antes de comenzar: el estado puede avanzar respecto a este plan.

El alcance completo incluye los siete módulos del documento original. Las
capacidades dependientes de datos solo se consideran implementadas y validadas
cuando hay evidencia suficiente; una interfaz vacía no equivale a integración.

## Recursos GAMC confirmados — actualización del 14/11/2026

Consultar [entrega GAMC](gamc-resources.md) y `data/catalog/gamc.json` antes de
A03, A08, A09, D01, D04, D05 y D09. El ZIP y los CSV MÓNICA ya están descargados
en `data/raw/gamc/monica/`; no repetir descarga ni sobrescribirlos.
Comando idempotente para otro clon: `python scripts/download_gamc.py`.

La adquisición local está completada; la limpieza e integración siguen pendientes.
La capa distrital anunciada es WMS y aún no se obtuvo un vector completo.
Los CSV son PM10 de Kanata/Semapa, con ceros y negativos; unidad, horario y
coordenadas deben confirmarse. No son temperatura del aire para calibrar LST.
Diego sigue trabajando sin Docker ni claves municipales en frontend.

## Cómo usar los prompts

Cada bloque es un prompt para pegar en Codex o Cursor desde la raíz del proyecto.
Ejecutar **una tarea por conversación**, siguiendo sus dependencias. Los prompts
autorizan trabajo local en su alcance; no autorizan gastos, envío de mensajes,
publicación, push ni operaciones destructivas sobre datos existentes.

Al comenzar, el agente debe leer `AGENTS.md`, reglas del área y el código
afectado; revisar Git y preservar cambios ajenos. Al terminar, entregar diff,
validaciones reales y pendientes. No marcar completado algo que no se ejecutó.

Los prompts mencionan skills por su nombre para funcionar en ambos editores.
Codex permite `$nombre`; Cursor permite buscarlas con `/`.

## Entorno de Diego: siempre sin Docker

Requisitos: Git, Node.js 22 y npm. A partir de D02:

```powershell
npm ci
# Terminal 1: servidor local de fixtures creado por D02
npm run dev:fixtures
# Terminal 2
npm run dev
```

La web debe consultar el servidor de fixtures mediante `API_INTERNAL_URL` en
`apps/web/.env.local`: `http://127.0.0.1:8100`, distinto al puerto 8000 de la
API real. Las fixtures son sintéticas y se rotulan permanentemente como demo.
Escenarios y uso: `apps/web/test/fixtures/README.md` (D02).

Para integrar datos reales, Andrés proporcionará una API de desarrollo accesible
por un canal acordado o un snapshot sanitizado compatible. `localhost` de Diego
no apunta a la computadora de Andrés. Los cambios de URL quedan en variables
locales, sin secretos en código ni configuración personal versionada.

No exponer una API públicamente ni abrir puertos del equipo solo para cumplir
este plan. Diego puede terminar sus pantallas con fixtures; se registra por
separado la integración real pendiente.

## Límites de edición

| Área | Responsable de integración |
| --- | --- |
| `services/`, ciencia, Python, migraciones, Docker y CI | Andrés |
| `apps/web/`, componentes y pruebas de navegador | Diego |
| Pydantic, OpenAPI y tipos generados de `packages/shared/` | Andrés; Diego los consume |
| Fixtures Node del frontend | Diego, siguiendo el contrato acordado |
| `package-lock.json` y dependencias npm | Diego; coordinar cualquier cambio de Andrés |
| `uv.lock` y dependencias Python | Andrés |
| Documentación general y reglas | Coordinar archivo antes de editar |

Cada persona trabaja en su clon o worktree. No ejecutar instalaciones o builds
simultáneos sobre la misma carpeta. Para cambios de contrato: Andrés propone
ejemplos y tipos; Diego confirma que permiten la pantalla; Andrés regenera y
versiona; Diego actualiza fixtures y cliente. No mantener tipos copiados a mano.

## Orden recomendado

| Fase | Andrés | Diego | Salida conjunta |
| --- | --- | --- | --- |
| 1. Preparar | A01–A04 | D01–D03 | Entornos separados, datos y contrato definidos |
| 2. Observatorio real | A05–A06, A08 | D04–D05, D08–D09 | Mapa y series por distritos verificados |
| 3. Evidencia científica | A07, A09–A11 | D06–D07, D10 | Tendencias y estimaciones evaluadas |
| 4. Herramientas | A12–A15 | D11–D13 | Escenarios, asistente e informes |
| 5. Entrega | A16–A18 | D14–D16 | Seguridad, integración y demo reproducible |
| Opcional | Soporte científico si procede | D17 | 3D solo si aporta información |

Las fases no autorizan saltarse dependencias. A13 puede adelantarse si la
ingesta por lotes ya necesita orquestación. D08 puede empezar sobre fixtures.

## Lista maestra

La integración de las tareas permanece **pendiente**; la adquisición MÓNICA
ya está completada y una parte del código reutilizable puede existir. «Depende» identifica resultados previos, no instalación de Docker
para Diego. ★ indica las tareas científicas o técnicas más difíciles.

### Estado Andrés — 14/11/2026

| ID | Estado | Notas |
| --- | --- | --- |
| A01 | Completado | `check_containers.ps1` OK (67 passed) el 14/11/2026 |
| A02 | Completado | Contratos de disponibilidad |
| A03 | Parcial | WMS listo. Vector oficial GAMC bloqueado. Fixture demo `demo-synthetic-v1` solo para UI/dev; no es un límite municipal |
| A04 | Completado | Migración `0002` |
| A05 | Completado (piloto) | Landsat modular |
| A06 | Parcial (demo) | `/v1/indicators` `available` solo con distritos demo y reason de vector oficial ausente. Sin distritos: `unavailable` |
| A07 | Parcial | `pilot_trends` y, si hay indicadores demo, pendientes en `demo_trends`. Inferencia oficial bloqueada |
| A08 | Parcial | `unit_declared=ug/m3` desde el informe citado; `analysis_enabled=false`. Huso, coordenadas y licencia pendientes (`docs/monica-status.md`) |
| A09 | Completado | Viabilidad negativa LST↔PM10 |
| A10–A12 | Cerrado como bloqueado | Sin variable objetivo compatible. `/v1/models` y `/v1/scenarios` siguen `unavailable` (`docs/andres-blockers.md`) |
| A13 | Parcial | Lectura de jobs, registro y `services/workers/offline_runner.py` (QA local, sin Celery/Redis) |
| A14 | Parcial | Precios verificados el 14/11/2026; llamadas reales apagadas hasta autorización explícita |
| A15 | Completado (piloto) | Export de observación; informe distrital formal bloqueado |
| A16 | Parcial | `require_write_token` documentado y probado. API pública solo GET. Sin roles de usuario |
| A17 | Parcial | Checklist actualizado con A01 en pass y bloqueos restantes. Sin validación e2e con datos oficiales |
| A18 | Parcial | Borrador de operación actualizado. Sin despliegue productivo ni backup probado |

El vector oficial de A03 sigue bloqueado. `data/fixtures/demo_districts.geojson`
y `scripts/import_demo_districts.py` sirven 15 rectángulos sintéticos
(`boundary_version=demo-synthetic-v1`) solo para interfaz y desarrollo. No son
distritos municipales. Sin esas filas, `/v1/indicators` permanece `unavailable`.

### Estado Diego — 14/11/2026

Verificado con fixtures sintéticas de D02, no con la API real de Andrés.

| ID | Estado | Notas |
| --- | --- | --- |
| D01–D03 | Completado | Matriz de requisitos, fixtures sin Docker y estructura UX |
| D04 | Completado (código) | Selector consume `/v1/territories`; distritos deshabilitados con el motivo del servidor; WMS pasa a capa del mapa |
| D05 | Parcial | Capas WMS por proxy de Next.js y comparación de dos fechas; sin probar contra el WMS municipal real; sin capas por distrito (A06) |
| D06 | Completado (piloto) | Gráfico en escala fija con huecos; `pilot_trends` como pendiente descriptiva, no inferencial; tendencia distrital bloqueada con A07 |
| D07 | Bloqueado | Requiere vector distrital, A06 y A07 |
| D08 | Parcial | Panel de procedencia con campos del contrato; falta verificar con un snapshot real |
| D09 | Completado (catálogo) | Ubicación descrita, unidad con fuente y metadatos pendientes traducidos; sin series PM10 en la API (A08) |
| D10–D11 | Parcial (estado) | Muestran motivo y bloqueos del servidor; modelos y escenarios no viables con los datos actuales |
| D12 | Parcial (estado) | Presupuesto, modelo, precios verificados con fecha y fuente; llamadas desactivadas en el servidor |
| D13 | Completado (piloto) | `/informes` con selección, vista previa y descargas CSV/JSON de `observation_export`; falta comparar con un informe real |
| D14 | Completado | Auditoría en `docs/ux.md`: 0 px de desbordamiento a 320/390 px, teclado, nombres e ids; corregido un id duplicado |
| D15 | Completado | 45 pruebas Playwright sobre fixtures validadas contra OpenAPI; ejecución en el job `web` de CI |
| D16 | Parcial | `docs/manual.md` con manual, guion y plan B; faltan capturas de un caso real y resultados A17 |
| D17 | Completado (decisión) | 3D omitido y justificado en `docs/ux.md`: sin DEM ni alturas, celdas de unos 360 m |

| ID | Responsable | Tarea | Depende |
| --- | --- | --- | --- |
| A01 | Andrés | Estabilizar base, contenedores y CI | — |
| A02 | Andrés | Contratos completos y estados de disponibilidad | D01 |
| A03 ★ | Andrés | Adaptador WMS GAMC y vector distrital completo | D01; importación DB tras A04 |
| A04 ★ | Andrés | Persistencia y trazabilidad en PostGIS | A02 |
| A05 ★ | Andrés | Ingesta multitemporal y QA robusto | A01, A03, A04 |
| A06 ★ | Andrés | Indicadores por distrito y anomalías | A05 |
| A07 ★ | Andrés | Tendencias e inferencia estadística | A06 |
| A08 | Andrés | QA e ingesta PM10 Kanata/Semapa (archivos descargados) | D01, A04 |
| A09 ★ | Andrés | Fusión espacio-temporal y baseline | A06, A08 |
| A10 ★ | Andrés | ML, validación bloqueada e incertidumbre | A09 |
| A11 | Andrés | Registro de modelos y API de estimaciones | A10, A02 |
| A12 ★ | Andrés | Motor de escenarios con supuestos explícitos | A10, A11 |
| A13 | Andrés | Jobs científicos, reintentos y actualización | A05, A04 |
| A14 ★ | Andrés | Gemini con evidencia y presupuesto | A07, A11, A02 |
| A15 | Andrés | Exportaciones e informes reproducibles | A06, A07, A11 |
| A16 ★ | Andrés | Seguridad, permisos y protección de costos | A11–A15 |
| A17 ★ | Andrés | Validación integral y reproducción independiente | A07–A16, D15 |
| A18 | Andrés | Despliegue, backups y operación | A01, A16, A17 |
| D01 | Diego | Matriz de requisitos y catálogo de fuentes | — |
| D02 | Diego | Desarrollo frontend sin Docker | — |
| D03 | Diego | Estructura UX y componentes visuales | D02 |
| D04 | Diego | Selector territorial y ficha de distrito | D03, A02; integración A03 |
| D05 | Diego | Mapa, capas y comparación temporal | D04; integración A06 |
| D06 | Diego | Series, anomalías y tendencias | D03, A02; integración A07 |
| D07 | Diego | Comparación y priorización de distritos | D04, D06; integración A07 |
| D08 | Diego | Procedencia, calidad y límites de evidencia | D03, A02 |
| D09 | Diego | Estaciones y cobertura terrestre | D05; integración A08 |
| D10 | Diego | Predicciones, incertidumbre y ficha de modelo | D03, A02; integración A11 |
| D11 | Diego | Interfaz de escenarios hipotéticos | D10; integración A12 |
| D12 | Diego | Asistente científico y estados de cuota | D03, A02; integración A14 |
| D13 | Diego | Informes y descargas | D06, D08; integración A15 |
| D14 | Diego | Accesibilidad, responsive y rendimiento | D04–D13 |
| D15 | Diego | Pruebas de navegador y contratos de fixtures | D02, D04–D14 |
| D16 | Diego | Manual, historia científica y demostración | D08, D13, D15, A17 |
| D17 | Diego | Visualización 3D opcional | D05, D14 |

## Prompts para Andrés

### A01 — Estabilizar base, contenedores y CI

```text
Implementa A01 de docs/team-plan.md. Lee AGENTS.md, README.md y docs/mvp.md.
Revisa el piloto actual y preserva los cambios existentes. Comprueba el arranque
desde un clon limpio: instalaciones con lockfiles, contratos, API, web, worker
MapLibre, migraciones y Compose. Usa una base exclusiva de pruebas. Revisa que
los grupos uv de ciencia estén presentes al ejecutar sus pruebas y ausentes
del runtime HTTP cuando no se necesiten. Corrige los fallos reproducibles y
ajusta CI. Entrega comandos, resultados y bloqueos reales; no marques como
validado Docker si su motor no está disponible. No hagas commit ni push.
Aceptación: base reproducible, pruebas pertinentes y documentación coherente.
```

### A02 — Contratos y disponibilidad

```text
Implementa A02 de docs/team-plan.md después de revisar D01. Lee AGENTS.md y el
contrato actual. Define e implementa esquemas Pydantic y endpoints versionados
para catálogo territorial, indicadores, series, tendencias, estaciones, modelos,
escenarios, jobs e informes según el alcance confirmado. Añade cada endpoint
con su lógica disponible o un estado explícito de no disponibilidad; no simules
que la funcionalidad existe. Incluye unidades, procedencia, QA, incertidumbre,
paginación y errores acotados. Acuerda ejemplos de respuesta para Diego,
regenera OpenAPI y tipos desde el backend y prueba límites de contrato.
Aceptación: contratos utilizables por frontend y estados pendientes inequívocos.
```

### A03 — Límites distritales GAMC: WMS y vector completo

```text
Implementa A03 de docs/team-plan.md. Lee AGENTS.md, docs/gamc-resources.md y
data/catalog/gamc.json; usa cocha-geospatial-ingestion. El servicio distrital es
7eb13092-bf0e-493b-aae6-03c43eedda2c en
https://serviciosgamc.cochabamba.bo/api/gs/wms. Entrega por separado:
1) Adaptador backend WMS para GetMap, GetLegendGraphic y GetFeatureInfo según
la documentación, con clave de entorno solo servidor, allowlist de service_id,
CRS y dimensiones acotadas, timeout, caché y respuestas/logs sin claves.
No propagues URLs arbitrarias ni las credenciales del visor al frontend.
2) Obtención e importación idempotente de un vector completo autorizado con
los 15 distritos. WMS/PNG/BBOX no constituyen ese vector. Verifica un enlace de
archivo o servicio de features documentado, licencia, CRS, versión, IDs,
geometrías, solapamientos y completitud. No asumas WFS ni reconstruyas polígonos
desde imágenes o consultas puntuales. Conserva originales y hashes; importa a
PostGIS después de A04. Mientras falte vector, conserva el piloto y un estado
expreso de indisponibilidad para estadísticas distritales. No envíes solicitudes
a terceros automáticamente. Regenera contratos y deja ejemplos para Diego.
Aceptación: pruebas del proxy y de su protección de claves; vector verificado
o bloqueo explícito. La parte WMS no permite marcar completada la parte vectorial.
```

### A04 — Persistencia científica y trazabilidad

```text
Implementa A04 de docs/team-plan.md. Lee AGENTS.md, docs/data-model.md y A02.
Diseña migraciones nuevas para datasets, versiones de límites, assets, ejecuciones,
indicadores, observaciones, resultados y referencias de modelos que requiera el
producto. No alteres migraciones compartidas. Rásteres y modelos permanecen en
almacenamiento de archivos/objetos, referenciados por URI y checksum. Conserva
historia, unidades, parámetros, commit, entorno y unicidad idempotente. Migra la
lectura del piloto a una interfaz de persistencia clara sin perder la demo local.
Prueba upgrade, compatibilidad, restricciones e idempotencia en PostGIS de pruebas.
Aceptación: un resultado puede rastrearse hasta sus entradas y ejecución.
```

### A05 — Ingesta multitemporal y QA

```text
Implementa A05 de docs/team-plan.md. Lee AGENTS.md y usa
cocha-geospatial-ingestion. Extiende scripts/ingest_landsat.py en módulos
reutilizables para cubrir el territorio verificado y un período científicamente
justificado. Implementa paginación acotada, manifiestos, cache por área/producto/
versión, descarga por ventanas y reanudación segura. Revisa máscaras, aerosoles,
ST_QA, escala/offset y sesgos de nubes según documentación oficial del producto.
No mezcles sensores sin armonización documentada ni descargues archivos masivos
para probar. Valida con una muestra real pequeña y fixtures de QA/NoData.
Aceptación: serie reproducible con cobertura, incertidumbre del producto y costos
de procesamiento acotados; lista explícita de datos insuficientes.
```

### A06 — Indicadores territoriales y anomalías

```text
Implementa A06 de docs/team-plan.md con cocha-geospatial-ingestion y
cocha-scientific-validation. Usa límites versionados y los productos de A05.
Calcula agregaciones distritales con soporte espacial común, intersección de
áreas cuando corresponda, cobertura válida y mínimos de aceptación explícitos.
Construye series comparables por estación/mes. Define un período de referencia
justificado para anomalías y rechaza referencias insuficientes. Persiste y sirve
resultados según A02/A04. No conviertas falta de datos en cero ni extrapoles
una escena de julio como media anual. Prueba bordes, unidades y ausencia de datos.
Aceptación: indicadores distritales recalculables y anomalías con referencia visible.
```

### A07 — Tendencias e inferencia

```text
Implementa A07 de docs/team-plan.md usando cocha-scientific-validation.
Evalúa cobertura, estacionalidad, autocorrelación y cambios de sensor de A06
antes de escoger el método. Calcula pendiente en unidades interpretables,
intervalos y contrastes adecuados; define la familia de comparaciones y ajusta
multiplicidad cuando corresponda. Publica n, período, método, p y p ajustado,
incertidumbre y resultados inconclusos. No fuerces significancia con series
escasas. Comprueba series sintéticas con comportamiento conocido, dependencia
temporal y casos constantes/faltantes, y valida un caso real reproducible.
Aceptación: cada conclusión tiene magnitud, incertidumbre y supuestos verificables.
```

### A08 — Red MÓNICA: integrar los CSV PM10 descargados

```text
Implementa A08 de docs/team-plan.md con cocha-geospatial-ingestion y
cocha-scientific-validation. Lee docs/gamc-resources.md, data/catalog/gamc.json
y los manifiestos locales de data/raw/gamc/monica/. Ya están red_monica.zip,
red_monica.kanata (1).csv y red_monica.semapa (1).csv. No los sobrescribas.
Si faltan en este clon ejecuta python scripts/download_gamc.py.
Los campos son estacion, pm10, fecha_medicion. Comprueba hashes y documenta
perfil temporal, huecos, frecuencia, duplicados, valores no finitos y calidad.
Existen 721 negativos en Kanata y 1.499 en Semapa en la descarga inicial;
marcarlos para revisión y excluirlos del análisis físico, preservando originales.
No truncarlos a cero ni eliminar todos los ceros sin conocer los códigos.
Confirma unidad, zona horaria, coordenadas, elevación, instrumentos y licencia.
Reconcilia nombres Kanata/Semapa con las ubicaciones descritas en el portal.
No asignes µg/m³, UTC o coordenadas inventadas. Conserva fecha original y estado
de metadatos; impide publicar agregados físicos mientras esos datos sean ambiguos.
Implementa staging e importación transaccional/idempotente con flags de calidad,
procedencia y API de estaciones/series conforme a A02/A04. Añade agregaciones
solo con mínimos de cobertura justificados. Prueba reimportación, duplicados,
negativos, ceros, fechas inválidas, horario desconocido y faltantes.
No uses PM10 para calibrar LST ni lo presentes como temperatura del aire.
Aceptación: observaciones trazables y QA probado; análisis no habilitado si
faltan metadatos esenciales. Publica para Diego el estado de cada estación.
```

### A09 — Fusión y baseline con objetivo compatible

```text
Implementa A09 de docs/team-plan.md usando cocha-scientific-validation.
Lee docs/gamc-resources.md y los resultados A06/A08. Los archivos municipales
actuales son PM10 de dos estaciones; no proporcionan temperatura del aire.
Define explícitamente si el objetivo es estimar PM10 u otra variable con
referencia independiente válida. Mantén LST/NDVI como observaciones o predictores
según el objetivo; no valides LST contra PM10 ni cambies el objetivo en silencio.
Confirma unidades, calidad, coordenadas y horario antes de emparejar datos.
Justifica soporte temporal/espacial, elevación y disponibilidad de predictores
al momento de la predicción. Construye baseline y evaluación bloqueada con
preprocesamiento ajustado solo en train. Dos estaciones limitan fuertemente
la validación espacial: evalúa suficiencia y no afirmes cobertura fiable para
15 distritos solo por tener muchas fechas en dos lugares.
Si los datos no permiten validación fuera de muestra útil, entrega análisis
de viabilidad y conserva ML como pendiente. No inventes métricas ni intervalos.
Aceptación: objetivo compatible, dataset reproducible y límites de generalización explícitos.
```

### A10 — ML e incertidumbre

```text
Implementa A10 de docs/team-plan.md con cocha-scientific-validation. Compara
el baseline de A09 con Random Forest y/o XGBoost si el volumen lo justifica,
manteniendo los mismos folds. Separa ajuste de hiperparámetros y evaluación final.
Reporta MAE/RMSE en unidades originales y error por zona/período; evalúa cobertura
de intervalos predictivos. Añade detección de fuera de dominio y abstención.
Versiona entradas, código, entorno, semilla, variables, artefactos y model card.
No uses deep learning sin justificación ni presentes métricas de entrenamiento
como calidad de predicción. Ejecuta primero experimentos de tamaño acotado.
Aceptación: modelo con ventaja demostrada o decisión documentada de conservar baseline.
```

### A11 — Registro y servicio de estimaciones

```text
Implementa A11 de docs/team-plan.md. Lee AGENTS.md y usa la evidencia de A10.
Crea registro de modelos, estados de validación y un servicio de inferencia
separado del entrenamiento. Carga solo artefactos confiables y versionados.
La respuesta debe incluir objetivo, unidad, intervalo predictivo, versión,
período de entrenamiento, métricas, variables y estado fuera de dominio.
No permitir entrenamientos ni URLs arbitrarias de modelos desde endpoints
públicos. Prueba contratos, modelo ausente/inválido y abstención. Regenera tipos.
Aceptación: estimación trazable, con límites y sin esconder fallos detrás de ceros.
```

### A12 — Simulador de escenarios

```text
Implementa A12 de docs/team-plan.md con cocha-scientific-validation. Define
qué escenarios permiten los modelos validados: áreas verdes y cobertura de
superficie, parámetros, rangos, restricciones y variables que permanecen fijas.
Separa escenario hipotético de observación e inferencia causal. No interpretes
un cambio de NDVI en un regresor como efecto demostrado de plantar árboles.
Expón escenario base, intervención, resultado, incertidumbre, modelo y supuestos.
Si no existe modelo defendible, implementa el estado no evaluable y documenta
qué validación falta. Prueba límites, fuera de dominio y trazabilidad.
Aceptación: exploración hipotética honesta y reproducible, sin promesas causales.
```

### A13 — Procesamiento asíncrono y actualización

```text
Implementa A13 de docs/team-plan.md. Lee AGENTS.md y services/workers/README.md.
Orquesta ingesta y procesamiento fuera de peticiones HTTP. Añade Celery/Redis
solo si los trabajos y la concurrencia lo justifican. Usa claves idempotentes,
estados persistidos, reintentos acotados, progreso, cancelación cooperativa y
publicación atómica. Limita área, período, concurrencia y tamaño de trabajo.
La actualización programada debe evitar ejecuciones superpuestas y registrar
la frescura de los datos. Prueba recuperación tras fallo sin duplicar resultados.
Aceptación: jobs observables y recuperables; Redis no es la única persistencia.
```

### A14 — Gemini y presupuesto

```text
Implementa A14 de docs/team-plan.md usando cocha-gemini-budget. Verifica en
documentación oficial de Google el modelo económico, SDK y tarifas vigentes.
Integra desde backend con contexto de resultados estructurados y citas a IDs
de evidencia. El asistente explica, no fabrica cifras ni sustituye análisis.
Implementa límites de entrada/salida, cuotas, caché versionada, concurrencia,
reserva atómica de costo y conciliación conservadora tras timeouts. Presupuesto
global configurable: aproximadamente USD 4, sin asumir saldo real. Prueba con
adaptador falso identificado y casos de cuota agotada, falta de clave e inyección
de instrucciones. No consumas crédito real sin alcance de prueba autorizado.
Aceptación: respuestas trazables y gasto limitado antes de cada llamada.
```

### A15 — Exportaciones e informes

```text
Implementa A15 de docs/team-plan.md. Lee AGENTS.md y contratos existentes.
Genera CSV/JSON de indicadores y reportes basados en resultados estructurados,
con filtros, unidades, fuentes, QA, período, métodos, incertidumbre y versiones.
Si se requiere PDF, usa la skill PDF disponible y revisa visualmente la salida.
Gemini puede redactar texto opcional, pero no crear ni modificar números.
Acota tamaño, tiempo y acceso; prevén fórmulas peligrosas en CSV y contenido
no confiable al renderizar. Prueba que los filtros y cifras exportados coincidan
con la API y registra qué datos faltan.
Aceptación: exportación reproducible, segura y suficiente para revisar la evidencia.
```

### A16 — Seguridad y protección de recursos

```text
Implementa A16 de docs/team-plan.md usando security-best-practices y las
referencias pertinentes para Python/FastAPI y Next.js/React. Revisa autenticación,
autorización, CORS, validación, paginación, jobs, descarga de archivos, secretos,
logs y cuotas. Define roles para lectura pública y operaciones administrativas.
Protege inferencia costosa y Gemini contra abuso; no uses CORS como autenticación.
Comprueba permisos de objetos, límites de petición y ausencia de secretos en
cliente/respuestas. Corrige hallazgos demostrables con pruebas; registra límites
que requieren configuración del despliegue. No amplíes exposición pública.
Aceptación: matriz de permisos y controles de acceso/costo verificados.
```

### A17 — Validación integral

```text
Implementa A17 de docs/team-plan.md. Usa cocha-scientific-validation y revisa
los resultados de D15. Verifica desde fuentes hasta API, mapa, informes y
asistente usando un caso real pequeño y trazable. Reproduce en entorno limpio
un resultado publicado; compara hashes, unidades, filtros y fechas. Ejecuta
pruebas de PostGIS, migraciones y contratos en infraestructura de pruebas,
incluidos fallos de red, datos insuficientes y modelo no válido. Diferencia QA
de software y validación científica; registra limitaciones de ambas.
Aceptación: informe de validación con evidencia, pasos y fallos pendientes reales.
```

### A18 — Operación y entrega

```text
Implementa A18 de docs/team-plan.md. Lee AGENTS.md y docs/deployment.md.
Prepara despliegue revisable con web/API, workers necesarios, PostGIS privado,
almacenamiento persistente, HTTPS y secretos del proveedor. Añade monitoreo de
salud, jobs, frescura, costos y capacidad; backup y restauración probada en otra
base. Documenta migraciones, rollback y recuperación sin perder trazabilidad.
No elijas servicios de pago ni publiques sin autorización del alcance concreto.
Si no hay proveedor acordado, entrega configuración local/staging y pasos exactos.
Aceptación: entrega operable y recuperable, con costos y pendientes explícitos.
```

## Prompts para Diego — todos sin Docker

### D01 — Actualizar requisitos y catálogo con la entrega GAMC

```text
Implementa D01 de docs/team-plan.md sin Docker. Lee AGENTS.md,
docs/gamc-resources.md y data/catalog/gamc.json. No empieces la investigación
municipal desde cero: el ZIP MÓNICA ya está verificado y descargado; el catálogo
incluye IDs de límites, áreas verdes, límite urbano, cota y población.
Actualiza docs/requirements.md y docs/data-catalog.md con acceso comprobado,
permisos, fechas, variable, formato y metadatos pendientes. Distingue WMS de
vector distrital completo y descarga de integración/QA. MÓNICA contiene PM10;
no lo llames temperatura del aire. Investiga en fuentes primarias unidades,
zona horaria, coordenadas e identidad de Kanata/Semapa y condiciones de uso,
sin mandar mensajes a terceros. Entrega a Andrés evidencia y bloqueos concretos.
Aceptación: catálogo coherente con los archivos reales y fuentes para cada metadato confirmado.
```

### D02 — Frontend autónomo sin Docker

```text
Implementa D02 de docs/team-plan.md. Lee AGENTS.md y apps/web/AGENTS.md.
Prepara el desarrollo con Node.js/npm únicamente, sin Python, Docker ni DB.
Crea un servidor local de fixtures compatible con OpenAPI y el script raíz
dev:fixtures. Usa fixtures sintéticas pequeñas en una carpeta de pruebas,
incluyendo datos válidos, vacíos, parciales y errores. Nunca uses esas fixtures
como fallback silencioso de producción. Muestra una etiqueta DEMO permanente
cuando ese entorno esté activo; evita activación accidental en producción.
Documenta API_INTERNAL_URL en .env.local y cómo alternar a la API de Andrés.
Aceptación: web utilizable y verificable con npm ci y dos comandos npm locales.
```

### D03 — UX y componentes

```text
Implementa D03 de docs/team-plan.md sin Docker, usando D02. Lee las reglas
del frontend y aprovecha el explorador existente. Define navegación y componentes
para dashboard, comparación, modelos, escenarios y asistente. Extrae tokens y
patrones de tipografía, espaciado, formularios, paneles y estados. Prioriza mapa,
legibilidad y precisión científica; no construyas pantallas que aparenten
resultados inexistentes. Usa componentes accesibles y bibliotecas solo cuando
aportan funcionalidad real. Documenta las decisiones y verifica lint/tipos/build.
Aceptación: interfaz coherente y reutilizable, con estados vacío/error/loading.
```

### D04 — Distritos GAMC y filtros sin geometrías ficticias

```text
Implementa D04 de docs/team-plan.md sin Docker. Lee reglas del frontend y
docs/gamc-resources.md. Usa contratos A02/A03 y fixtures rotuladas de D02.
Distingue la ventana piloto, la capa distrital WMS y un catálogo vectorial
completo. Añade selector, ficha y filtros compartibles por URL; habilita
análisis distrital solo cuando el backend confirme geometrías y resultados.
Un BBOX de capa no es un polígono ni prueba que estén los 15 distritos.
No incrustes claves GAMC ni dibujes límites aproximados como oficiales.
Permite avanzar con el estado vector pendiente mientras el WMS se visualiza.
Aceptación: selección territorial accesible sin aparentar análisis no disponible.
```

### D05 — Mapa Landsat y capas municipales GAMC

```text
Implementa D05 de docs/team-plan.md sin Docker. Lee docs/gamc-resources.md
y extiende MapLibre existente mediante la API/proxy de Andrés. Capas candidatas:
Limite Distritos, Limite Urbano, Áreas Verdes y Población por Manzanas; Cota 2750
solo como contexto documentado, nunca como DEM. Consume imágenes, leyendas y
atributos WMS según contrato. No envíes claves municipales al navegador ni copies
las credenciales del visor. Usa fixtures de D02 hasta disponer del proxy.
Separa las capas municipales contextuales de los resultados LST/NDVI, con
fuente, fecha, tipo de dato y resolución. Añade comparación temporal con escala
fija y tabla alternativa. Maneja WMS no disponible sin perder el piloto.
Prueba cambio de capas/fechas y limpieza de mapas/workers con playwright.
Aceptación: capas correctamente identificadas, sin falsa geometría distrital ni claves expuestas.
```

### D06 — Series y resultados estadísticos

```text
Implementa D06 de docs/team-plan.md sin Docker. Consume los contratos de A02
y los resultados de A07 cuando estén disponibles; usa D02 para desarrollar.
Muestra series, anomalías, referencia temporal, pendiente, intervalos, n, unidades
y método. Representa huecos sin unirlos engañosamente. Diferencia intervalo
predictivo de confianza y observación de estimación. Explica inconcluso y datos
insuficientes sin interpretar p no significativo como ausencia de cambio.
Incluye tabla accesible y filtros coherentes con el mapa. No calcules inferencia
estadística en React ni fabriques p-values.
Aceptación: gráficos y texto fieles a los resultados estructurados del backend.
```

### D07 — Comparación de distritos

```text
Implementa D07 de docs/team-plan.md sin Docker sobre D02 y contratos A02/A07.
Crea comparación de distritos con período, variable, magnitud de cambio,
cobertura e incertidumbre. Permite ordenar y filtrar con criterios visibles.
No llames riesgo sanitario a LST ni presentes un ranking como certeza cuando
los intervalos se solapan o faltan datos. Separa relevancia territorial y
significancia, mostrando corrección múltiple si el backend la proporciona.
Ofrece una vista tabular útil para autoridades y ciudadanía.
Aceptación: comparación explicable y sin puntuaciones arbitrarias ocultas.
```

### D08 — Calidad y procedencia

```text
Implementa D08 de docs/team-plan.md sin Docker. Amplía la trazabilidad existente
para consultar producto/versión, fuente, adquisición, unidad, resolución nativa
y visualizada, QA, cobertura y ejecución. Diseña advertencias contextuales por
datos parciales, fuente pendiente y extrapolación; evita saturar toda la pantalla
con avisos genéricos. Crea vistas de metodología y límites usando contenido
verificado y campos del contrato. Separa resultado observado, estimado y simulado.
Verifica con fixtures completas e incompletas y después con un resultado real.
Aceptación: el usuario puede saber de dónde sale cada cifra y cuándo no confiar en ella.
```

### D09 — Series PM10 y fichas Kanata/Semapa

```text
Implementa D09 de docs/team-plan.md sin Docker. Lee docs/gamc-resources.md
y consume A02/A08 con fixtures identificadas de D02 mientras se integra la API.
Crea lista, ficha y series PM10 para Kanata/Semapa, con procedencia, cobertura,
calidad y estados de unidad/horario pendientes. No añadas marcadores al mapa
hasta disponer de coordenadas oficiales; no los adivines por nombre.
Muestra negativos como observaciones marcadas para revisión y no los mezcles
con agregados válidos; no conviertas faltantes en cero ni ocultes ceros sin
regla QA. Evita categorías de salud y etiquetas µg/m³ sin metadatos confirmados.
Los timestamps originales sin offset no deben rotularse UTC automáticamente.
Diferencia contaminación PM10 y LST/NDVI; no muestres calibración térmica ficticia.
Aceptación: series y fichas honestas, con calidad y metadatos visibles, sin Docker.
```

### D10 — Estimaciones y modelos

```text
Implementa D10 de docs/team-plan.md sin Docker con D02 y contratos A11.
Crea vistas de estimación por zona/fecha, intervalo predictivo, variables,
métricas fuera de muestra, período de entrenamiento y versión del modelo.
Incluye model card, fuera de dominio, abstención y modelo no disponible.
No uses precisión de entrenamiento como calidad final ni dibujes estimaciones
como mediciones reales. Cualquier cálculo científico procede del backend.
Prueba visualmente resultados válidos, inciertos y no evaluables.
Aceptación: estimaciones comprensibles con incertidumbre y límites de uso visibles.
```

### D11 — Escenarios urbanos

```text
Implementa D11 de docs/team-plan.md sin Docker. Diseña la interfaz sobre los
parámetros y rangos del contrato A12. Muestra escenario base e intervención,
supuestos, resultado, incertidumbre y estado no evaluable. Etiqueta siempre
SIMULACIÓN HIPOTÉTICA; no prometas efectos causales por mover un slider.
No ejecutes el modelo en frontend ni inventes coeficientes de enfriamiento.
Usa fixtures de D02 y deja explícita la integración pendiente si A12 no está listo.
Aceptación: escenario explorable sin confundirlo con observaciones o una garantía.
```

### D12 — Asistente científico

```text
Implementa D12 de docs/team-plan.md sin Docker. Consume solo el backend de A14;
no integres Gemini directamente ni solicites claves en el navegador. Diseña
preguntas sugeridas basadas en resultados visibles, mensajes con referencias
a evidencia y estados de carga, falta de evidencia, cuota agotada y error.
Mantén las cifras y citas verificables; renderiza texto/Markdown sin HTML
arbitrario. Desactiva envíos duplicados y limita entrada según contrato.
Desarrolla con respuestas sintéticas rotuladas en D02, sin consumir crédito real.
Aceptación: conversación útil, accesible y transparente sobre límites y fuentes.
```

### D13 — Informes y descargas

```text
Implementa D13 de docs/team-plan.md sin Docker. Añade selección de contenido,
vista previa y descarga desde A15 para la consulta vigente. Muestra filtros,
período, fuentes, unidades, fecha de generación y limitaciones. Incluye estados
de generación, vacío y error; no exportes gráficos de prueba como resultados
reales. Usa fixtures de D02 para el flujo y compara después un informe real con
los valores de la pantalla. No dupliques el cálculo científico en el navegador.
Aceptación: usuario puede compartir evidencia trazable con filtros consistentes.
```

### D14 — Accesibilidad y rendimiento

```text
Implementa D14 de docs/team-plan.md sin Docker. Revisa D04–D13 en móvil y
escritorio: navegación por teclado, foco, contraste, nombres accesibles, tablas,
lectura de gráficos y reducción de movimiento. Verifica carga diferida de mapas
y gráficos, limpieza de recursos, solicitudes redundantes y datos voluminosos.
Comprueba comportamiento si falla el mapa base o WebGL: conservar la tabla y
mostrar una explicación. Usa playwright y herramientas disponibles; documenta
mediciones reales y corrige problemas de mayor impacto sin rediseños ajenos.
Aceptación: flujos principales operables y sin desbordamiento horizontal global.
```

### D15 — Pruebas de navegador

```text
Implementa D15 de docs/team-plan.md sin Docker usando playwright. Revisa la
skill y las convenciones actuales antes de añadir un conjunto de pruebas
automatizadas solicitado por esta tarea. Arranca Next.js y fixtures Node de
D02; cubre selección territorial, fecha/capa, vacío/error, tablas, modelos sin
datos, escenario rotulado, asistente sin cuota y descargas. Valida fixtures
contra OpenAPI o un esquema derivado, sin mantener contratos copiados a mano.
Integra ejecución frontend en CI sin servicios Docker ni APIs de pago.
Aceptación: pruebas significativas, repetibles y evidencia de integración real
separada del resultado de las fixtures.
```

### D16 — Manual y demostración

```text
Implementa D16 de docs/team-plan.md sin Docker. Usa resultados validados de
A17 para crear manual de usuario, recorrido de demostración y presentación
del problema, datos, método, hallazgos, límites e innovación. Distingue lo
implementado, validado y planificado; no atribuyas a NASA requisitos sin fuente
oficial ni prometas resultados aún no calculados. Incluye un caso real local,
capturas verificadas y una alternativa de demo con snapshot si falla Internet.
Si se solicita un archivo de diapositivas, usa la skill de presentaciones.
Comprueba requisitos y formato de entrega vigentes antes de proponer publicación.
Aceptación: otra persona puede comprender, reproducir y defender la demostración.
```

### D17 — 3D opcional

```text
Evalúa e implementa D17 de docs/team-plan.md solo después del núcleo validado,
sin Docker. Propón qué decisión mejora una vista 3D y usa deck.gl o Three.js
únicamente si añade información sobre datos disponibles. No inventes alturas
de edificios ni resolución urbana. Conserva unidades, escalas, procedencia y
una alternativa 2D/tabular; carga diferida y respeta capacidades del dispositivo.
Trabaja con fixtures rotuladas o API de Andrés. Si el 3D solo decora o degrada
rendimiento/legibilidad, documenta la decisión de omitirlo.
Aceptación: aporte demostrable a la comprensión sin debilitar el núcleo científico.
```

## Cuándo se considera completo

- Un distrito y período reales se pueden rastrear desde fuente hasta indicador,
  mapa, análisis e informe, reproduciendo el cálculo.
- Tendencias e incertidumbre pasan validación científica, no solo pruebas de UI.
- Estimaciones y escenarios muestran sus límites; si faltan datos para validarlos,
  esa parte sigue pendiente o se reduce explícitamente el alcance acordado.
- El asistente cita evidencia y respeta el presupuesto; no genera observaciones.
- Los flujos reales funcionan y los entornos de prueba siguen claramente separados.
- Seguridad, operación, restauración, documentación y demostración están revisadas.

La disponibilidad municipal, suficiencia de estaciones y validez de escenarios
son dependencias externas/científicas. Construir adaptadores o estados vacíos
permite avanzar, pero no convierte esos módulos en científicamente completados.
