# AF01 — alcance acordado (parcial)

Fecha: **14 de noviembre de 2026**. Decisión registrada a petición de Eduardo
para desbloquear EF08 / MF08. Completar el resto de AF01 (3D, usuarios,
entregables) sigue a cargo de Andrés con los cinco.

## ML térmico / calibración LST–estación

**Condicionado y bloqueado hasta nueva evidencia.**

MÓNICA es PM10, no temperatura del aire. No se calibra LST con PM10.

ML térmico (entrenamiento, baseline, escenarios de intervención térmica)
**solo se habilita si el GAMC entrega series de temperatura del aire de Semapa**
(u otra estación acordada) con:

- huso horario,
- coordenadas,
- unidad,
- licencia de uso en el proyecto.

Hasta entonces: `/v1/models` y `/v1/scenarios` permanecen no disponibles;
no se publican métricas inventadas. Ver `docs/ground-reference.md` y
`docs/ml-viability.md`.

## Territorio

Límites distritales oficiales: capa GAMC **Limite Distritos** recuperada por
WMS KML autorizado (`gamc-official-20261114`). Detalle en
`docs/gamc-vector-request.md` y `data/catalog/district_vector_validation.json`.
