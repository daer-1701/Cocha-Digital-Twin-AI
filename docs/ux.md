# Interfaz: estructura, tokens y componentes

Decisiones de D03 (14/11/2026). Reglas obligatorias del área en
`apps/web/AGENTS.md`; criterios visuales de la skill `frontend-design`, siempre
subordinados a la precisión científica.

## Relieve 3D (procedencia, EF09)

El mapa (`study-map.tsx`) usa **AWS Terrain Tiles** en formato Terrarium
(`elevation-tiles-prod`) con atribución a
[Terrain Tiles / AWS Open Data](https://registry.opendata.aws/terrain-tiles/).
Es relieve gráfico para MapLibre (`setTerrain`); **no** es un DEM municipal
topográficamente certificado ni equivale a la capa WMS GAMC «Cota 2750»
(imagen de contexto). No atribuir precisión altimétrica no comprobada.
Verificación WMS/relieve: `scripts/verify_gamc_wms.py` →
`data/catalog/wms_verification.json`.

## Punto de partida

- **Tema:** evidencia ambiental de una ciudad de valle a 2.560 m, con calor
  superficial y vegetación como variables centrales.
- **Audiencia:** técnicos municipales, ciudadanía y estudiantes («detectives de
  datos», según el enfoque local del reto). Muchos no son especialistas.
- **Trabajo principal:** entender dónde y cuánto cambia el ambiente, y cuánto
  confiar en cada cifra.

El elemento distintivo es la **codificación por naturaleza del dato**: un color
y un rótulo constantes para observación, estimación, simulación y dato
sintético. Comunica algo científico real, no decora. El resto de la interfaz
se mantiene sobria para que el mapa y las cifras sean protagonistas.

## Navegación

Definida en `apps/web/src/lib/navigation.ts`, fuente única para menú y páginas.

| Ruta | Sección | Estado | Naturaleza |
| --- | --- | --- | --- |
| `/` | Explorador | Disponible (piloto Landsat) | Observación |
| `/comparar` | Comparar distritos | En preparación | Observación |
| `/estaciones` | Estaciones MÓNICA (PM10) | Disponible (catálogo, sin series) | Observación |
| `/informes` | Informes y descargas | Disponible (ventana piloto) | Observación |
| `/modelos` | Estimaciones | En preparación | Estimación |
| `/procesamiento` | Procesamiento | Disponible (historial de solo lectura) | — |
| `/escenarios` | Escenarios | En preparación | Simulación |
| `/asistente` | Asistente | En preparación | — |

Las secciones pendientes muestran qué datos o validaciones faltan, con
`PendingSection`. **No muestran gráficos, mapas ni cifras de ejemplo.** El menú
las anuncia como «en preparación» a lectores de pantalla. Al implementar una
sección, cambiar `available` y reemplazar su página.

Cada sección consulta su recurso de la API (`/v1/indicators` y `/v1/trends`,
`/v1/models`, `/v1/scenarios`, `/v1/assistant`) y muestra en español si el
servidor confirma que no hay resultados, si está vacío o si no respondió. El
motivo original del servidor, en inglés, queda en un desplegable
(`ServerDetail`) con `lang="en"`. El asistente muestra además el estado del
presupuesto que informa el servidor (D12): modelo previsto, precios por millón
de tokens, si se verificaron con la tarifa oficial, la fecha y la fuente como
enlace externo, y que las llamadas siguen desactivadas. No envía consultas.

## Tokens

Variables CSS en `apps/web/src/app/globals.css`. No usar colores ni tamaños
literales en componentes nuevos.

| Grupo | Tokens | Uso |
| --- | --- | --- |
| Superficies | `--color-bg`, `--color-surface`, `--color-surface-raised` | Fondo, paneles, controles |
| Texto | `--color-text-strong`, `--color-text`, `--color-text-muted`, `--color-text-subtle` | De mayor a menor énfasis |
| Naturaleza | `--nature-observed`, `--nature-estimated`, `--nature-simulated`, `--nature-synthetic` | Solo para indicar el tipo de evidencia |
| Estado | `--color-danger`, `--color-focus`, `--color-link` | Errores, foco de teclado, enlaces |
| Tipo | `--text-xs` (12 px) a `--text-display` | Mínimo 12 px en cualquier texto |
| Espacio | `--space-1` (4 px) a `--space-10` (40 px), `--page-gutter` | Escala de 4 px |
| Forma | `--radius-sm`, `--radius-md`, `--measure` (70ch) | Radios y largo de línea |

Las escalas de color de los mapas (calor y vegetación) no son tokens de interfaz:
son escalas científicas fijas y se documentan con cada mapa.

**Tipografía:** Atkinson Hyperlegible, diseñada por el Braille Institute para
baja visión, con cifras tabulares en métricas y tablas. Se carga con
`next/font`, que la descarga durante el build: compilar requiere Internet la
primera vez. Si falla, el sistema usa `system-ui`.

**Contraste:** calculado con la fórmula WCAG 2.x. El par más bajo es
`--color-text-subtle` sobre `--color-surface-raised` (6,15:1); todos los colores
de texto, naturaleza y error superan 6:1 sobre ambas superficies, por encima del
4,5:1 de AA. Revalidar al cambiar colores.

## Componentes

En `apps/web/src/components/ui/`:

| Componente | Responsabilidad |
| --- | --- |
| `NavLinks` | Menú con `aria-current` y estado pendiente |
| `PageHeader` | Título de página e introducción |
| `Panel` | Contenedor con título y metadato (fecha, unidad) |
| `Metric` | Valor con unidad; `null` muestra «Sin datos» y oculta la unidad |
| `NatureBadge` | Rótulo y descripción del tipo de evidencia |
| `StatusPanel` | Estados `loading`, `empty`, `error` y `pending` |
| `DemoBanner` | Franja permanente con datos sintéticos o bloqueados |
| `ServerDetail` | Motivo literal del servidor, plegado y marcado en inglés |
| `ExternalLink` | Enlace externo solo si la URL del servidor es http(s); anuncia la pestaña nueva |

`PendingSection` compone estos elementos para secciones sin resultados.
`TerritorySelector` y `TerritoryCard` (en `components/`) se describen en
«Selección territorial y filtros». En `components/` también están
`MapLayers` (capas municipales), `ComparisonPanel` (dos fechas),
`ObservationChart` (puntos por fecha) y `ProvenancePanel` (procedencia).

## Estados

| Estado | Cuándo | Mensaje |
| --- | --- | --- |
| Cargando | `loading.tsx` de Next.js | Qué se consulta |
| Sin datos | API responde `empty`, snapshot sin escenas, ruta inexistente | Qué falta y cómo publicarlo |
| Error | API caída, 503, timeout, fallo de render (`error.tsx`) | Qué falló y qué revisar; nunca se disculpa ni es vago |
| En preparación | Sección sin backend | Qué datos y validaciones faltan |
| Parcial | Cobertura < 70 % o celdas nulas | Aviso en el panel; huecos visibles en el mapa |

La falta de datos nunca se muestra como cero.

## Redacción

- Español, mayúscula inicial, voz activa. Sin etiquetas en mayúsculas en el
  código fuente: los lectores de pantalla pueden deletrearlas.
- Nombrar por lo que el usuario entiende: «Cobertura válida», no «valid_fraction».
- Cada advertencia científica en su contexto, una vez. No repetir avisos genéricos.
- Los enlaces externos indican que abren otra pestaña.
- Evitar numeración decorativa («01 /») y flechas en enlaces internos.

## Accesibilidad aplicada

Enlace para saltar al contenido, foco visible en todos los controles, objetivos
táctiles de 44 px como meta, tablas con `scope`, alternativa tabular al mapa y
respeto de `prefers-reduced-motion`. Los botones de vista y cámara del mapa
miden 38–40 px en móvil (incidencia QA-06 de [QA](qa-report.md)).

La auditoría JF03/JF04 del 14/11/2026 (axe-core WCAG 2.2 AA, teclado, 3D y
compatibilidad) y sus incidencias abiertas están en el [informe de QA](qa-report.md).

### Auditoría D14 (14/11/2026)

Medido con Playwright (Chromium 159, build de producción y fixtures) en las
siete rutas. Las comprobaciones quedaron como pruebas en
`apps/web/test/e2e/accessibility.spec.ts`, para que no retrocedan:

| Comprobación | Resultado |
| --- | --- |
| Desbordamiento horizontal global a 320 px (reflow WCAG 1.4.10) y 390 px | 0 px en todas las rutas |
| Primer Tab | Enfoca «Saltar al contenido»; Enter lleva a `#contenido` |
| Un único `h1` por página | Sí |
| Controles visibles sin nombre accesible | Ninguno, tras la corrección siguiente |
| Ids duplicados | Ninguno, tras la corrección siguiente |
| Sin WebGL | Aviso en el mapa; la tabla de escenas sigue disponible |
| Tablas anchas en móvil | Desplazamiento dentro de `.table-wrap`, no de la página |

Correcciones aplicadas:

- `/informes` usaba `id="contenido"` en un select, el mismo id que `<main>`. La
  etiqueta apuntaba a `<main>` y el select quedaba sin nombre; además, el enlace
  de salto podía ir al control. Ids renombrados con prefijo `informe-`.
- El texto «se abre en una pestaña nueva» de los enlaces externos usaba una
  clase inexistente y se veía en pantalla; ahora usa `sr-only`.
- `.card-grid` usaba un mínimo fijo de 280 px; ahora `min(280px, 100%)` para no
  forzar desbordamiento en pantallas estrechas.

Rendimiento: el mapa se carga con `next/dynamic` sin SSR, se crea una vez por
límites y actualiza capas con `setData`. Las imágenes WMS se piden con 400 ms de
espera tras mover el mapa y se liberan al desmontar. Las páginas consultan sus
recursos en paralelo con timeout de 5 s.

Sin medir todavía: lector de pantalla real (NVDA o VoiceOver), zoom del
navegador al 200 % y contraste de las imágenes WMS municipales, que no
controlamos.

## Selección territorial y filtros (D04)

El explorador consulta `/v1/territories` (A02/A03) y ofrece dos niveles en
`lib/territory.ts`:

| Opción | Estado | Qué permite |
| --- | --- | --- |
| Ventana piloto (`piloto`) | Disponible; nombre y límites vienen del snapshot | Indicadores de todo el rectángulo |
| Distritos con análisis (`distritos`) | Deshabilitada mientras `vector_districts` no esté disponible | Indicadores por distrito con polígonos completos |

Los límites distritales WMS ya no son una opción territorial: son una imagen
de orientación y se muestran como capa del mapa (ver «Capas municipales»).
Si la API no responde, la opción de distritos indica que no se pudo consultar
el catálogo y el piloto sigue funcionando.

`TerritorySelector` es un grupo de radios con descripción y motivo pendiente
asociados mediante `aria-describedby`. `TerritoryCard` muestra nombre, tipo,
límites WGS84, extensión aproximada, escenas y producto, siempre con el aviso
de que la ventana no es un límite administrativo. La extensión en km es un
cálculo geométrico aproximado de la caja, no un área oficial.

**Filtros compartibles:**
`?territorio=piloto&escena=<id>&comparar=<id>&variable=lst|ndvi`.
El servidor los lee en `lib/filters.ts`; los valores inválidos o no
disponibles vuelven al valor por defecto y la página lo avisa
(`role="status"`), en vez de fallar o cambiar la vista en silencio. Cada cambio
actualiza la URL con `history.replaceState`, sin nueva consulta a la API.
«Copiar enlace a esta vista» informa si el portapapeles no está disponible.

## Capas municipales y comparación temporal (D05)

`MapLayers` lista las capas WMS del catálogo con su estado. Las no disponibles
quedan deshabilitadas con el motivo del servidor. Al activar una capa, el mapa
pide una sola imagen del área visible a `/api/gamc/wms/map`, una ruta de Next.js
que valida `service_id`, `bbox` y tamaño y reenvía a la API desde el servidor:
el navegador nunca ve la URL de la API ni la clave municipal. Se vuelve a pedir
400 ms después de mover el mapa, para respetar el límite de solicitudes del
proxy. Las capas se rotulan como referencia municipal, nunca como resultados
Landsat; «Cota 2750» se aclara como contexto, no como modelo de elevación. Si
una imagen falla, se avisa en la capa y el mapa Landsat sigue visible. Si el
navegador no tiene WebGL, se muestra un aviso y la tabla.

«Comparar con» añade `ComparisonPanel`: medias de ambas fechas y su diferencia
(la más reciente menos la anterior), con aviso de cobertura reducida y la
aclaración de que no es una tendencia. El mapa mantiene la escala fija para
alternar fechas.

## Series, tendencias y procedencia (D06, D08)

`ObservationChart` usa la misma escala fija que la leyenda del mapa, muestra
cada fecha como punto independiente y marca las fechas sin datos con un
círculo punteado y el texto «Sin datos». El estado de `/v1/series` y
`/v1/trends` se explica en español; por distrito ambos son `unavailable`, así
que no se dibuja ninguna tendencia distrital. Los `items` de esos contratos aún
no tienen esquema.

Bajo «¿Hay una tendencia?» se muestra `pilot_trends` (A07) para la variable
elegida: pendiente descriptiva por escena en orden de adquisición, escenas con
valor y mínimo requerido. Se aclara que no es una tendencia por distrito, que
no tiene escala anual y que no publica significancia ni causas. Si el servidor
la marca `inconclusive`, se dice «no concluyente» con los conteos. La web no
recalcula la pendiente.

`ProvenancePanel` lista solo campos del contrato: colección, producto, licencia,
plataforma, escena, hora de adquisición, unidades, tamaño de celda calculado de
sus límites, cobertura válida y fecha del snapshot. La resolución nativa no
está en el snapshot y se indica así, sin suponerla.

## Estaciones (D09)

`/estaciones` consume `/v1/stations`: ficha por estación con ubicación descrita
(dirección del catálogo), unidad (`ug/m3` se muestra como µg/m³) con su fuente
como enlace, zona horaria, coordenadas y elevación como «Pendiente» cuando
faltan, análisis desactivado y lista de metadatos pendientes traducida; las
claves desconocidas se muestran literales con `lang="en"`. La dirección
descrita no se geocodifica: no hay marcadores en el mapa sin coordenadas de
fuente primaria ni series hasta que la API las publique. Se aclara que PM10 no
es temperatura ni valida LST.

## Informes y descargas (D13)

`/informes` consume `/v1/reports` (A15). Solo existe la exportación de
observaciones de la ventana piloto (`observation_export`); el informe distrital
formal sigue bloqueado y la página lo dice.

- **Selección:** resumen por escena (todas o una) o celdas de una escena. Es un
  formulario GET, funciona sin JavaScript y la URL es compartible
  (`?contenido=escenas|celdas&escena=<id>`). El explorador enlaza a la descarga
  de la fecha seleccionada.
- **Metadatos:** alcance, período, fuente y versión, licencia, unidades, fecha
  del snapshot, tratamiento de faltantes, nota del servidor y limitaciones.
- **Descargas:** `/api/informes/csv|json`, rutas de Next.js que consultan la API
  desde el servidor y solo serializan lo publicado. El CSV lleva encabezado de
  metadatos con `#`, faltantes vacíos (nunca 0), BOM UTF-8 y protección contra
  fórmulas en celdas de texto. El JSON conserva el contrato y añade un bloque
  `download` con la selección y la fecha de descarga.
- **Demo:** con fixtures, el archivo empieza por `DEMO-SINTETICO_`, el CSV
  abre con un aviso y el JSON marca `synthetic_fixture: true`. Si un build de
  producción recibe datos sintéticos, la descarga responde 503.
- **Estados:** vacío sin snapshot (descarga 404), error si la API no responde
  (descarga 502).

Pendiente: comparar un informe real con los valores de la pantalla cuando
exista un snapshot Landsat publicado.

## Visualización 3D (D17): implementada con límites explícitos

El explorador usa MapLibre con relieve de referencia Terrain Tiles de AWS Open
Data (codificación Terrarium), sombreado y alternativa 2D. La exageración del
terreno es 1,5; el relieve no es una medición de LST ni valida los indicadores.
La atribución enlaza al proveedor. La carga del relieve exige acceso externo.

Las columnas representan el valor de LST/NDVI en una escala visual con tope de
900 m. Esa altura es una codificación gráfica, no un edificio, elevación urbana
ni medición ambiental adicional. Se conserva la escala de color fija y la
alternativa tabular. No se incorporaron deck.gl ni Three.js.

Los controles permiten volver a 2D. El código considera equipos limitados,
movimiento reducido y libera recursos del mapa al desmontarse. Las pruebas
con fixtures comprueban interfaz; la precisión o disponibilidad del DEM y del
WMS externo no quedan certificadas por ellas. Ver `review-fixes.md`.

## Pendiente

### Explorador interactivo — cambios pendientes de pruebas

La revisión visual añade una línea temporal con reproducción bajo demanda,
fechas seleccionables y cobertura por adquisición. El recorrido se detiene al
salir de la pestaña; no interpola observaciones entre fechas. El mapa permite
giro bajo demanda, centrado y pantalla completa. Un panel de inspección muestra
LST y NDVI de la celda pulsada y desaparece al cambiar de adquisición.

La composición conserva las fuentes existentes, con azul cordillera `#122939`,
superficie `#223f51`, niebla `#d2e4ee`, texto `#f0f5f8` y ámbar `#edbd72` para
selección. Las escalas científicas permanecen fijas. La vista inicial es 2D
cuando el dispositivo indica recursos limitados o movimiento reducido.

El 14/11/2026 se verificaron con fixtures en Chromium headless: modo inicial,
movimiento reducido, giro y su detención, centrado, inspector de celda,
teselas caídas, liberación del mapa y desbordamiento móvil (`map3d.spec.ts`).
Quedan incidencias abiertas y comprobaciones en equipos reales; ver el
[informe de QA](qa-report.md).

- Mostrar series, tendencias e indicadores distritales cuando sus `items` tengan esquema.
- D07: comparación oficial cuando exista el vector y A06/A07; el tablero sintético ya permite elegir adquisición.
- Series PM10 por estación cuando la API las publique (A08).
- Probar contra la API real de Andrés y el WMS municipal real (las pruebas usan fixtures).
- Revisar la dirección visual completa cuando existan las secciones reales.
