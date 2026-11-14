# Matriz de requisitos

Revisión: **14 de noviembre de 2026** (D01). Estado contrastado con el código
del commit `be31cec`, no solo con la documentación. R16, R17, R19 y Q05 se
revisaron después sobre `9bbbe8f` (JF08). Fuentes de datos y sus
metadatos: [catálogo de datos](data-catalog.md).

## Origen de los requisitos

| Código | Origen | Verificación |
| --- | --- | --- |
| NASA | Reto oficial «Be An Earth System Trend Detective!» | **Pendiente.** La página oficial devolvió error 500 y error TLS el 14/11/2026. El objetivo se tomó de la página local y de resúmenes de terceros coincidentes; confirmar en spaceappschallenge.org antes de citarlo como requisito. |
| L1 | Enfoque local GAMC «sensado virtual» del mismo reto | Leído en [spaceappschallenge-cbba.com](https://spaceappschallenge-cbba.com/#retos) el 14/11/2026 |
| L2 | Enfoque local GAMC «tablero socioambiental distrital» del mismo reto | Misma página y fecha |
| P | Decisiones del proyecto: `AGENTS.md`, `docs/science.md`, `docs/roadmap.md` | Repositorio |

La página local declara que los enfoques Cochabamba son **opcionales** y que
la descripción válida es la publicada por NASA. L1 y L2 no son obligatorios
entre sí; el equipo debe decidir cuál adopta (ver [decisiones](#decisiones-pendientes)).

El plan menciona «siete módulos del documento original». Ese documento no está
en el repositorio; esta matriz se organiza por capacidades de `team-plan.md`.
Contrastarla con el documento original cuando se versione.

Estados: **Implementado** (código existente y probado), **Parcial**, **Pendiente**
(sin código), **Bloqueado** (depende de datos o permisos externos).

## Requisitos funcionales

| ID | Requisito | Origen | Estado | Evidencia o bloqueo | Tareas |
| --- | --- | --- | --- | --- | --- |
| R01 | Seleccionar variables de misiones o modelos NASA | NASA, L1 | Parcial | LST y NDVI de Landsat C2 L2 (USGS/NASA) en `scripts/ingest_landsat.py`. AOD y temperatura del aire no integradas | A05 |
| R02 | Visualizar cambio en el tiempo | NASA, L2 | Parcial | Explorador con tres fechas de julio, puntos sin línea de tendencia (`apps/web/src/components/explorer.tsx`) | D05, D06 |
| R03 | Determinar dónde cambia: análisis por los 15 distritos | NASA, L1, L2 | Bloqueado | Solo existe una ventana rectangular piloto. GAMC ofrece WMS distrital, no un vector completo | A03, A06, D04 |
| R04 | Cuantificar magnitud del cambio | NASA | Pendiente | Tres escenas no permiten pendiente defendible | A05, A07 |
| R05 | Significancia estadística (intervalos, p < 0,05) | NASA, L1 | Pendiente | Sin serie suficiente ni tratamiento de estacionalidad y autocorrelación | A07, D06 |
| R06 | Divergencia norte/serranía vs. centro/sur | L1 | Bloqueado | Requiere R03 y R04 | A06, A07, D07 |
| R07 | Modelo supervisado de fusión satélite-suelo con R², RMSE, MAE | L1 | Bloqueado | Los CSV MÓNICA descargados contienen solo PM10 de 2 estaciones; ver [conflicto C1](#conflictos-entre-requisitos-y-datos) | A09, A10, D10 |
| R08 | Predicción en distritos sin sensores («sensado virtual») | L1 | Bloqueado | Dos estaciones limitan la validación espacial; ver C1 y C2 | A09–A11, D10 |
| R09 | Índice socioambiental 1–100 o semáforo por distrito | L2 | Pendiente | Exige metodología explícita y capas de equipamiento; ver C3 | A06, A07, D07 |
| R10 | Combinar series NASA con equipamientos GAMC (parques, colegios, salud, transporte) | L2 | Bloqueado | Catálogo GAMC confirmado: Áreas Verdes, Población por Manzanas y líneas de transporte (RAR no descargado). Colegios y salud no identificados | A03, D01 |
| R11 | Selección y filtrado entre los 15 distritos, fichas | L2 | Bloqueado | Selector actual solo ofrece la ventana piloto | D04 |
| R12 | Mapas de calor y comparativas distritales | L2 | Parcial | Mapa de celdas ~360 m sobre la ventana piloto; sin comparación distrital | D05, D07 |
| R13 | Resaltar hotspots de cambio | L2 | Pendiente | Depende de R04, R05 y R09 | A07, D07 |
| R14 | Definiciones sencillas de variables para «detectives de datos» | L1, L2 | Parcial | Textos de LST ≠ temperatura del aire y advertencias en el explorador | D03, D08 |
| R15 | Consultas guiadas por distrito o escenarios demostrativos | L1 | Pendiente | Asistente y escenarios no implementados | D11, D12 |
| R16 | Series PM10 de estaciones MÓNICA con calidad | P | Parcial | Importador transaccional (`scripts/import_monica.py`), fichas y revisión local de registros apagada por defecto. Sin series ni análisis: huso, coordenadas, QA y licencia pendientes (revisado 14/11, `9bbbe8f`) | A08, D09, EF04, EF05 |
| R17 | Asistente Gemini con evidencia y presupuesto ~USD 4 | P | Parcial | Estado, ledger de presupuesto y proveedor simulado; lectura guiada sin IA. Sin llamadas reales (revisado 14/11, `9bbbe8f`) | A14, D12, AF07, DF07 |
| R18 | Escenarios hipotéticos rotulados | P | Pendiente | Sin modelo validado | A12, D11 |
| R19 | Informes y descargas trazables | P | Parcial | CSV/JSON de la ventana piloto con procedencia y faltantes vacíos, probado con fixtures; informes distritales bloqueados (revisado 14/11, `9bbbe8f`) | A15, D13, DF08 |

## Requisitos de calidad y evidencia

| ID | Requisito | Origen | Estado | Evidencia |
| --- | --- | --- | --- | --- |
| Q01 | Procedencia: fuente, producto/versión, período, QA, cobertura válida | P | Implementado en piloto | Snapshot con método, limitaciones, ID STAC y manifiesto SHA-256 |
| Q02 | Falta de datos visible, nunca cero | P | Implementado en piloto | API devuelve `empty`; celdas sin datos se omiten; tabla muestra «Sin datos» |
| Q03 | Separar observación, estimación y escenario | P | Parcial | Rótulo «Observación»; aún no existen estimaciones ni escenarios |
| Q04 | No confundir LST con temperatura del aire | P | Implementado en piloto | Avisos en interfaz y limitaciones del snapshot |
| Q05 | Accesibilidad y UX para funcionarios y ciudadanía | L2, P | Parcial | Auditorías D14 y JF03 (axe WCAG 2.2 AA, teclado, móvil) con incidencias abiertas en `docs/qa-report.md`; falta lector de pantalla real |
| Q06 | Agregaciones mensuales o anuales estables | L2 | Pendiente | El piloto usa una escena de julio por año, no una media |
| Q07 | Secretos solo en servidor | P | Implementado | Cliente API `server-only`; sin `NEXT_PUBLIC_*` para claves |
| Q08 | Open source | L2 | Pendiente | No hay licencia de distribución elegida (`README.md`) |

## Conflictos entre requisitos y datos

**C1. MÓNICA no ofrece temperatura del aire en los archivos disponibles.**
L1 pide entrenar con «mediciones reales de las 2 estaciones» para predecir
comportamiento microclimático. Los CSV publicados por GAMC solo contienen
`estacion`, `pm10` y `fecha_medicion`. El informe municipal 2021 indica que la
estación Semapa mide temperatura, humedad, radiación y precipitación, pero esos
registros no están en la descarga. PM10 no sirve para calibrar ni validar LST.
Opciones: solicitar las variables meteorológicas por canal autorizado, cambiar
el objetivo del modelo a PM10 con justificación, o reducir el alcance de R07–R08.

**C2. Dos estaciones no validan una predicción espacial para 13 distritos.**
Con dos ubicaciones no existe validación espacial fuera de muestra útil. A09
debe evaluar viabilidad antes de comprometer métricas (ver `docs/science.md`).

**C3. Un índice 1–100 requiere pesos explícitos.** L2 pide una puntuación o
semáforo. El proyecto prohíbe puntuaciones arbitrarias ocultas (D07). Cualquier
índice necesita variables, normalización, pesos y sensibilidad documentados.

**C4. Los 15 distritos dependen de un vector no obtenido.** El enunciado local
afirma que GAMC provee capas vectoriales; el catálogo verificado solo expone WMS
para límites distritales. Sin vector no hay estadística zonal.

## Decisiones pendientes

1. Enfoque local: L1 (sensado virtual), L2 (tablero socioambiental) o ambos
   con alcance reducido. L2 depende menos de MÓNICA y prioriza UX, que coincide
   con las tareas de Diego; L1 está bloqueado por C1 y C2.
2. Confirmar el enunciado oficial NASA y requisitos de entrega del evento.
3. Fuente autorizada del vector de 15 distritos y de las capas de equipamiento.
4. Metodología del índice R09 si se adopta L2.
5. Licencia de distribución del código (Q08).

## Entrega a Andrés

Bloqueos concretos para A03, A08 y A09, con evidencia en el
[catálogo](data-catalog.md#pendientes-y-evidencia-para-andrés).
