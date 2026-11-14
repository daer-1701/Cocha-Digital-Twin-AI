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
`apps/web/.env.local`. Se acordará un puerto distinto al de la API real.
Las fixtures serán sintéticas y estarán rotuladas permanentemente como demo.
La implementación actual todavía no incluye `dev:fixtures`: crearla es D02.

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

Todas las tareas empiezan **pendientes**; una parte del código reutilizable
puede existir. «Depende» identifica resultados previos, no instalación de Docker
para Diego. ★ indica las tareas científicas o técnicas más difíciles.

| ID | Responsable | Tarea | Depende |
| --- | --- | --- | --- |
| A01 | Andrés | Estabilizar base, contenedores y CI | — |
| A02 | Andrés | Contratos completos y estados de disponibilidad | D01 |
| A03 ★ | Andrés | Verificar e importar límites distritales | D01 |
| A04 ★ | Andrés | Persistencia y trazabilidad en PostGIS | A02 |
| A05 ★ | Andrés | Ingesta multitemporal y QA robusto | A01, A03, A04 |
| A06 ★ | Andrés | Indicadores por distrito y anomalías | A05 |
| A07 ★ | Andrés | Tendencias e inferencia estadística | A06 |
| A08 | Andrés | Ingesta y calidad de Red MÓNICA | D01, A04 |
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

### A03 — Límites distritales verificados

```text
Implementa A03 de docs/team-plan.md. Lee AGENTS.md y usa
cocha-geospatial-ingestion. Revisa el catálogo de D01 y consigue una fuente
verificable de límites de los 15 distritos del municipio de Cochabamba.
Documenta procedencia, permiso, versión y CRS; valida geometrías, identificadores,
solapamientos y cobertura municipal. Conserva originales y checksums. Implementa
un importador idempotente y acceso territorial según A02. No uses dibujos,
límites metropolitanos ni geometrías aproximadas como distritos oficiales.
Si no hay fuente válida, entrega el importador probado con fixtures identificadas
y un informe del bloqueo, sin declarar integración oficial completada.
Aceptación: geometrías reales verificadas o indisponibilidad documentada.
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

### A08 — Red MÓNICA

```text
Implementa A08 de docs/team-plan.md con cocha-geospatial-ingestion. Parte de
las fuentes disponibles de D01. Verifica archivos, variables reales, unidades,
coordenadas, tiempo UTC/local, frecuencia, mantenimiento y flags de estaciones.
Crea importadores idempotentes, control de duplicados, huecos y valores inválidos;
preserva los registros originales y su calidad. Expón estaciones y series con
permisos de uso documentados. No deduzcas temperatura del aire a partir de
contaminantes. Si solo existen PDFs o no hay acceso, documenta lo disponible,
prepara adaptadores y devuelve indisponibilidad; no inventes registros.
Aceptación: una serie terrestre trazable o un bloqueo de acceso bien delimitado.
```

### A09 — Fusión y baseline

```text
Implementa A09 de docs/team-plan.md usando cocha-scientific-validation.
Con A06 y A08 define una variable objetivo realmente medible y el uso esperado
en zonas sin sensores. Justifica emparejamiento temporal, soporte espacial,
predictores, elevación y compatibilidad entre estación y satélite. Construye
un baseline simple y particiones bloqueadas por tiempo y espacio/estación,
sin fuga en transformaciones. Documenta sesgo de selección y extrapolación.
Si faltan estaciones compatibles, conserva un objetivo satelital explícito o
declara bloqueada la calibración terrestre; no cambies silenciosamente el objetivo.
Aceptación: dataset de entrenamiento reproducible y baseline fuera de muestra.
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

### D01 — Requisitos y fuentes

```text
Implementa D01 de docs/team-plan.md sin Docker. Lee AGENTS.md y docs/mvp.md.
Investiga en fuentes primarias el reto NASA, enfoque local y datos disponibles.
Separa requisitos oficiales de ideas del proyecto. Crea una matriz de preguntas,
funcionalidades, criterios de aceptación y estado actual. Cataloga límites,
MÓNICA y productos satelitales con URL, fecha de verificación, licencia, variables,
unidades y acceso confirmado o pendiente. No envíes solicitudes a terceros ni
inventes disponibilidad. Entrega docs/requirements.md y docs/data-catalog.md
con bloqueos y una propuesta priorizada para Andrés.
Aceptación: alcance verificable y fuentes que permiten decidir qué integrar.
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

### D04 — Distritos y filtros territoriales

```text
Implementa D04 de docs/team-plan.md sin Docker. Consume contratos de A02 y
trabaja con D02 mientras Andrés completa A03. Añade selector territorial,
resumen del área y filtros sincronizados con URL para compartir la consulta.
Diferencia municipio, distrito y ventana piloto; no muestres los polígonos
de prueba como oficiales. Conserva estado pendiente si falta geometría real.
Respeta teclado, carga y errores de selección. No edites los tipos generados;
documenta a Andrés cualquier dato que falte en el contrato.
Aceptación: navegación territorial coherente y lista para geometrías verificadas.
```

### D05 — Mapa y comparación temporal

```text
Implementa D05 de docs/team-plan.md sin Docker. Extiende MapLibre existente
con capas LST/NDVI, límites verificados cuando existan, leyendas, información al
seleccionar una zona y controles temporales. Añade comparación entre fechas
con escalas de color y soporte comparables; no sugieras cambios debidos solo a
autoescalado. Identifica huecos, resolución, cobertura y naturaleza del dato.
Libera mapas, workers y listeners al desmontarse. Trabaja con D02 y luego A06.
Usa playwright para revisar selecciones y cambio de capas.
Aceptación: mapa correcto, alternativa tabular y errores visibles sin datos ficticios.
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

### D09 — Estaciones terrestres

```text
Implementa D09 de docs/team-plan.md sin Docker. Añade a D05 una capa de
estaciones con ubicación, variables realmente medidas, unidades, última
observación y calidad según A02/A08. Crea ficha y serie por estación y muestra
cobertura temporal, mantenimiento y ausencia de datos. No inventes estaciones
ni relaciones de calibración. Usa fixtures rotuladas mientras no existan datos
MÓNICA válidos; la aplicación real debe comunicar indisponibilidad.
Aceptación: visualización terrestre honesta y compatible con la futura ingesta.
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
