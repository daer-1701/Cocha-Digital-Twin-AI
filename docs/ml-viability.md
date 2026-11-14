# Viabilidad de fusión y modelos

Revisión de código: 14 de noviembre de 2026. No hay un modelo entrenado y este
documento no informa métricas.

## Qué hay en MÓNICA

Los CSV descargados tienen las columnas `estacion`, `pm10` y `fecha_medicion`.
Son observaciones de PM10 de dos estaciones (Kanata y Semapa). No son
temperatura del aire. La unidad se declara como µg/m³ desde un informe de la
red; la zona horaria y las coordenadas siguen sin verificar. El análisis físico
permanece deshabilitado. Ver `docs/monica-status.md` y `docs/gamc-resources.md`.

## Qué no se puede calibrar

La LST del piloto Landsat es temperatura superficial al paso del satélite. No
se calibra con PM10: las variables no son intercambiables y PM10 no es una
referencia térmica. El módulo `cocha_api.science.viability` rechaza esa
calibración y devuelve un veredicto no viable, con `metrics` vacío.

## Por qué no alcanza para 15 distritos

Dos estaciones, aunque tengan muchas fechas, no bastan para una validación
espacial de 15 distritos. Además no hay un vector distrital verificado: WMS y
los BBOX anunciados no son polígonos. Sin ese vector no hay series distritales
con las que construir un conjunto de entrenamiento defendible.

## Decisión AF01 (14/11/2026)

ML térmico queda **condicionado**: se habilita solo con series de temperatura
del aire de Semapa (huso, coords, licencia). Hasta entonces, bloqueado.
`/v1/models` y `/v1/scenarios` permanecen `unavailable`. No se publican
métricas. Detalle: `docs/af01-scope.md`.

## Estado de A10–A12

No se entrenó baseline, Random Forest ni otro modelo. A10–A12 siguen
bloqueados hasta la serie térmica de Semapa. Cambiar NDVI en un regresor no
está evaluado como efecto de plantar árboles. Detalle en `docs/andres-blockers.md`.

## MF08 · Decisión antes de entrenar

Con los insumos actuales, detener el entrenamiento para calibrar LST con
MÓNICA. Para evaluar otro objetivo, registrar primero qué variable se quiere
estimar, en qué unidad y para qué área, período y uso.

| Control | Evidencia requerida |
| --- | --- |
| Referencia de EF08 | Variable compatible, instrumento o producto, permiso, resolución, incertidumbre y procedencia. |
| Emparejamiento con MF03 | Período, huella espacial, diferencia temporal tolerada, cobertura y exclusiones de QA documentadas. |
| Evaluación | Inventario de lugares y fechas independientes. Fijar bloques espaciales y temporales según el uso antes de elegir el candidato. Reservar la evaluación final y ajustar el preprocesamiento solo con entrenamiento en cada partición. |
| Comparación | Evaluar el baseline y el candidato con las mismas particiones. Registrar MAE y RMSE en la unidad del objetivo, cobertura de intervalos predictivos, dominio y comportamiento fuera de dominio. Acordar el criterio de aceptación antes de evaluar. |

Si la referencia o la muestra independiente son insuficientes, registrar
el motivo y conservar el estado `unavailable`. Cuando el candidato cumpla
los criterios, entregar a Andrés el artefacto, versión, manifestación de
insumos, particiones, métricas retenidas y reglas de abstención.

## MF09 · Evaluación de escenarios

Para cada escenario propuesto, definir la intervención concreta, el lugar y
horizonte, la comparación de referencia y el resultado esperado del modelo.
La evaluación debe justificar que el modelo admite esa intervención y ese
rango de condiciones. Documentar supuestos, sensibilidad e incertidumbre
antes de exponer resultados en la API. La aceptación predictiva de MF08
por sí sola no satisface este criterio.
