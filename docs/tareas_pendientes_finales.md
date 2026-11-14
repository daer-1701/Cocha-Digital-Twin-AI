# Tareas pendientes finales — Cocha Digital Twin AI

Actualizado: **14 de noviembre de 2026**.

Este plan cierra la plataforma ambiental interactiva 3D de Cocha Digital Twin AI:
exploración, datos distritales, estaciones, análisis, modelos, escenarios,
asistente, informes y operación. Se parte del código existente; no se reconstruye
lo que ya está implementado. Las funciones nuevas y las correcciones recientes
todavía necesitan validación.

**Este documento es el reparto vigente.** Sustituye las asignaciones de personas
de `team-plan.md` y `release-status.md`; conserva sus antecedentes técnicos.
Incluye **55 tareas: 11 por persona**. El número no representa igual esfuerzo:
Andrés y Mateo concentran las integraciones y decisiones científicas difíciles.

## 1. Responsabilidades y herramientas

| Persona | Docker | Responsabilidad principal | Entorno |
| --- | --- | --- | --- |
| Andrés | Sí | Backend, contratos, seguridad, integración Gemini, arquitectura y despliegue | Python/uv, PostGIS de pruebas, Docker, API |
| Eduardo | Sí | Datos oficiales, GIS, importación, permisos, respaldo y recuperación | Python/uv, herramientas GIS, PostGIS y Docker |
| Mateo | Sí | Procesamiento, QA científico, estadísticas, ML e incertidumbre | Python/uv, procesamiento científico y Docker si corresponde |
| Diego | **No** | Interfaz, interacción 3D, mapas, gráficos y recorridos de usuario | Node/npm, fixtures locales y API compartida |
| Julio | **No** | QA web, accesibilidad, integración desde el cliente, documentación y aceptación | Node/npm, Playwright, navegador y API compartida |

Diego y Julio no deben instalar Docker, PostGIS ni levantar workers. Andrés
entrega una API de desarrollo accesible y datos de prueba; mientras tanto ambos
usan `npm run dev:fixtures`. Los fallos que necesitan acceso a la DB se entregan
a Andrés/Eduardo con pasos reproducibles. Mateo recibe los fallos científicos.

Las pruebas descritas son **trabajo pendiente del equipo**. Esta planificación
no las ejecuta: se conserva la instrucción del usuario de realizarlas después.

## 2. Qué ya existe y debe conservarse

- Monorepo npm/uv, API FastAPI, contratos generados, PostGIS y migraciones.
- Piloto real Landsat con tres adquisiciones de julio 2022–2024, LST/NDVI y QA.
- Explorador MapLibre 2D/3D, línea temporal, giro, pantalla completa e inspector.
- Exportación CSV/JSON del piloto y comparación de fechas.
- Importador MÓNICA con transacciones y política de duplicados; fichas y revisión
  paginada local bajo `MONICA_REVIEW_ENABLED`, apagada por defecto.
- Historial de procesamiento y ejecutor local de QA.
- Comparación de 15 rectángulos **sintéticos**, con selección de adquisición.
- Lectura guiada de evidencia **sin IA** y ledger de presupuesto para un proveedor
  simulado. Gemini real sigue pendiente.
- Herramienta de backup/restauración preparada, todavía sin ensayo aceptado.

La existencia de estos componentes no certifica su integración ni su calidad.
Los resultados antiguos de pruebas no cubren automáticamente los cambios nuevos.

## 3. Cómo cerrar una tarea

Todos los IDs empiezan como **pendientes de cierre**, aunque exista código parcial.
Registrar en el PR o ficha: responsable, estado, commit revisado, archivos,
comandos ejecutados, resultado, evidencia y bloqueos. Estados permitidos:
pendiente, en curso, bloqueada, en revisión, terminada.

Prioridades: **P0** desbloquea el proyecto o evita errores de datos; **P1** completa
funcionalidades; **P2** prepara operación y entrega. Una prioridad no autoriza
saltarse dependencias. ★ identifica trabajo de especial dificultad.

Las tareas de ML, escenarios e índice socioambiental dependen de la viabilidad y
del alcance aceptado en AF01. Si no son viables, deben permanecer bloqueadas o
excluirse mediante decisión explícita del equipo. Un placeholder no las termina.

## 4. Andrés — backend e integración, con Docker

| ID | Prioridad | Tarea | Dependencias | Criterio de cierre |
| --- | --- | --- | --- | --- |
| AF01 | P0 | Acordar alcance y criterios de aceptación con los cinco | Ninguna | Matriz de funciones obligatorias, condicionales y excluidas, usuarios y entregables; aclarar qué experiencia interactiva se espera del producto 3D |
| AF02 ★ | P0 | Estabilizar backend, importador y migraciones sobre base aislada | Ninguna | Ruff, pruebas Python/ciencia relacionadas, migraciones y regresiones de importación parcial/duplicados pasan; ninguna escritura en desarrollo |
| AF03 | P0 | Preparar API compartida y contratos para Diego/Julio | AF02 | URL accesible, instrucciones, datos permitidos, OpenAPI y errores documentados; fixtures equivalentes a contratos; sin entregar secretos de servidor |
| AF04 ★ | P1 | Completar persistencia y API de territorios, indicadores, series y tendencias oficiales | EF03, MF04, MF05 | Filtros, paginación, períodos, versión territorial, unidades, QA y procedencia; consultas eficientes; contratos generados y endpoints consumibles |
| AF05 | P1 | Completar API MÓNICA y controles de acceso a sus registros | EF05, MF06, AF08 | Registros y agregados permitidos distinguidos; hora/unidad correctas; flags y procedencia; habilitación de análisis solo cuando se acepta la validación |
| AF06 ★ | P1 | Integrar artefactos y APIs de modelos y escenarios aceptados | MF08, MF09, AF08 | Versiones, entradas acotadas, incertidumbre, fuera de dominio y estados no disponibles; ejecución científica fuera de peticiones largas |
| AF07 ★ | P1 | Integrar Gemini con evidencia y presupuesto global | AF08, AF04; alcance AF01 | Tarifas/modelo verificados al implementar; adaptador servidor, límites, caché, reserva central entre procesos/hosts, conciliación y fallos; sin llamadas facturables hasta autorización acotada |
| AF08 ★ | P0 | Implementar permisos y seguridad para producción | AF01, AF02 | Política de roles/consulta/operación, secretos privados, límites de solicitudes y revisión de rutas; ninguna escritura o función costosa sin permiso comprobado |
| AF09 ★ | P1 | Completar ciclo de vida de trabajos | MF03, EF05 | Estados, reintentos idempotentes, recuperación de interrupciones, cancelación si corresponde, logs sin secretos y publicación atómica; cola solo si la necesidad lo justifica |
| AF10 ★ | P2 | Preparar despliegue, monitoreo y rollback | AF08, AF09, EF10 | Entorno elegido, HTTPS, DB privada, permisos mínimos, salud/alertas, costos y rollback; documentación reproducible. Publicar requiere autorización de entrega |
| AF11 | P2 | Integrar la versión final y cerrar fallos técnicos | AF04–AF10 aplicables, EF11, MF11, DF11, JF11 | Mismo commit con controles requeridos en verde, ningún defecto bloqueante, manual y configuración coherentes; aceptación del equipo antes de publicar |

Archivos principales: `services/api/`, `services/workers/`, `packages/shared/`,
`compose*.yaml`, `infrastructure/`, configuración y workflows. Andrés es el
integrador de contratos; los demás no editan a mano los tipos generados.

## 5. Eduardo — fuentes, GIS y recuperación, con Docker

Estado de avance local (14/11/2026): ver `docs/eduardo-status.md`. Los IDs
siguen pendientes de cierre humano; no se marca terminado sin evidencia de
aceptación. Artefactos ya producidos: inventario, auditoría MÓNICA, borrador
EF02, validadores/import oficial, plan satelital, referencia terrestre,
verificación WMS/relieve documentada, procedimiento de backup y paquete de datos.

| ID | Prioridad | Tarea | Dependencias | Criterio de cierre |
| --- | --- | --- | --- | --- |
| EF01 | P0 | Auditar inventario real de archivos, fuentes y permisos | Ninguna | Catálogo con disponibilidad, checksum, fecha, versión, cobertura, unidades, licencia y bloqueos; no repetir descargas ya disponibles |
| EF02 ★ | P0 | Conseguir vector oficial de los 15 distritos | EF01 | Archivo/servicio de features autorizado, fuente primaria y versión; WMS o rectángulos demo no sustituyen el vector |
| EF03 ★ | P0 | Validar e importar geometrías oficiales | EF02, AF02 | CRS/SRID, IDs, geometrías válidas, superposiciones/huecos revisados, límites y cambios de versión documentados; carga reproducible sin sobrescribir fixtures por accidente |
| EF04 | P0 | Completar identidad, huso, coordenadas, unidades y QA MÓNICA | EF01 | Evidencia de cada campo y permisos; registrar qué sigue sin conocerse; PM10 nunca se presenta como temperatura |
| EF05 ★ | P1 | Importar y auditar MÓNICA en entorno aislado | EF04, AF02 | Conteos origen/destino, duplicados, ceros, negativos, faltantes y reimportación explicados; política de correcciones oficiales; procedencia conservada |
| EF06 | P1 | Adquirir capas socioambientales aceptadas en el alcance | EF01, AF01 | Áreas verdes, población/equipamiento/transporte pertinentes con datos autorizados, fechas y unidades; equivalencia temporal evaluada |
| EF07 | P0 | Inventariar disponibilidad satelital y planificar adquisición acotada | EF01, MF01 | Producto, bandas, resolución, período, acceso, QA, volumen y presupuesto conocidos; muestra antes de ampliar descargas |
| EF08 | P1 | Obtener referencia terrestre compatible si se mantiene ML | EF04, MF01 | Variable objetivo, sensores, cobertura y permiso aceptables; documentar si la referencia no existe o es insuficiente |
| EF09 | P1 | Verificar integración WMS real y procedencia del relieve 3D | AF03, EF01 | Capas permitidas, bbox/CRS, atribución, fallos, cuotas y licencia del relieve revisados; no atribuirle precisión no comprobada |
| EF10 ★ | P2 | Ensayar backup, restauración y recuperación | AF02 | Dump/checksum, snapshots y originales respaldados; restauración en DB nueva, PostGIS/Alembic/conteos verificados; retención y copia externa definidas |
| EF11 | P2 | Entregar paquete de datos reproducible | EF03, EF05, EF06 aplicable, EF07, EF09 | Catálogo final, scripts, manifiestos, permisos y muestra autorizada para integración; archivos grandes fuera de Git; instrucciones para otro equipo |

Archivos principales: `data/catalog/`, scripts de adquisición/importación,
documentación GAMC/MÓNICA y procedimientos de respaldo. Coordinar cambios de
modelos y migraciones con Andrés. Las solicitudes externas al GAMC se gestionan
por el equipo; este plan no autoriza al agente a enviar mensajes por su cuenta.

## 6. Mateo — procesamiento y ciencia, con Docker

| ID | Prioridad | Tarea | Dependencias | Criterio de cierre |
| --- | --- | --- | --- | --- |
| MF01 ★ | P0 | Fijar diseño científico, variables y soporte temporal/espacial | AF01, EF01 | Protocolo que define objetivos, temporadas, unidad de análisis, datos mínimos, QA y reglas de publicación antes de entrenar |
| MF02 | P0 | Revisar y validar el piloto LST/NDVI existente | Ninguna | Escalas/offsets, máscara QA, NoData, NDVI, resolución y procedencia revisados con casos pequeños; pruebas científicas propias ejecutadas cuando se retomen |
| MF03 ★ | P1 | Completar procesamiento multitemporal reproducible | MF01, MF02, EF07 | Lotes acotados, manifiestos, CRS/resolución, criterios de aceptación y publicación completa; sin descargar colecciones enteras por defecto |
| MF04 ★ | P1 | Implementar estadísticas zonales oficiales y series comparables | EF03, MF03 | Ponderación espacial cuando corresponda, bordes, cobertura válida, faltantes y períodos documentados; persistencia coordinada con Andrés |
| MF05 ★ | P1 | Calcular tendencias, anomalías e incertidumbre | MF04 | Estacionalidad, autocorrelación, intervalos y comparaciones múltiples tratados según método; magnitud/unidad temporal claras; tamaño de muestra suficiente |
| MF06 ★ | P1 | Validar series MÓNICA y reglas de agregación | EF05, MF01 | Reconciliación temporal, QA y cobertura; no rellenar faltantes con cero; determinar qué análisis se habilita y por qué |
| MF07 ★ | P1 | Analizar asociación LST–NDVI y diferencias territoriales | MF04, MF05 | Estrategia espacial/temporal sin fuga, efectos descriptivos e incertidumbre; evitar atribuir causalidad; contrastes norte/sur solo con áreas justificadas |
| MF08 ★ | P1 | Resolver viabilidad, entrenar baseline/modelo y validar ML | EF08, MF03, MF06 según objetivo | Particiones bloqueadas, métricas fuera de muestra, comparación baseline, dominio, incertidumbre y artefacto versionado; detener publicación si la referencia no alcanza |
| MF09 ★ | P1 | Diseñar y validar escenarios hipotéticos | MF08 | Modelo apto para intervención, supuestos, rangos válidos y sensibilidad; separar simulación de predicción/observación; no vender causalidad no identificada |
| MF10 ★ | P1 | Definir índice socioambiental y hotspots si AF01 los incluye | EF06, MF04, MF05 | Variables, normalización, pesos, sensibilidad y faltantes transparentes; detección de hotspots justificada y validada |
| MF11 | P2 | Entregar informe científico y revisión de resultados | MF05–MF10 aplicables | Método reproducible, límites, evidencia, figuras y cifras concordantes con API; revisión de interpretaciones del frontend y del asistente |

Archivos principales: `services/api/src/cocha_api/science/`, procesamiento,
notebooks de apoyo y `docs/science.md`. El cálculo científico vive fuera de React
y de solicitudes HTTP largas. No se inventan métricas para cerrar ML/escenarios.

## 7. Diego — frontend e interacción 3D, sin Docker

| ID | Prioridad | Tarea | Dependencias | Criterio de cierre |
| --- | --- | --- | --- | --- |
| DF01 | P0 | Estabilizar el frontend actual y sus nuevas interacciones | Ninguna; fixtures existentes | Corregir fallos en mapa, línea temporal, inspector, navegación y páginas nuevas; carga/error/vacío claros; trabajar con Node y fixtures |
| DF02 | P1 | Cerrar experiencia de cámara y relieve 3D | DF01, EF09 para fuentes | Giro optativo, pausa al interactuar, centrado, pantalla completa, movimiento reducido y liberación de recursos; altura gráfica diferenciada del relieve |
| DF03 | P1 | Integrar selección y mapa de distritos oficiales | AF04 | Selección, resaltado, filtros y URL compartible; polígonos correctos, sin presentar rectángulos demo como límites municipales |
| DF04 | P1 | Completar comparación, series y tendencias territoriales | AF04, MF05, MF07 | Períodos consistentes, unidades, intervalos y cobertura; gráficos con huecos y tabla alternativa; no calcular ciencia en React |
| DF05 | P1 | Completar estaciones y registros MÓNICA | AF05 | Fichas, QA, paginación, origen y fechas; estados restringidos y metadatos pendientes; sin convertir el huso por suposición |
| DF06 | P1 | Integrar estimaciones y escenarios aceptados | AF06 | Controles con límites del modelo, comparación base/escenario, incertidumbre y fuera de dominio; rótulos correctos |
| DF07 | P1 | Integrar conversación Gemini y evidencia citada | AF07 | Pregunta/respuesta, citas navegables, carga, cuota agotada, errores y cancelación de espera; sin claves en cliente ni reemplazo silencioso por texto ficticio |
| DF08 | P1 | Completar informes, exportación y trazabilidad visual | AF04, AF05; AF06 si aplica | Exportaciones reflejan filtros y datos visibles, fechas/unidades/QA/fuentes; informes distritales solo cuando existan resultados oficiales |
| DF09 | P1 | Incorporar capas socioambientales e índice si aplican | EF06, AF04, MF10 | Leyendas, permisos, período, pesos y sensibilidad accesibles; ninguna puntuación arbitraria |
| DF10 | P1 | Pulir accesibilidad, responsive y rendimiento de interacción | DF02–DF09 aplicables, hallazgos JF03/JF04 | Navegación por teclado, foco, contraste, lector, móvil, WebGL ausente, conexión lenta y alternativas tabulares; corregir incidencias priorizadas |
| DF11 | P2 | Cerrar diseño y recorrido de demostración | DF10, JF05, JF06, JF07 | Recorrido real coherente, textos claros, manual visual/capturas y cero defectos visuales bloqueantes en la versión candidata |

Archivos principales: componentes y páginas de `apps/web/src/`, estilos y
adaptadores de frontend. Diego coordina contratos con Andrés y correcciones de
pruebas con Julio; no modifica a mano OpenAPI ni tipos generados.

## 8. Julio — calidad, documentación y aceptación, sin Docker

| ID | Prioridad | Tarea | Dependencias | Criterio de cierre |
| --- | --- | --- | --- | --- |
| JF01 | P0 | Crear matriz de aceptación y regresiones | AF01; puede iniciar inventario ya | Cada función tiene caso, resultado esperado, datos necesarios, responsable y evidencia; separar demo, dato real y bloqueos |
| JF02 | P0 | Mantener fixtures y suite web alineadas con contratos | AF03 para contratos nuevos | Datos sintéticos rotulados, escenarios normal/vacío/error/parcial/cuota; ejecutar lint, tipos, build y Playwright cuando se retomen pruebas; fallos reproducibles |
| JF03 | P1 | Auditar accesibilidad y navegación | DF01 | Teclado, foco, etiquetas, lectores, tablas alternativas, estados anunciados y contraste; informe con prioridad y pasos, correcciones de Diego verificadas |
| JF04 | P1 | Auditar interacción 3D y compatibilidad | DF02 | Móvil/escritorio, movimiento reducido, WebGL ausente, giro, pantalla completa, red lenta y pérdidas de contexto; evidencias y consumo/rendimiento observado |
| JF05 | P1 | Comprobar frontend contra API compartida real | AF03, AF04, AF05, DF03–DF05 | Flujo fuente → API → pantalla, paginación y fallos; reportar problemas DB a Andrés, sin levantar PostGIS ni manipular datos reales |
| JF06 | P1 | Comprobar informes y enlaces compartidos | DF08 | CSV/JSON y pantalla coinciden, faltantes/formato/filtros correctos, enlaces reproducibles, contenido sintético identificado y exportación segura |
| JF07 | P1 | Verificar asistente, modelos y escenarios desde el cliente | DF06, DF07 | Rótulos, incertidumbre, citas, casos fuera de dominio, errores/cuotas; proveedor simulado por defecto, llamadas pagadas solo en sesión autorizada |
| JF08 | P1 | Mantener backlog, documentación y control de contradicciones | JF01; continuo | README, manual, requisitos, estado y prompts reflejan implementación real; reunir licencias/referencias con Eduardo y decisión de licencia de código del equipo |
| JF09 | P2 | Preparar manual operativo para usuarios y presentación | MF11, DF11 | Guion, capturas/video identificados, instrucciones para Diego/Julio sin Docker y plan de demostración si falla Internet |
| JF10 | P2 | Validar despliegue desde navegador y endpoints públicos autorizados | AF10; después de despliegue autorizado | HTTPS, navegación, carga, errores y disponibilidad externa revisados; Andrés administra servidores y Eduardo ejecuta restauraciones |
| JF11 | P2 | Coordinar aceptación final y expediente de entrega | JF02–JF10 aplicables | Matriz firmada por responsables, incidencias críticas resueltas, evidencia ligada al commit candidato, bloqueos explícitos; no sustituye checks backend de Andrés/Mateo |

Avance del 14/11/2026: [matriz de aceptación](acceptance-matrix.md) e
[informe de QA](qa-report.md). JF01–JF04, JF06 y JF08 quedan en revisión, con
incidencias asignadas a Diego y Andrés; JF05, JF07, JF09, JF10 y JF11 están
bloqueadas por sus dependencias.

Archivos principales: `apps/web/test/`, documentación de QA y manuales. Julio
puede revisar resultados de CI desde el navegador. No se le asignan pruebas
locales PostGIS, migraciones, `check_containers.ps1`, backups ni administración
del servidor. Tampoco se le exige Python para completar sus tareas.

## 9. Entregas entre personas y prevención de conflictos

| Entrega | De → hacia | Qué debe acompañarla |
| --- | --- | --- |
| Contrato de API | Andrés → Diego/Julio | OpenAPI generado, ejemplos rotulados, filtros/errores y URL de entorno compartido |
| Datos y metadatos | Eduardo → Mateo/Andrés | Fuente, permisos, versión, CRS/huso/unidades, checksum y limitaciones |
| Resultado científico | Mateo → Andrés/Diego | Artefacto, período, unidad, cobertura, método, incertidumbre y criterio de publicación |
| Frontend | Diego → Julio | Ruta, conducta esperada, fixture/endpoint y limitaciones conocidas |
| Incidencia | Julio → responsable | Commit, pasos, esperado/observado, evidencia y entorno; sin secretos |
| Backup y recuperación | Eduardo → Andrés/Julio | Evidencia del ensayo y procedimiento; Julio revisa el informe, no necesita Docker |

Cada integrante usa su propio clon o worktree. Dos ramas dentro de una misma
carpeta no aíslan cambios. Andrés coordina contratos/migraciones; Diego posee
componentes/estilos; Julio posee pruebas web. Acordar quién edita cada archivo
compartido antes de trabajar en paralelo. Un agente no crea commits, pushes,
despliegues ni llamadas de pago por el solo hecho de recibir este plan.

## 10. Orden recomendado y arranque inmediato

| Etapa | Objetivo | Trabajo que puede comenzar |
| --- | --- | --- |
| 1 | Acordar alcance y estabilizar base | AF01/AF02, EF01/EF02/EF04, MF01/MF02, DF01, JF01 |
| 2 | Desbloquear datos y contratos | AF03/AF08, EF03/EF05/EF07/EF08/EF09, MF03; DF02 y JF02–JF04 con fixtures |
| 3 | Producir e integrar evidencia real | MF04–MF07, AF04/AF05/AF09, DF03–DF05/DF08, JF05/JF06 |
| 4 | Completar funciones condicionadas | EF06, MF08–MF10, AF06/AF07, DF06/DF07/DF09, JF07 |
| 5 | Preparar entrega y operación | EF10/EF11, MF11, AF10, DF10/DF11, JF08–JF11; cierre AF11 |

Las dependencias de cada fila prevalecen sobre la etapa. No hay calendario
garantizado: el vector, permisos y referencia terrestre pueden bloquear la ruta
crítica. Mientras Eduardo resuelve fuentes, Diego y Julio avanzan con fixtures.

Ruta crítica territorial: **EF02 → EF03 + MF03 → MF04 → MF05 → AF04 → DF03/DF04 → JF05**.
Ruta crítica de ML: **EF08 → MF08 → MF09 → AF06 → DF06 → JF07**.
Si la ruta ML no es viable, AF01 debe resolver explícitamente el alcance antes
de prometer una entrega completa.

## 11. Prompt reutilizable para cada tarea

Copiar este bloque en Codex/Cursor y reemplazar `ID_TAREA` por el ID de una fila.
La fila define el trabajo exacto, dependencias y criterio verificable.

```text
Trabaja en la tarea ID_TAREA de docs/tareas_pendientes_finales.md.
Lee AGENTS.md, las reglas del área, README.md, docs/architecture.md y los
archivos afectados. Revisa git status y conserva cambios de otros integrantes.
Consulta la fila completa: responsable, herramientas, dependencias y cierre.
Comprueba qué código existe antes de agregar o reconstruir funcionalidad.
Si soy Diego o Julio, no requieras Docker, PostGIS local ni workers: usa Node,
fixtures o la API compartida de Andrés. Reporta al responsable un bloqueo de DB.
Implementa únicamente el alcance de la tarea y actualiza su documentación.
Carga las skills pertinentes cuando cambies ingesta, ciencia, Gemini o diseño.
Usa contratos generados; no edites los tipos a mano ni expongas secretos.
No inventes datos, geometrías, resultados ML ni validaciones. Si falta una
dependencia, documenta el bloqueo y avanza solo lo independiente.
Respeta la instrucción vigente sobre pruebas: no las ejecutes si siguen
reservadas para el usuario. No marques la tarea terminada sin la evidencia
de aceptación; describe qué debe ejecutar el responsable de validación.
No hagas commit, push, despliegue, mensajes externos ni gasto sin autorización
que los incluya. Entrega archivos modificados, alcance, evidencia y pendientes.
```

Para una tarea de validación, el equipo debe indicar que retoma las pruebas y
usar una base exclusiva si hay escrituras. La creación de este documento no
revoca la restricción actual de no ejecutar pruebas.

## 12. Cuándo está completado

- [ ] AF01 fija alcance y funciones condicionadas, aceptados por el equipo.
- [ ] Fuentes y permisos oficiales están resueltos para todas las funciones prometidas.
- [ ] Evidencia real recorre adquisición → QA → persistencia → API → 3D/tablas → exportación.
- [ ] Datos sintéticos están rotulados y separados del recorrido oficial.
- [ ] Tendencias, ML e intervenciones comprometidas tienen validación científica suficiente.
- [ ] Interfaz accesible, responsive y operable con alternativa 2D/tabular.
- [ ] Pruebas backend, ciencia, DB, contratos y web pasan sobre el mismo commit.
- [ ] Gemini, si se incluye, respeta autorización, evidencia y presupuesto global.
- [ ] Backup/restauración, permisos, monitoreo y rollback se demostraron.
- [ ] Documentación y presentación coinciden con el producto entregado.
- [ ] No quedan incidencias bloqueantes ni funciones prometidas sin implementar.
- [ ] Los cinco aceptan la entrega y se autoriza la publicación.

**Una demo visual terminada no certifica el proyecto científico completo.**
Un resultado bloqueado debe resolverse o retirarse del alcance por decisión
explícita; nunca sustituirse con cifras, límites o métricas inventados.
