# Informe de QA web — Julio (JF02, JF03, JF04, JF06)

Fecha: 14/11/2026. Commit revisado: `9bbbe8f` más los cambios de pruebas y
documentación de esta revisión. Entorno: Windows, Node 22, Chromium de
Playwright en modo headless (WebGL por SwiftShader), build de producción de
Next.js y fixtures sintéticas. Sin Docker, PostGIS, API real ni APIs de pago.

**Alcance de la evidencia.** Todo lo verificado aquí usa datos sintéticos. Valida
la interfaz contra el contrato OpenAPI y sus estados, no los datos de
Cochabamba ni la integración con la API compartida de Andrés (JF05).

## Resultado de las comprobaciones

| Comando | Resultado |
| --- | --- |
| `npm run lint` | Sin errores |
| `npm run typecheck` | Sin errores |
| `npm run build` | Compila; 13 rutas |
| `npm run test:e2e -w @cocha/web` | 108 pasan, 0 fallan, 7 omitidas (`test.fixme`, una por incidencia abierta) |

Antes de esta revisión la suite tenía 46 pruebas y 1 fallaba: el selector de
`explorer.spec.ts` encontraba dos regiones con la fecha tras el rediseño del
explorador. Se corrigió la prueba; no era un defecto del producto.

## Cambios en la suite (JF02)

- **Fixtures nuevas**, validadas contra OpenAPI al arrancar:
  `monica-review` (estaciones importadas, 60 registros PM10 con ceros, negativos
  y faltantes, 25 ejecuciones paginadas), `monica-locked` (revisión desactivada
  en el servidor) y `quota` (presupuesto del asistente gastado). El servidor
  sirve ahora `/v1/stations/{id}/observations` y pagina `/v1/jobs`.
- **Pruebas nuevas:** `records.spec.ts` (procesamiento y registros MÓNICA),
  `links.spec.ts` (informes contra pantalla y enlaces compartidos),
  `axe.spec.ts` (WCAG 2.2 AA con axe-core en 12 páginas a 1280 y 390 px),
  `map3d.spec.ts` (interacción 3D), lectura guiada sin IA, presupuesto agotado
  y API lenta. `/procesamiento` se añadió a las comprobaciones de accesibilidad.
- **Dependencia:** `@axe-core/playwright` como devDependency de `apps/web`.
- Las pruebas 3D bloquean las teselas externas de OpenStreetMap y Terrain Tiles:
  son deterministas y no cargan servidores de terceros.

Cada incidencia abierta tiene una prueba `test.fixme` con su ID. Al corregirla,
quitar `.fixme` y, en `axe.spec.ts`, la regla de `KNOWN`.

## Incidencias

Prioridad: **P1** impide el uso a un grupo de usuarios; **P2** degrada la
experiencia o la precisión de un rótulo; **P3** menor.

| ID | Prioridad | Responsable | Observado | Esperado | Pasos y evidencia |
| --- | --- | --- | --- | --- | --- |
| QA-01 | P1 | Diego | Las tablas con desplazamiento horizontal (`.table-wrap`) no se alcanzan con teclado a 390 px: sus columnas ocultas no son navegables (WCAG 2.1.1) | Contenedor enfocable con nombre, por ejemplo `tabIndex={0}`, `role="region"` y `aria-labelledby` hacia el `caption` | axe `scrollable-region-focusable` en `/informes`, `/comparar` (escenario `valle`), `/procesamiento` y `/estaciones/{id}`. Prueba `QA-01` en `axe.spec.ts` |
| QA-02 | P2 | Diego | Los enlaces de atribución de MapLibre se distinguen del texto solo por color (2,02:1) | Subrayado o contraste ≥ 3:1 con el texto vecino | axe `link-in-text-block` en `/`. Prueba `QA-02` |
| QA-03 | P2 | Diego | El giro sigue al usar los botones de zoom o brújula del mapa | Detenerse al tomar el control, como ya ocurre con puntero, rueda y teclado sobre el canvas | Activar «Girar el valle» y pulsar «+». Prueba `QA-03` en `map3d.spec.ts` |
| QA-04 | P2 | Diego | Al perder el contexto WebGL el mapa queda en blanco sin aviso | Aviso que remita a la tabla y, si es posible, recuperación | `WEBGL_lose_context.loseContext()` sobre el canvas. Prueba `QA-04` |
| QA-05 | P2 | Diego | Los controles de MapLibre se anuncian en inglés: «Zoom in», «Zoom out», «Drag to rotate map, click to reset north», «Toggle attribution» y el canvas «Map» | Textos en español mediante la opción `locale` del mapa | Recorrido con Tab en `/`. Prueba `QA-05` |
| QA-06 | P3 | Diego | Botones de vista y cámara de 38–40 px de alto en móvil | 44 px, como declara `docs/ux.md` (WCAG 2.5.8 AA exige 24 px y se cumple) | 390 × 800 táctil. Prueba `QA-06` |
| QA-07 | P3 | Diego | `/estaciones/no-es-un-uuid` muestra «Esta página no existe» con HTTP 200 | HTTP 404 | La página ya transmite `loading.tsx` antes de `notFound()`. Prueba `QA-07` en `records.spec.ts` |
| QA-08 | P2 | Diego | Con red lenta (400 ms de latencia, 400 kbit/s) el documento tarda 13 s y los controles del mapa siguen deshabilitados tras 60 s, solo con «Preparando el relieve…» | Aviso tras un tiempo razonable y recordatorio de que la tabla ya está disponible | Emulación CDP de red; la tabla sí era utilizable. Sin prueba automática |
| QA-09 | P2 | Diego; Mateo revisa redacción | El HUD dice siempre «Ventana piloto de Cochabamba» y la región del mapa «Valle de Cochabamba, fecha», también con datos sintéticos. La nota del HUD llama al relieve «elevación real exagerada ×1,5» | Usar el `area_name` del snapshot o un texto neutro con datos demo; describir el relieve como referencia, sin precisión no verificada (EF09) | `/` con cualquier escenario de fixtures. La franja «Demo» y la etiqueta «Demo sintética» atenúan, pero no corrigen, el rótulo |
| QA-10 | P3 | Diego | Los valores de una celda solo se consultan pulsando el mapa con el puntero | Equivalente por teclado o remitir a la descarga «Celdas de una escena» | Las celdas están disponibles en CSV/JSON desde `/informes` |
| QA-11 | P3 | Diego | El explorador tiene nueve botones «Detalle técnico del servidor (en inglés)» con el mismo nombre | Nombres que indiquen de qué recurso es cada detalle | Recorrido con Tab en `/` |
| QA-12 | P3 | Andrés/Diego | Con presupuesto agotado solo se ve «Gastado USD 4.00»; no hay un mensaje de cuota agotada | Mensaje explícito cuando se habiliten las consultas (DF07/AF07) | Escenario `quota`. Hoy las llamadas siguen desactivadas, así que no bloquea |
| QA-13 | P3 | Andrés | Playwright arranca `next start`, pero `next.config` usa `output: "standalone"`; Next.js lo advierte en cada ejecución | Arrancar `node .next/standalone/server.js` o documentar la excepción | Salida de `npx playwright test` |

## Accesibilidad (JF03)

- **axe-core, WCAG 2.2 AA**, 12 páginas en escritorio y móvil: solo aparecen
  QA-01 y QA-02. No hay controles sin nombre, ids duplicados ni contraste de
  texto insuficiente en la interfaz propia.
- **Teclado:** el primer Tab ofrece «Saltar al contenido». El orden de foco del
  explorador sigue el visual: menú, mapa y sus controles, cámara, variable,
  línea temporal, filtros, enlaces. Los 45 primeros elementos enfocables tienen
  indicador visible.
- **Estados anunciados:** carga y avisos del mapa usan `role="status"`, errores
  `role="alert"`, la respuesta de la lectura guiada `aria-live="polite"`.
- **Sin comprobar:** lector de pantalla real (NVDA, VoiceOver), zoom al 200 %,
  Firefox, Safari/WebKit y dispositivos móviles reales.

## Interacción 3D y compatibilidad (JF04)

| Comprobación | Resultado |
| --- | --- |
| Modo inicial | 3D en escritorio; 2D con `prefers-reduced-motion: reduce` (sin giro disponible) |
| Giro | Optativo; se detiene con puntero, rueda o teclado sobre el canvas y al pasar a 2D. No se detiene con los controles de navegación (QA-03) |
| Pantalla completa | Entra y cambia el rótulo del botón. La salida con Escape no se pudo confirmar en headless |
| Sin WebGL | Aviso y tabla disponible (prueba existente) |
| Pérdida de contexto | Sin aviso (QA-04) |
| Teselas externas caídas | Aviso «No se pudo cargar parte del mapa»; tabla disponible |
| Red lenta | Ver QA-08 |
| Móvil 390 px | Sin desbordamiento horizontal; botones de 38–40 px (QA-06) |
| Liberación de recursos | Tras 5 idas y vueltas entre Explorador e Informes: un único canvas y heap JS de 9 a 11 MB |
| Rendimiento | Mapa listo en unos 4,8 s con teselas externas y 1,1 s sin ellas. SwiftShader da unos 3 fps durante el giro: es renderizado por software, no representa una GPU real |

Pendiente: medir fps y consumo en equipos reales, y confirmar el cambio de
pestaña y la salida de pantalla completa en un navegador con interfaz.

## Informes y enlaces (JF06)

- La vista previa, el CSV y el JSON publican los mismos valores por escena;
  la escena sin píxeles válidos queda vacía en CSV, `null` en JSON y
  «Sin datos» en pantalla, nunca cero.
- «Descargar los datos de esta fecha» lleva a la misma escena y la misma
  media que muestra el explorador.
- Una selección inválida en el enlace vuelve al resumen completo; las celdas de
  texto no se exportan como fórmulas.
- El enlace copiado del explorador reproduce fecha, comparación y variable en
  otra pestaña sin avisos; sin portapapeles, el botón explica la alternativa.
- Contenido sintético rotulado en nombre de archivo, CSV y JSON (pruebas
  existentes).

Pendiente: repetir la comparación con un snapshot Landsat real (JF05).

## Datos sintéticos en producción y secretos (AC26, AC27)

`production.spec.ts` arranca un segundo `next start` (puerto 3111) con el mismo
build de producción, sin `ALLOW_SYNTHETIC_FIXTURES`, apuntando a las fixtures.

- **AC26:** las ocho secciones muestran «Producción los bloquea», no muestran
  escenas, estaciones ni métricas sintéticas, y las descargas CSV/JSON responden
  503 sin valores.
- **AC27:** el JavaScript de `.next/static` no contiene los nombres de las
  variables sensibles de `.env.example` (`GEMINI_API_KEY`, `GAMC_WMS_API_KEY`,
  `API_WRITE_TOKEN`, `DATABASE_URL`, `POSTGRES_PASSWORD`), ni `API_INTERNAL_URL`
  o la URL de la API. Al recorrer las ocho secciones y activar una capa WMS, el
  navegador nunca pide nada directamente a la API y el HTML no expone su URL.

Límite: la búsqueda por nombre no detecta un valor secreto copiado a mano en el
código cliente; para eso hace falta revisión de código (AF08). No se comprobó
un despliegue real (JF10).
