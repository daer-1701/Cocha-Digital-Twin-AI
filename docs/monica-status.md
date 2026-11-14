# MÓNICA — confirmado y pendiente

Revisión de código: 14 de noviembre de 2026. No se inventan coordenadas ni huso.

## Confirmado

- Archivos: `red_monica.kanata (1).csv` y `red_monica.semapa (1).csv`, columnas
  `estacion`, `pm10`, `fecha_medicion`.
- Variable: PM10. No es temperatura del aire y no calibra LST.
- Identidad, desde el informe de Contaminación Atmosférica Gestión 2021:
  `kanata` es Parque Kanata (Av. 6 de Agosto y Av. del Cabildo) y `semapa` es
  SEMAPA (Av. Circunvalación y Atahuallpa).
- Unidad declarada en la importación: `ug/m3`, tomada de ese informe
  ([PDF](http://snia.mmaya.gob.bo/web/modulos/PNGCA/publicaciones/items/14042022-030417-130459_209/14042022-030417-130459_209.pdf)),
  no del encabezado del CSV.
- El importador guarda `unit_declared`, deja `analysis_enabled=false` y copia
  `metadata_pending`. No escribe latitud, longitud ni zona horaria.

## Pendiente

- Zona horaria de `fecha_medicion`. Los timestamps no traen offset; no se
  etiquetan como UTC ni como America/La_Paz.
- Coordenadas y elevación. El texto de avenidas no se convierte a lat/lon.
- Tratamiento de ceros y negativos, códigos de instrumento y licencia de
  redistribución.

Mientras eso siga abierto, los agregados físicos permanecen apagados.
