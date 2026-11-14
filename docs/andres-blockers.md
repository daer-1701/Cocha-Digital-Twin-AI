# Bloqueos de Andrés

Cierre honesto al 14 de noviembre de 2026. Estos puntos no se sustituyen con
métricas, polígonos ni respuestas inventadas.

## A10, A11 y A12 — cerrados como bloqueados

No hay una variable objetivo compatible para entrenar o simular.

- MÓNICA es PM10, no temperatura del aire. No calibra la LST del piloto.
- Dos estaciones no alcanzan para validar 15 distritos.
- El vector GAMC verificado sigue ausente. Los rectángulos
  `demo-synthetic-v1` son un fixture de interfaz, no un límite municipal.
- Huso y coordenadas de las estaciones siguen pendientes, así que
  `analysis_enabled` permanece en false.
- No existe un artefacto de modelo entrenado ni una partición de validación.

`/v1/models` y `/v1/scenarios` siguen en `unavailable`. No publican métricas
ni resultados de intervención. Un cambio de NDVI en un regresor no es un
efecto evaluado de plantar árboles.

Se reabren solo con una variable de referencia compatible, documentada, y con
geometrías oficiales si el objetivo es distrital.

## A14 — llamadas en vivo

El modelo `gemini-3.6-flash` y las tarifas de pago 0.75 / 3.75 USD por millón
de tokens (hasta el 2026-12-31) se contrastaron el 14/11/2026 en
<https://ai.google.dev/gemini-api/docs/pricing>. `GET /v1/assistant` muestra
ese estado y mantiene `calls_enabled=false`.

Una llamada real a Gemini necesita autorización explícita, clave solo en el
servidor y el presupuesto acordado. Este cierre no la ejecuta.

## Siguen abiertos

- A03 vector oficial GAMC: bloqueado. La ruta demo no lo cierra.
- A08: unidad declarada; huso, coordenadas y licencia siguen pendientes.
- A18: no hay despliegue productivo ni backup probado.
