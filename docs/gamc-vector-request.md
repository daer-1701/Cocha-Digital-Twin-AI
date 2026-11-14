# Solicitud de vector oficial de 15 distritos (EF02)

Borrador para que el **equipo** envíe por canal autorizado al GAMC.
Este documento **no** se envía automáticamente.

Fecha: **14 de noviembre de 2026**. Responsable de seguimiento: Eduardo.

## Qué se necesita

Archivo o servicio de features autorizado con los **15 distritos municipales**
de Cochabamba, no una imagen WMS ni un BBOX.

| Campo | Requisito |
| --- | --- |
| Formato preferido | GeoJSON (CRS84/EPSG:4326) o GeoPackage; Shapefile aceptable |
| Geometrías | Polígonos/multipolígonos completos, válidos, con IDs estables |
| Atributos mínimos | número de distrito (1–15), nombre oficial, identificador municipal |
| Metadatos | versión territorial, fecha de vigencia, CRS, licencia de uso/redistribución |
| Cobertura | los 15 distritos sin huecos no documentados ni solapes no justificados |

## Qué no sustituye al vector

- WMS `Limite Distritos` (`7eb13092-bf0e-493b-aae6-03c43eedda2c`): imagen / GetFeatureInfo puntual.
- Fixture `data/fixtures/demo_districts.geojson`: 15 rectángulos sintéticos de UI.
- Candidatos de terceros (ciudatoslab 20 distritos; hogaria ODbL): no autorizados como oficiales.

## Texto sugerido (para el equipo)

> Solicitamos acceso autorizado al vector oficial de los 15 distritos municipales
> de Cochabamba (GeoJSON o GeoPackage, EPSG:4326), con identificadores, nombres,
> versión territorial, fecha de vigencia y condiciones de uso/redistribución para
> el proyecto Cocha Digital Twin AI (estadísticas zonales y visualización). El WMS
> publicado no basta para ingesta PostGIS. Confirmamos que no redistribuiremos el
> archivo fuera del alcance autorizado.

## Candidato de terceros (solo inventario)

Se extrajo un GeoJSON con **15** features para municipio INE `030101`
(Cochabamba Cercado) desde hogaria (upstream ciudatoslab):

`data/raw/gamc/districts/candidates/cochabamba_15_candidate_unverified.geojson`

**No sustituye al vector GAMC.** No importarlo con
`--i-confirm-authorized-gamc-vector`. Sirve para comparar cuando llegue el
oficial y para documentar que existen geometrías de terceros con conteo 1–15.

## Estado (14/11/2026)

| Ítem | Estado |
| --- | --- |
| Vector GAMC | **Sí** — WMS GetMap KMZ `limite_distritos`, kmscore=100 |
| Archivo local | `data/raw/gamc/districts/limite_distritos_gamc.geojson` (fuera de Git) |
| PostGIS | 15 distritos `boundary_version=gamc-official-20261114`; ST_IsValid; sin solapes > 1 m² |
| IDs | D1–D15 con comunas (Tunari, Molle, Alejo Calatayud, etc.) |
| Contrato API `/v1/territories` | Sigue `unavailable` hasta que Andrés lo exponga |
| Candidato terceros | No importado como oficial |

Reproducción:

```powershell
python scripts/download_gamc_districts_kml.py
python scripts/kml_districts_to_geojson.py
python scripts/validate_district_vector.py data/raw/gamc/districts/limite_distritos_gamc.geojson --boundary-version gamc-official-20261114 --source-url "https://serviciosgamc.cochabamba.bo/api/gs/wms"
python scripts/import_official_districts.py data/raw/gamc/districts/limite_distritos_gamc.geojson --boundary-version gamc-official-20261114 --source-url "https://serviciosgamc.cochabamba.bo/api/gs/wms" --i-confirm-authorized-gamc-vector
```
