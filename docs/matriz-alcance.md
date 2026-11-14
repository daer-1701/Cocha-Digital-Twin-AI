# Matriz de alcance y criterios de aceptación (AF01)

Actualizado: **14 de noviembre de 2026**. Borrador preparado por Andrés para
acordar con Eduardo, Mateo, Diego y Julio. **No está aprobado**: las filas
marcadas como «decisión pendiente» necesitan acuerdo del equipo. Ninguna
función prometida se elimina aquí; las condicionales siguen visibles con su
bloqueo hasta que el equipo las confirme o las excluya explícitamente.

Estados de implementación: **implementado** (código presente, pendiente de
validación), **parcial**, **pendiente**, **bloqueado** (falta un dato o una
decisión externa). Ningún estado implica pruebas aprobadas.

## Usuarios

| Usuario | Necesidad | Acceso previsto |
| --- | --- | --- |
| Público / jurado | Explorar evidencia, entender límites | Lectura sin cuenta |
| Equipo técnico | Revisar registros, ejecutar procesos | Roles por secreto de servidor (no cuentas) |
| Revisión científica (Mateo) | Aceptar o retirar resultados | Scripts de operador con `--accepted-by` |

## Funciones

| Función | Clase | Estado | Responsables | Criterio de aceptación | Bloqueo / dependencia |
| --- | --- | --- | --- | --- | --- |
| Explorador 2D/3D LST/NDVI (ventana piloto) | Obligatoria | Implementado | Diego, Mateo | Datos reales del snapshot, QA y procedencia visibles; LST rotulada como superficie; relieve y columnas con escala declarada | Validación MF02, JF04 |
| Comparación de fechas y exportación CSV/JSON del piloto | Obligatoria | Implementado | Diego, Julio | Exportación coincide con pantalla, unidades y fuentes | JF06 |
| Distritos oficiales (selección y mapa) | Obligatoria | Bloqueado | Eduardo, Andrés, Diego | Vector autorizado importado como versión propia; `/v1/territories/districts` disponible | EF02, EF03 |
| Indicadores y series distritales | Obligatoria | Parcial (API y persistencia listas, sin datos) | Mateo, Andrés | Filas aceptadas con período, unidades, `valid_fraction`, procedencia y versión territorial | EF03, MF03, MF04 |
| Tendencias distritales | Obligatoria | Parcial (API lista, sin filas aceptadas) | Mateo, Andrés | Método, intervalo, ajuste múltiple y tamaño de muestra declarados | MF05 |
| Estaciones MÓNICA y revisión de registros | Obligatoria | Implementado (revisión con rol) | Eduardo, Andrés, Diego | Valores y fechas originales, flags, huso no supuesto; acceso solo con rol `reviewer` | EF04, EF05, permiso de redistribución |
| Agregados físicos MÓNICA | Condicional | Bloqueado | Mateo | `analysis_enabled` solo tras validación MF06 y metadatos completos | MF06 |
| Estimación ML | Condicional | Bloqueado | Mateo, Andrés | Modelo aceptado con versión, incertidumbre, dominio y baseline (`docs/model-delivery.md`) | EF08, MF08 |
| Escenarios hipotéticos | Condicional | Bloqueado | Mateo, Andrés, Diego | Modelo apto para intervención; rótulo «escenario», nunca observación | MF09 |
| Índice socioambiental y hotspots | Condicional | Pendiente | Eduardo, Mateo | Variables autorizadas, pesos y sensibilidad transparentes | **Decisión pendiente**, EF06, MF10 |
| Asistente Gemini con citas | Condicional | Implementado, llamadas apagadas | Andrés, Diego | Respuestas con citas válidas o retenidas; presupuesto central; autorización de gasto | **Decisión pendiente** de autorizar gasto (~USD 4) |
| Capas WMS GAMC | Condicional | Implementado (requiere clave) | Eduardo, Andrés | Capas permitidas, atribución y cuotas revisadas | EF09 |
| Historial de procesamiento | Obligatoria | Implementado | Andrés, Julio | Estados, intentos y errores sin secretos | — |
| Informes distritales | Obligatoria | Bloqueado | Diego, Andrés | Solo con resultados oficiales aceptados | AF04 con datos |
| Despliegue público | Condicional | Pendiente | Andrés, Eduardo | Ver `docs/deployment.md`; requiere autorización de entrega | **Decisión pendiente** de entorno y dominio |

## Excluido

| Elemento | Motivo | Origen |
| --- | --- | --- |
| Aplicación móvil nativa / APK | El producto es solo web | Indicación del usuario |
| LST presentada como temperatura del aire | Error científico | `AGENTS.md` |
| PM10 como referencia para calibrar LST | Variables incompatibles | `docs/science.md` |
| Rectángulos demo como distritos municipales | Son sintéticos | `demo-synthetic-v1` |

## Experiencia 3D esperada (pendiente de confirmar)

Propuesta a validar con Diego y Julio: relieve AWS Terrain (Terrarium) ×1.5,
columnas con escala fija de 900 m que codifican el valor (no altura física),
giro optativo que se detiene al interactuar, movimiento reducido respetado y
alternativa tabular. **Decisión pendiente**: si la entrega final exige una vista
3D por distrito oficial o basta la ventana piloto.

## Decisiones pendientes del equipo

1. Confirmar qué funciones condicionales entran en la entrega final.
2. Autorizar (o no) un gasto acotado de Gemini y quién lo aprueba.
3. Elegir el entorno de la API compartida y del despliegue (ver `docs/api-compartida.md`).
4. Política de acceso público a registros MÓNICA según su licencia.
5. Quién firma `--accepted-by` para cada tipo de resultado.
6. Licencia del código del repositorio.
