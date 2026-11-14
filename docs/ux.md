# Interfaz: estructura, tokens y componentes

Decisiones de D03 (14/11/2026). Reglas obligatorias del área en
`apps/web/AGENTS.md`; criterios visuales de la skill `frontend-design`, siempre
subordinados a la precisión científica.

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
| `/modelos` | Estimaciones | En preparación | Estimación |
| `/escenarios` | Escenarios | En preparación | Simulación |
| `/asistente` | Asistente | En preparación | — |

Las secciones pendientes muestran qué datos o validaciones faltan, con
`PendingSection`. **No muestran gráficos, mapas ni cifras de ejemplo.** El menú
las anuncia como «en preparación» a lectores de pantalla. Al implementar una
sección, cambiar `available` y reemplazar su página.

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

`PendingSection` compone estos elementos para secciones sin resultados.
`TerritorySelector` y `TerritoryCard` (en `components/`) se describen en
«Selección territorial y filtros».

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
táctiles de 44 px, tablas con `scope`, alternativa tabular al mapa y respeto de
`prefers-reduced-motion`. Verificado sin desbordamiento horizontal a 390 px.
Auditoría completa pendiente en D14.

## Selección territorial y filtros (D04)

El explorador distingue tres niveles territoriales en `lib/territory.ts`:

| Opción | Estado | Qué permite |
| --- | --- | --- |
| Ventana piloto (`piloto`) | Disponible; nombre y límites vienen del snapshot | Indicadores de todo el rectángulo |
| Límites distritales GAMC, capa WMS (`distritos-wms`) | Deshabilitada | Orientación visual; nunca indicadores por distrito |
| Distritos con análisis (`distritos-vector`) | Deshabilitada | Indicadores por distrito con polígonos completos |

`TerritorySelector` es un grupo de radios con descripción y motivo pendiente
asociados mediante `aria-describedby`. `TerritoryCard` muestra nombre, tipo,
límites WGS84, extensión aproximada, escenas y producto, siempre con el aviso
de que la ventana no es un límite administrativo. La extensión en km es un
cálculo geométrico aproximado de la caja, no un área oficial.

**Filtros compartibles:** `?territorio=piloto&escena=<id>&variable=lst|ndvi`.
El servidor los lee en `lib/filters.ts`; los valores inválidos o no
disponibles vuelven al valor por defecto y la página lo avisa
(`role="status"`), en vez de fallar o cambiar la vista en silencio. Cada cambio
actualiza la URL con `history.replaceState`, sin nueva consulta a la API.
«Copiar enlace a esta vista» informa si el portapapeles no está disponible.

**Integración pendiente (A02/A03):** la API no expone todavía un catálogo
territorial, por lo que la disponibilidad de las opciones GAMC está fijada en el
frontend. Para habilitarlas, la pantalla necesita del backend, por territorio:
identificador estable, nombre, tipo (ventana, capa WMS o vector), estado de
disponibilidad con motivo, fuente, versión y fecha del límite, licencia, y si
admite indicadores. Para la capa WMS, además, una ruta del proxy del servidor
con imagen y leyenda, sin clave ni URL municipal en el navegador. Andrés define
el contrato; al publicarse se reemplaza la lista fija por la respuesta de la API.

## Pendiente

- D04: conectar el catálogo territorial de A02/A03 cuando exista.
- D05–D07: capas, series y comparación sobre estos componentes.
- Revisar la dirección visual completa cuando existan las secciones reales;
  esta etapa extrajo tokens sin rediseñar el explorador.
