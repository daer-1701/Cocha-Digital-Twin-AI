# Referencia terrestre para ML (EF08)

Actualizado: **14 de noviembre de 2026**.

## Veredicto

**EF08 bloqueada** por decisión AF01 (14/11/2026): ML térmico **solo** si el
GAMC entrega series de **temperatura del aire de Semapa** (huso, coords, unidad
y licencia). MÓNICA PM10 no es esa referencia. Ver `docs/af01-scope.md`.

## Evidencia

| Candidato | Variable | Cobertura | Permiso | Compatible con LST |
| --- | --- | --- | --- | --- |
| CSV MÓNICA (ZIP GAMC) | PM10 | 2 estaciones | Redistribución no confirmada | **No** — PM10 ≠ temperatura |
| Semapa (informe 2021) | Temp. aire, humedad, viento, etc. | Estación Semapa | No incluidas en el ZIP | Potencial, **ausentes** |
| Kanata (informe 2021) | O₃, NOx | Estación Kanata | No incluidas en el ZIP | No térmica |
| Inventar coordenadas / geocodificar | — | — | — | Prohibido |

PM10 nunca se presenta como temperatura en catálogo, API ni UI.

## Qué haría falta si se mantiene ML térmico

1. Serie de temperatura del aire (u otra variable acordada) con huso, unidad,
   coordenadas oficiales y licencia.
2. Cobertura espacial/temporal alineada con el satélite (MF01).
3. Decisión de AF01: incluir ML, condicionarlo o excluirlo del alcance.

Hasta entonces: no inventar etiquetas; `docs/ml-viability.md` permanece vigente.
Mateo (MF08) no debe publicar métricas con referencia insuficiente.
