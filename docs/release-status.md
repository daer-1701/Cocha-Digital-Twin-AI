# Estado de entrega y cierre del proyecto

Actualizado: 14/11/2026. Equipo: Andrés, Eduardo, Mateo, Julio y Diego.

Reparto detallado vigente: [55 tareas pendientes finales](tareas_pendientes_finales.md).
Diego y Julio no tienen Docker; Andrés, Eduardo y Mateo sí. Las asignaciones
detalladas de ese documento prevalecen sobre el resumen C01–C24.

**Estado: piloto ampliado en código, pendiente de validación. No es una entrega
de producción ni un gemelo digital científicamente validado.** El 14/11/2026 se
retomaron las pruebas web con fixtures (lint, tipos, build y Playwright: 97
pasan, 7 incidencias abiertas como `test.fixme`); ver [informe de QA](qa-report.md)
y [matriz de aceptación](acceptance-matrix.md). Las comprobaciones backend,
científicas y de base de datos del estado actual siguen sin ejecutarse; la
regeneración de contratos no equivale a una prueba. No se efectuó despliegue
ni se habilitó consumo Gemini.

## Disponible en código

| Capacidad | Alcance |
| --- | --- |
| Explorador | Landsat LST/NDVI, QA, mapa 2D/3D, giro, centrado, pantalla completa, selección de celdas y recorrido temporal |
| Comparación | Fechas y 15 rectángulos sintéticos, adquisición explícita; no distritos oficiales |
| Estaciones | Fichas MÓNICA, metadatos pendientes, importación transaccional, duplicados sin sobrescritura |
| Revisión MÓNICA | `GET /v1/stations/{id}/observations`, paginado, calidad y procedencia; apagado por defecto mediante `MONICA_REVIEW_ENABLED` |
| Procesamiento | `/procesamiento` consume `/v1/jobs`, primero los más recientes; solo lectura |
| Informes | CSV/JSON del piloto con procedencia y faltantes |
| Lectura guiada | Preguntas predefinidas sobre evidencia, sin IA ni gasto; no sustituye la integración Gemini |
| Persistencia | Migraciones PostGIS, registros científicos y contratos generados |
| Operación local | Compose, backup con checksum y restauración en base nueva; herramientas sin ejecutar en esta entrega |

## Trabajo restante para el alcance completo

Una tarea se cierra por su criterio de aceptación, no por tener una pantalla.

| ID | Responsable | Pendiente | Dependencia y criterio de cierre |
| --- | --- | --- | --- |
| C01 | Andrés + equipo | Fijar el alcance final: tablero ambiental, sensado virtual o ambos | Documento de aceptación; confirmar requisitos oficiales antes de atribuirlos al reto |
| C02 | Eduardo | Obtener vector oficial de los 15 distritos | Archivo autorizado, CRS, versión, licencia y correspondencia territorial verificadas |
| C03 | Eduardo | Completar metadatos MÓNICA | Coordenadas, huso, instrumentos, interpretación de QA y permisos documentados |
| C04 | Eduardo | Inventariar cobertura satelital y disponibilidad temporal | Catálogo acotado, costos y volumen acordados antes de nuevas descargas |
| C05 | Eduardo | Capas socioambientales complementarias si entran en C01 | Geometrías/datos autorizados de áreas verdes, población y equipamiento con unidades y fechas |
| C06 | Mateo | Pipeline multitemporal reproducible | C04; escalas, QA, CRS, cobertura y manifiestos con resultados reproducibles |
| C07 | Mateo + Andrés | Agregación por distritos oficiales y persistencia | C02/C06; estadísticas zonales, tratamiento de bordes/NoData y versión de geometría |
| C08 | Mateo | Tendencias e incertidumbre | C06/C07; temporadas comparables, autocorrelación, intervalos y multiplicidad cuando aplique |
| C09 | Mateo | Relación LST–NDVI | Validación espacial/temporal y limitación explícita de causalidad |
| C10 | Mateo | Viabilidad del objetivo ML | C03/C06; referencia compatible y suficiente. PM10 no calibra LST |
| C11 | Mateo | Baseline y modelo candidato si C10 es viable | Separación espacial/temporal sin fuga, métricas fuera de muestra y dominio de uso |
| C12 | Mateo + Andrés | Publicar estimaciones si C11 pasa | Artefacto versionado, incertidumbre, trazabilidad y contratos; si no, permanece bloqueado |
| C13 | Mateo | Escenarios solo con modelo válido para intervención | C11; supuestos, sensibilidad e incertidumbre. Cambiar NDVI no demuestra efecto de plantar árboles |
| C14 | Andrés | Integración Gemini real | Proveedor, tarifas vigentes, permisos, límites de tokens, caché, control central de presupuesto y autorización de gasto |
| C15 | Andrés | Orquestación y recuperación de trabajos | Reintentos idempotentes, estados interrumpidos, publicación atómica; elegir cola solo si hace falta |
| C16 | Andrés | Permisos y acceso de producción | Roles de operador/consulta, secretos, restricciones de escrituras y revisión de datos; el token compartido actual no equivale a roles |
| C17 | Diego | Integrar distritos, series, modelos y escenarios reales | C07/C08/C12/C13; fuentes y límites visibles, estados parciales y ausencia de cifras inventadas |
| C18 | Diego | Cerrar UX y accesibilidad | Teclado, móvil, movimiento reducido, mapa sin WebGL, pantalla completa y alternativas tabulares |
| C19 | Diego | Manual, ayuda y presentación con un caso real | Capturas rotuladas, guion reproducible y distinguir demo de observación |
| C20 | Andrés/Mateo + Julio | Ejecutar checks y corregir regresiones | Andrés/Mateo: Python, ciencia, migraciones y PostGIS aislado. Julio: lint, tipos, build, contratos TS y Playwright sin Docker |
| C21 | Julio | Integración con API y proveedores reales | Datos reales acotados, WMS, fallos de red y permisos; sin usar la DB de desarrollo para pruebas de escritura |
| C22 | Eduardo | Backup y restauración comprobados | Verificar dump, snapshots, PostGIS, Alembic y conteos en base nueva; programar retención y copias externas |
| C23 | Andrés | Preparar despliegue y observabilidad | Entorno elegido, HTTPS, red privada DB, privilegios mínimos, alertas, costos y rollback; Julio revisa el resultado desde navegador |
| C24 | Equipo | Aceptación y publicación | C01 y criterios aplicables aprobados; licencias de código/datos decididas; autorización de despliegue |

Diego y Julio trabajan con fixtures o una API compartida: no necesitan Docker ni PostGIS
local. Cada persona usa su propio clon/worktree y coordina archivos con el equipo.
El reparto no autoriza mensajes externos, solicitudes al GAMC, gastos ni publicación.

## Orden de cierre

1. Andrés fija contratos; Eduardo desbloquea fuentes; Diego continúa con fixtures;
   Julio prepara la verificación para cuando el usuario la ejecute.
2. Mateo valida la evidencia y decide qué análisis son defendibles.
3. Andrés y Diego integran resultados aceptados, con pruebas de Julio.
4. Se verifican recuperación, permisos y operación antes de publicar.

## Criterios de entrega

- [ ] Contratos y todas las comprobaciones requeridas pasan sobre el mismo estado de código.
- [ ] Se demuestra un recorrido real fuente → procesamiento → API → mapa → exportación.
- [ ] Los análisis exigidos por el alcance tienen validación, incertidumbre y procedencia.
- [ ] Derechos de uso y redistribución de datos, licencia de código y permisos resueltos.
- [ ] Recuperación desde backup y rollback de aplicación demostrados.
- [ ] No quedan bloqueos de datos necesarios para las funciones comprometidas.
- [ ] Equipo acepta alcance, documentación y despliegue.

No marcar estos puntos por inferencia. La existencia del código o de pruebas
escritas no demuestra que se hayan ejecutado satisfactoriamente.
