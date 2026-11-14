# Viabilidad de fusión y modelos

Revisión de código: 14 de noviembre de 2026. No hay un modelo entrenado y este
documento no informa métricas.

## Qué hay en MÓNICA

Los CSV descargados tienen las columnas `estacion`, `pm10` y `fecha_medicion`.
Son observaciones de PM10 de dos estaciones (Kanata y Semapa). No son
temperatura del aire. La unidad, la zona horaria y las coordenadas siguen sin
verificar; el análisis físico permanece deshabilitado. Ver
`docs/gamc-resources.md`.

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

## Estado de A10–A12

No se entrenó baseline, Random Forest ni otro modelo. `/v1/models` y
`/v1/scenarios` permanecen `unavailable` y no publican métricas ni resultados
de intervención. Cambiar NDVI en un regresor no está evaluado como efecto de
plantar árboles.
