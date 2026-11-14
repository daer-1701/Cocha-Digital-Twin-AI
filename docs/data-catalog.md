# Catálogo de fuentes de datos

Revisión: **14 de noviembre de 2026** (D01). Complementa
[recursos GAMC](gamc-resources.md) y `data/catalog/gamc.json`, que siguen siendo
la referencia técnica de capas e inspección de CSV. Requisitos asociados:
[matriz de requisitos](requirements.md).

Niveles de acceso, de menor a mayor evidencia:

- **Catalogado:** la fuente anuncia el recurso; no se probó.
- **Descarga probada:** se obtuvieron archivos y checksums.
- **Integrado:** procesado con QA y servido por la API.

Descargar un archivo no equivale a validarlo ni a integrarlo.

## Resumen

| Fuente | Variable | Formato | Acceso | Licencia o permiso | Uso en el proyecto |
| --- | --- | --- | --- | --- | --- |
| Landsat 8/9 C2 L2 (USGS/NASA) vía Planetary Computer | LST, reflectancia → NDVI | COG + STAC | Integrado en piloto | Datos Landsat abiertos; atribución USGS/NASA | Explorador piloto |
| GAMC Red MÓNICA (ZIP con 2 CSV) | PM10 | CSV en ZIP | Descarga probada | **No confirmada** | Pendiente A08 |
| GAMC WMS «Limite Distritos» | Límites distritales (imagen) | WMS 1.1.1 | Catalogado; requiere clave | No confirmada | Visualización A03 |
| GAMC WMS «Limite Urbano», «Áreas Verdes», «Población por Manzanas», «Cota 2750» | Contexto territorial | WMS 1.1.1 | Catalogado; requiere clave | No confirmada | Capas D05 |
| GAMC «lineas_de_transporte.rar» | Rutas de transporte | RAR | Catalogado, no descargado | No confirmada | Candidato para L2 |
| Vector de los 15 distritos | Polígonos oficiales | — | **No identificado** | — | Bloquea A03/A06 |
| Equipamientos de salud y colegios GAMC | Puntos o polígonos | — | **No identificado** | — | Requerido por L2 |
| Fuentes NASA adicionales (MODIS, AIRS, MERRA-2, GLDAS, AOD) | Ver detalle | Varios | Candidatas, sin probar | Earthdata Login en varios casos | A05, A09 |
| OpenStreetMap | Mapa base | Teselas raster | En uso | ODbL; política de uso de teselas | Fondo del mapa |

## Landsat Collection 2 Level-2

- **Acceso comprobado:** STAC de Planetary Computer, colección `landsat-c2-l2`,
  con firma SAS anónima y lectura por ventanas COG. Sin credenciales ni costo.
- **Implementación:** `scripts/ingest_landsat.py` y `services/api/src/cocha_api/science/landsat.py`.
  Método y límites en [MVP Landsat](mvp.md).
- **Variables:** `lwir11` (LST, °C tras escala USGS), `red` y `nir08` (NDVI),
  `qa_pixel` y `qa_radsat`.
- **Resolución:** píxel entregado de 30 m; térmica nativa de 100 m.
- **Período en el piloto:** una escena de julio de 2022, 2023 y 2024.
- **Pendientes:** ST_QA, aerosoles, cobertura por celda, serie multianual (A05).
- **Estado en este clon:** sin snapshot; ejecutar la ingesta del README.

## Red MÓNICA (GAMC)

### Acceso y archivos

- Archivo: [red_monica.zip](https://recursosgamc.cochabamba.bo/assets/geo/red_monica.zip),
  enlazado desde la [documentación GAMC](https://recursosgamc.cochabamba.bo/api-doc).
- Descarga reproducible: `python scripts/download_gamc.py` → `data/raw/gamc/monica/`
  (fuera de Git). En este clon todavía no se ejecutó.
- Columnas: `estacion`, `pm10`, `fecha_medicion`. Perfil inicial (registros,
  ceros, negativos, fechas) en `data/catalog/gamc.json`.

### Metadatos investigados

| Metadato | Estado | Evidencia |
| --- | --- | --- |
| Variable | **PM10 únicamente** en los CSV | Encabezados de los CSV |
| Unidad | No declarada en los CSV. Los informes municipales publican PM10 en µg/m³ | Informe 2021 [1]. Confirmar que el CSV usa la misma unidad antes de rotular |
| Método | Atenuación de rayos beta, analizadores certificados por USEPA | Informe 2021 [1], sección 3 |
| Frecuencia | Registradores programados «a partir de 15 minutos»; el ICA se publica cada 30 minutos. Las marcas del CSV terminan en :00 o :30 | Informe 2021 [1]; `gamc.json`. Confirmar intervalo y si son promedios |
| Zona horaria | **Desconocida.** Sin offset en los CSV ni declaración encontrada | No asignar UTC ni UTC−4 sin fuente |
| Identidad «kanata» | Estación Parque Kanata (PK), sector sur, alto tráfico vehicular | Informe 2021 [1] |
| Ubicación Kanata | Av. 6 de Agosto; el texto dice «y Av. del Cabildo» y la tabla «esq. Av. Ayacucho» | Informe 2021 [1]. Inconsistencia a resolver |
| Identidad «semapa» | Estación SEMAPA (SE), sector norte, tráfico mediano-alto | Informe 2021 [1] |
| Ubicación Semapa | Av. Circunvalación esq. Av. Atahuallpa | Informe 2021 [1] |
| Coordenadas y elevación | **No publicadas** en las fuentes revisadas | No geocodificar direcciones como ubicación oficial |
| Otras variables | Semapa mide temperatura, humedad, radiación, viento y precipitación; Kanata mide O₃ y NOx | Informe 2021 [1]. **No incluidas en la descarga GAMC** |
| Ceros y negativos | Sin documentación de códigos | Pendiente; ver `docs/gamc-resources.md` |
| Licencia | **No confirmada.** El portal GAMC no muestra condiciones en lo revisado | Los términos de AGETIC aplican a datos.gob.bo [2], no a este portal |

Las direcciones del enunciado local («Av. 6 de Agosto y Av. Circunvalación»)
coinciden con Kanata y Semapa respectivamente. La red tuvo además las estaciones
Coña Coña y Fuerza Aérea [1]; no aparecen en la descarga GAMC.

## Capas WMS del GAMC

Endpoint `https://serviciosgamc.cochabamba.bo/api/gs/wms`, WMS 1.1.1, con
`GetMap`, `GetLegendGraphic` y `GetFeatureInfo` anunciados. Requiere clave de
proyecto, que debe quedar solo en el servidor. IDs de servicio y BBOX en
`data/catalog/gamc.json`.

- Un BBOX es la extensión de la capa, no la geometría de sus polígonos.
- GetMap devuelve una imagen y GetFeatureInfo una consulta puntual: ninguno
  permite reconstruir el vector completo de distritos.
- Ninguna solicitud autenticada se probó todavía.
- No se encontró una capa de colegios ni de establecimientos de salud.

## Fuentes NASA candidatas

Mencionadas en el enunciado local (LST, NDVI, AOD, temperatura del aire) o en
resúmenes públicos del reto. **No probadas en este proyecto.** Verificar producto,
versión, resolución y cobertura sobre Cochabamba antes de adoptarlas.

| Variable | Candidatos | Observación |
| --- | --- | --- |
| LST / NDVI de mayor frecuencia | MODIS (p. ej. MOD11, MOD13) | Resolución de 250 m a 1 km: poco detalle intraurbano |
| AOD | MODIS MAIAC u otros productos de aerosoles | Relación con PM10 requiere validación local |
| Temperatura del aire | AIRS, MERRA-2 (reanálisis) | Resolución gruesa (≥ 0,5°): no distingue distritos |
| Humedad del suelo y balance | GLDAS | Contexto regional |

Varios productos de GES DISC requieren Earthdata Login gratuito; la cuenta y
sus credenciales deben gestionarse en el servidor, nunca en el frontend.

## Capas socioambientales (EF06)

| Capa | Estado | Notas |
| --- | --- | --- |
| Áreas Verdes (WMS) | Catalogada; requiere clave | Imagen, no vector descargado |
| Población por Manzanas (WMS) | Catalogada; requiere clave | Fecha y unidades por verificar |
| Limite Urbano (WMS) | Catalogada; requiere clave | Contexto |
| `lineas_de_transporte.rar` | Catalogada; **no descargada** | Ajena a la ingesta MÓNICA; licencia no confirmada |
| Equipamientos salud/colegios | **No identificados** | Reducir alcance si AF01 no los exige |

No se importan capas socioambientales a PostGIS hasta tener archivo autorizado,
fecha, unidades y licencia. Equivalencia temporal con Landsat/MÓNICA: pendiente.

## Pendientes y evidencia para Andrés

| Tarea | Bloqueo | Acción sugerida |
| --- | --- | --- |
| EF02 / A03 | No hay vector de 15 distritos en las descargas documentadas | Usar `docs/gamc-vector-request.md`; solicitar GeoJSON/GPKG con versión y licencia |
| EF06 / L2 | No se identificaron capas de colegios ni salud | Confirmar si GAMC las publica; si no, reducir alcance |
| EF04 / A08 | Unidad, intervalo y zona horaria no declarados en CSV | Informe 2021 [1] como evidencia de unidad; confirmar huso con GAMC |
| EF04 / A08 | Coordenadas oficiales ausentes; dirección de Kanata inconsistente | Pedir coordenadas oficiales; mantener estaciones fuera del mapa |
| EF04 / A08 | Licencia de redistribución no confirmada | No redistribuir CSV crudos; mantenerlos fuera de Git |
| EF08 / A09 | La descarga no contiene temperatura del aire | Ver `docs/ground-reference.md`; redefinir objetivo o solicitar Semapa meteo |
| — | Enunciado oficial NASA no verificado | Consultar spaceappschallenge.org cuando responda |

## Referencias

1. GAMC, Dirección de Medio Ambiente. *Contaminación Atmosférica Gestión 2021 — Red MoniCA*.
   Publicado en el repositorio SNIA del Ministerio de Medio Ambiente y Agua:
   <http://snia.mmaya.gob.bo/web/modulos/PNGCA/publicaciones/items/14042022-030417-130459_209/14042022-030417-130459_209.pdf>
2. AGETIC. *Términos y condiciones de uso de datos abiertos*:
   <https://agetic.gob.bo/sites/default/files/wwwageticgobbo/wp-content/uploads/2022/08/5.-Terminos-y-condiciones-de-uso-de-datos-abiertos.pdf>
3. NASA Space Apps Cochabamba, enfoques locales: <https://spaceappschallenge-cbba.com/#retos>
4. USGS, Landsat Collection 2 Surface Temperature:
   <https://www.usgs.gov/landsat-missions/landsat-collection-2-surface-temperature>
