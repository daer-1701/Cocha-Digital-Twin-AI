# MVP Landsat: alcance y reproducción

## Qué hace

Un recorrido real: STAC → ventanas COG → QA y escalas → indicadores → snapshot
validado → API → dashboard. La ventana EPSG:4326 es
`[-66.18, -17.41, -66.14, -17.37]`, elegida para un piloto urbano pequeño.
No es el límite de Cochabamba ni representa ninguno de sus 15 distritos.

La consulta selecciona de hasta 30 resultados de julio por año una escena L2SP
Landsat 8/9 con menor nubosidad global declarada. Empates por ID. No pagina ni
asegura la menor nubosidad local. El parámetro `--years` permite hasta cinco
años entre 2014 y 2025; por defecto 2022, 2023 y 2024. Falla si un año no tiene
escena compatible; no publica un snapshot parcialmente completado.

## Método

- Bandas red, nir08, lwir11, QA_PIXEL y QA_RADSAT.
- Excluir QA_PIXEL bits 0–5 y QA_RADSAT distinto de cero; excluir DN cero.
- Reflectancia = DN × 0.0000275 − 0.2; excluir reflectancias fuera de [0,1].
- NDVI = (NIR − rojo)/(NIR + rojo), después de aplicar escala y offset.
- LST °C = DN × 0.00341802 + 149 − 273.15.
- Máscara válida compartida entre ambos indicadores, denominador > 1e-8.
- Medias sobre píxeles válidos de igual área en la cuadrícula UTM de cada escena.
- Mapa de medias por bloques de 12×12 píxeles (~360 m), sin interpolación.
  Las celdas se visualizan mediante sus envolventes geográficas; no son polígonos distritales.
- Los bordes de la ventana se ajustan a la cuadrícula de cada adquisición,
  con pequeñas diferencias de soporte espacial entre fechas.

El mapa usa escala fija 0–50 °C y −1–1 NDVI; valores térmicos fuera del rango
visual toman el color extremo. No son intervalos de incertidumbre ni límites físicos.
Las celdas solo requieren al menos un píxel válido; revisar cobertura global
antes de interpretar un mapa con nubes. Próxima mejora: cobertura por celda.

No hay ajuste por aerosol, umbral de incertidumbre ST_QA, corrección por cercanía
a nubes ni validación con estaciones. Los huecos de emisividad y el sesgo de
selección de días despejados limitan las inferencias. No se calculan p-values,
intervalos, predicciones ni tendencias climáticas a partir de tres fechas.

## Artefactos y reproducción

`data/raw/landsat-pilot/<scene-id>/`: STAC sin URLs firmadas y recortes GeoTIFF.
La ingesta reutiliza recortes existentes, valida su cuadrícula y registra SHA-256.
No almacena tokens SAS. Los recortes originales no se sobrescriben; no cambiar
el área de estudio en código y reutilizar esa misma caché.

`data/processed/landsat-manifest.json`: consulta, años, mes, IDs, URLs públicas,
hashes y commit base. El commit puede tener cambios locales: para reproducción
exacta conservar también el código utilizado y `uv.lock` con esos cambios.

`data/processed/explorer.json`: contrato de evidencia completo y metadatos de
método. Escritura final mediante reemplazo atómico; snapshot anterior permanece
si la adquisición falla. La API devuelve `empty` al no existir y 503 si no valida.

Por diseño estos datos no se suben a Git. Ejecutar el comando del README después
de clonar. Reintentos HTTP acotados para 429 y fallos transitorios; no se hacen
llamadas de pago. Errores raster remotos pueden requerir reejecutar el lote.

## Límites operativos

Esta persistencia es un snapshot de lectura para una sola área. No hay ingesta
desde la web, consultas distritales ni catálogo de artefactos en DB todavía.
PostGIS sigue disponible para el futuro catálogo territorial; no hay cambio de
esquema en esta etapa. El mapa base usa OpenStreetMap y requiere Internet;
indicadores y tabla siguen procediendo del snapshot local.

## Fuentes primarias

- [Escalas USGS](https://www.usgs.gov/faqs/how-do-i-use-a-scale-factor-landsat-level-2-science-products)
- [QA USGS](https://www.usgs.gov/landsat-missions/landsat-collection-2-quality-assessment-bands)
- [LST y limitaciones USGS](https://www.usgs.gov/landsat-missions/landsat-collection-2-surface-temperature)
- [Catálogo STAC](https://planetarycomputer.microsoft.com/api/stac/v1/collections/landsat-c2-l2)
