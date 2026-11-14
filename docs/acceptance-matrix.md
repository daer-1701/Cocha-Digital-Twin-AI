# Matriz de aceptación y regresiones (JF01)

Responsable: Julio. Actualizada el 14/11/2026 sobre el commit `9bbbe8f` más
los cambios de QA de esa fecha. Incidencias y detalle de las pruebas:
[informe de QA](qa-report.md). Reparto y dependencias:
[tareas pendientes finales](tareas_pendientes_finales.md).

AF01 todavía no fijó qué funciones son obligatorias, condicionales o
excluidas. Esta matriz cubre todas las funciones previstas; cuando AF01 se
cierre, marcar cuáles quedan fuera del alcance en lugar de borrarlas.

## Cómo leerla

- **Demo:** verificado en navegador con fixtures sintéticas. Valida interfaz,
  contrato y estados; no valida datos de Cochabamba.
- **Real:** verificación con API compartida y datos oficiales (JF05). Ninguna
  fila está aceptada con datos reales todavía.
- **Estado:** pendiente, en curso, bloqueada, en revisión o terminada, según
  el plan. «En revisión» indica evidencia demo completa a la espera de la
  verificación real o de la firma del responsable.
- Las pruebas están en `apps/web/test/e2e/`. Comando:
  `npm run build` y `npm run test:e2e -w @cocha/web`.

## Funciones de la web

| ID | Función y caso | Resultado esperado | Datos necesarios | Responsable | Evidencia demo | Real | Estado |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AC01 | Explorador: fecha, comparación y variable | Vista y URL coinciden; recargar conserva los filtros | Snapshot Landsat | Diego | `explorer.spec.ts` | Pendiente JF05 | En revisión |
| AC02 | Explorador: vacío, sin escenas, parcial, error y API lenta | Mensaje específico; huecos como «Sin datos», nunca cero | Escenarios `empty`, `no-scenes`, `partial`, `error`, `slow` | Diego | `explorer.spec.ts` | Error real de red pendiente | En revisión |
| AC03 | Enlaces con filtros inválidos | Aviso y valores por defecto, sin fallo | Ninguno | Diego | `explorer.spec.ts` | — | En revisión |
| AC04 | Interacción 3D: modo inicial, giro, centrado, pantalla completa, celda | Giro optativo que se detiene al interactuar; 2D con movimiento reducido | Snapshot; teselas externas opcionales | Diego | `map3d.spec.ts` | Equipos reales pendientes | En curso: QA-03, QA-04, QA-08 |
| AC05 | Sin WebGL, teselas caídas, pérdida de contexto | Aviso y tabla disponible | Ninguno | Diego | `accessibility.spec.ts`, `map3d.spec.ts` | — | En curso: QA-04 |
| AC06 | Capas WMS municipales por proxy | Deshabilitadas con motivo sin clave; leyenda con clave; parámetros validados | Clave GAMC en servidor | Diego, Andrés, Eduardo (EF09) | `layers.spec.ts` | Servicio GAMC real pendiente | En revisión |
| AC07 | Pendiente descriptiva del piloto | Rotulada como descriptiva; «no concluyente» con menos de 3 valores | Snapshot | Diego, Mateo | `explorer.spec.ts` | Pendiente | En revisión |
| AC08 | Comparación de 15 rectángulos demo | Misma escena para LST y NDVI; rotulado como sintético | Fixture `demo-synthetic-v1` | Diego | `sections.spec.ts` | No aplica: nunca es dato real | En revisión |
| AC09 | Distritos oficiales: selección, mapa e indicadores | Polígonos oficiales con versión y licencia | Vector EF02/EF03, AF04, MF04 | Diego (DF03) | Solo el estado bloqueado (`sections.spec.ts`) | — | Bloqueada |
| AC10 | Series y tendencias distritales con incertidumbre | Intervalos, cobertura y tabla alternativa | MF05, AF04 | Diego (DF04) | Solo el estado no disponible | — | Bloqueada |
| AC11 | Fichas de estaciones MÓNICA | Unidad, metadatos pendientes; sin marcador ni análisis sin coordenadas | `/v1/stations` | Diego, Eduardo (EF04) | `sections.spec.ts`, `records.spec.ts` | Pendiente | En revisión |
| AC12 | Revisión de registros MÓNICA | Paginación; ceros, negativos y faltantes conservados; desactivada por defecto | `MONICA_REVIEW_ENABLED` e importación EF05 | Diego, Andrés (AF05) | `records.spec.ts` | Pendiente; requiere permiso de datos | En curso: QA-07 |
| AC13 | Historial de procesamiento | Más recientes primero, paginación, estados traducidos, solo lectura | `/v1/jobs` | Diego, Andrés (AF09) | `records.spec.ts` | Pendiente | En revisión |
| AC14 | Informes CSV/JSON del piloto | Igual a la pantalla; faltantes vacíos/null; sin fórmulas; demo rotulado | Snapshot | Diego (DF08) | `reports.spec.ts`, `links.spec.ts` | Pendiente | En revisión |
| AC15 | Informes distritales | Solo con resultados oficiales | AF04, MF05 | Diego (DF08) | — | — | Bloqueada |
| AC16 | Enlaces compartidos | El enlace copiado reproduce la vista en otra pestaña | Ninguno | Diego | `links.spec.ts` | — | En revisión |
| AC17 | Lectura guiada sin IA | Respuestas con campos publicados; «sin datos» en lugar de cero; sin gasto | Snapshot | Diego | `sections.spec.ts` | Pendiente | En revisión |
| AC18 | Estado del asistente y presupuesto | Llamadas desactivadas, precios verificados o no, gasto informado | `/v1/assistant` | Diego, Andrés | `sections.spec.ts` (escenarios `available`, `wms`, `quota`) | Pendiente | En curso: QA-12 |
| AC19 | Conversación Gemini con citas | Citas navegables, cuota, errores y cancelación; sin claves en cliente | AF07 y autorización de gasto | Diego (DF07) | — | — | Bloqueada |
| AC20 | Estimaciones de modelos | Intervalo, dominio y métricas fuera de muestra | MF08, AF06 | Diego (DF06) | Solo bloqueo rotulado (`sections.spec.ts`) | — | Bloqueada |
| AC21 | Escenarios hipotéticos | Rotulados como simulación; sin valores de ejemplo | MF09, AF06 | Diego (DF06) | Solo bloqueo rotulado | — | Bloqueada |
| AC22 | Índice socioambiental y hotspots | Pesos y sensibilidad visibles | EF06, MF10; alcance AF01 | Diego (DF09) | — | — | Bloqueada |
| AC23 | Accesibilidad WCAG 2.2 AA | Sin incumplimientos axe; teclado, foco, nombres, h1 único | Ninguno | Diego (DF10), Julio verifica | `axe.spec.ts`, `accessibility.spec.ts` | Lector de pantalla real pendiente | En curso: QA-01, QA-02, QA-05, QA-10, QA-11 |
| AC24 | Responsive 320 y 390 px | Sin desbordamiento global; tablas desplazables | Ninguno | Diego | `accessibility.spec.ts` | Dispositivos reales pendientes | En curso: QA-06 |
| AC25 | Rótulos de naturaleza del dato | Observación, estimación, simulación y sintético distinguidos | Ninguno | Diego | Varias pruebas (`expectDemo`) | — | En curso: QA-09 |
| AC26 | Datos sintéticos bloqueados en producción | Un build de producción sin `ALLOW_SYNTHETIC_FIXTURES` rechaza fixtures | Ninguno | Andrés, Diego | **Sin prueba**: Playwright siempre habilita las fixtures | — | Pendiente |
| AC27 | Secretos solo en servidor | Ninguna clave ni URL interna en el cliente | Ninguno | Andrés | `layers.spec.ts` comprueba el proxy; falta revisar el bundle | — | Pendiente |

## Verificaciones de otros responsables

Julio revisa la evidencia; no las ejecuta, porque requieren Docker, Python o
acceso a servidores.

| ID | Verificación | Responsable | Evidencia esperada | Estado |
| --- | --- | --- | --- | --- |
| AC30 | Ruff, pytest con `--group science`, contratos regenerados | Andrés, Mateo | Salida de comandos en el mismo commit | Pendiente para el commit candidato |
| AC31 | Migraciones Alembic y `check_containers.ps1` en base `_test` | Andrés | Salida del script; A01 pasó el 14/11 en un commit anterior | Pendiente para el commit candidato |
| AC32 | Importación MÓNICA y vector distrital en base aislada | Eduardo | Conteos origen/destino y validez geométrica | Bloqueada (EF02, EF04) |
| AC33 | Backup y restauración en base nueva | Eduardo | Informe de ensayo (EF10) | Pendiente |
| AC34 | Validación científica de tendencias, LST–NDVI y ML | Mateo | Informe MF11 | Bloqueada |

## Tareas de Julio bloqueadas

| Tarea | Bloqueo | Qué hará Julio cuando se desbloquee |
| --- | --- | --- |
| JF05 | Falta la API compartida con datos reales (AF03, AF04, AF05) y DF03–DF05 | Repetir AC01–AC14 contra la URL acordada; reportar fallos de DB a Andrés |
| JF07 | DF06 y DF07 dependen de AF06/AF07, MF08/MF09 y de autorización de gasto | Verificar rótulos, incertidumbre, citas, cuota y errores con el proveedor simulado |
| JF09 | MF11 y DF11 no existen; no hay snapshot real para capturas | Guion, capturas sin franja «Demo» y plan sin Internet |
| JF10 | No hay despliegue autorizado (AF10) | HTTPS, navegación, errores y disponibilidad desde el navegador |
| JF11 | Requiere JF02–JF10 aplicables y AF01 | Reunir firmas, incidencias críticas cerradas y evidencia ligada al commit candidato |

## Regresiones obligatorias antes de aceptar un commit

1. `npm run lint`, `npm run typecheck`, `npm run build` y
   `npm run test:e2e -w @cocha/web` sin fallos. Las `test.fixme` solo pueden
   quedar si su incidencia no es bloqueante y está en el informe.
2. Comprobaciones backend y de base de datos del mismo commit (AC30, AC31).
3. Recorrido real de AC01, AC11–AC14 sin franja «Demo» cuando exista la API
   compartida.
