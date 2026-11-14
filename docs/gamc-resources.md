# GAMC: recursos verificados y entrega para integración

Verificación: **14 de noviembre de 2026**. Fuente:
[documentación GAMC](https://recursosgamc.cochabamba.bo/api-doc).

## Estado real

- Se descargó y verificó el ZIP MÓNICA y se extrajeron sus dos CSV.
- Se registraron SHA-256 del ZIP y CSV, metadatos HTTP y procedencia.
- Se verificó que una segunda ejecución reutiliza archivos sin sobrescribirlos.
- Se inspeccionó el catálogo publicado de capas; no se probaron solicitudes WMS
  autenticadas ni se descargaron polígonos completos de distritos.
- No se importaron observaciones a PostGIS ni se activaron en el dashboard.
- Acceso público al archivo no confirma licencia de redistribución. Mantener
  datos crudos fuera de Git y verificar condiciones antes de redistribuirlos.

## Descarga local reproducible

No requiere Docker ni bibliotecas externas; Python estándar es suficiente:

```powershell
python scripts/download_gamc.py
```

Archivo fuente: [red_monica.zip](https://recursosgamc.cochabamba.bo/assets/geo/red_monica.zip).
Ruta local: `data/raw/gamc/monica/`.

| Archivo | Estado |
| --- | --- |
| `red_monica.zip` | Original conservado, CRC verificado |
| `red_monica.kanata (1).csv` | Extraído sin transformar |
| `red_monica.semapa (1).csv` | Extraído sin transformar |
| `manifest-<hash>.json` | URL, fecha, metadatos HTTP y hashes locales |

El script solo descarga si falta el ZIP y rechaza miembros inesperados,
archivos grandes o discrepancias con archivos existentes. No actualiza una
versión existente automáticamente: para incorporar una publicación nueva,
revisar cambios y conservar la anterior con otra versión. Si ya existía un ZIP
sin manifiesto, registra que fue reutilizado; no afirma una descarga nueva.

## Inspección inicial de MÓNICA

Las columnas de ambos CSV son `estacion`, `pm10`, `fecha_medicion`.

| Estación en CSV | Registros | Primera fecha escrita | Última fecha escrita | Ceros | Negativos |
| --- | --- | --- | --- | --- | --- |
| kanata | 54.711 | 2022-07-06 17:30 | 2026-10-23 10:30 | 2.697 | 721 |
| semapa | 71.154 | 2022-08-24 03:30 | 2026-10-23 10:00 | 3.384 | 1.499 |

Se calcularon mínimo/máximo temporal textual con el formato homogéneo del CSV;
no implican continuidad entre esas fechas. No se encontraron duplicados de
`estacion + fecha_medicion` ni valores PM10 que no se pudieran convertir a
número en esta revisión inicial. Esto no equivale a validación de calidad.
Detalle legible por código en `data/catalog/gamc.json`.

Pendientes obligatorios para A08:

- Unidad PM10: no está declarada en el encabezado. No asignar µg/m³ sin fuente.
- Zona horaria: timestamps sin offset. No etiquetar UTC por defecto.
- Coordenadas/elevación: no están en estos CSV; no geocodificar por nombre
  y presentar el resultado como ubicación oficial.
- La descripción del portal menciona Av. 6 de Agosto y Av. Circunvalación;
  los nombres internos son Kanata/Semapa. Reconciliar identidad y ubicación.
- Interpretación de ceros y negativos, códigos de calibración, instrumentos,
  frecuencia esperada, discontinuidades y permisos de uso.

Conservar todos los originales. Los negativos requieren bandera de calidad y
exclusión de análisis físico hasta justificar su tratamiento; no truncarlos a
cero. Los ceros no se eliminan automáticamente ni se convierten en faltantes
sin documentación. No calcular índices sanitarios sin unidades y reglas verificadas.

**Estos datos son PM10: no son temperatura del aire ni una referencia térmica
para calibrar LST.** Dos estaciones tampoco garantizan capacidad de interpolación
validada para los 15 distritos. A09 debe reevaluar el objetivo y suficiencia.

## Límites y capas WMS

Endpoint documentado: `https://serviciosgamc.cochabamba.bo/api/gs/wms`.
Operaciones anunciadas: `GetMap`, `GetLegendGraphic`, `GetFeatureInfo`.
La documentación utiliza WMS 1.1.1 y GetLegendGraphic 1.0.0; confirmar cada
operación al implementar. Requiere clave de proyecto y `service_id`.

| Capa | service_id | Aplicación |
| --- | --- | --- |
| Limite Distritos | `7eb13092-bf0e-493b-aae6-03c43eedda2c` | Visualización oficial y referencia para A03 |
| Limite Urbano | `fd77d463-9729-4c66-b686-23dccbb4ab8f` | Contexto territorial |
| Áreas Verdes | `47360ddc-e35f-4ece-a995-59e90eb79cc6` | Contexto de cobertura vegetal |
| Población por Manzanas | `194a02a0-a73a-48c1-a260-82847c5c905d` | Contexto poblacional, fecha y unidades por verificar |
| Cota 2750 | `297cefa4-0832-42bb-a98e-2cbea989fd9d` | Contexto territorial; no sustituye un DEM |

El catálogo sanitizado guarda los BBOX anunciados; son extensiones de capas,
**no coordenadas de sus polígonos**. La documentación presenta una diferencia
entre el contador anunciado y las cinco capas listadas en el primer proyecto;
usar los servicios realmente verificados, sin asumir que todos estén autorizados.

### Dos entregas distintas de A03

1. **WMS de lectura:** obtener mapa, leyenda y atributos mediante un adaptador
   backend con clave de entorno, allowlist de servicios, parámetros acotados,
   timeout, caché y logs sin secretos. Diego consume ese adaptador sin Docker
   ni claves en su navegador. Es un avance visual, no una ingesta vectorial.
2. **Vector completo:** verificar acceso autorizado a GeoJSON/GeoPackage/Shapefile
   o a un servicio de features documentado, con todas las geometrías distritales
   y sus identificadores. Validar completitud, CRS, versión y licencia antes de
   importar a PostGIS y ejecutar estadísticas zonales.

GetMap devuelve una imagen y GetFeatureInfo es una consulta puntual; no asumir
que permite descargar todas las geometrías. No reconstruir distritos desde
PNG, BBOX, digitalización manual o consultas de muestreo. No asumir WFS por
existir WMS; verificar soporte y autorización en documentación.

No se encontró enlace de vector distrital completo entre las descargas
publicadas para Microclimas. El archivo RAR de líneas de transporte anunciado
allí no es un sustituto de límites y no se descargó por ser ajeno a esta ingesta.
Si falta acceso vectorial, A03 deja constancia del bloqueo y de la fuente que
debe obtener el equipo por un canal autorizado; no envía solicitudes a terceros
automáticamente. El pipeline piloto conserva su área explícita mientras tanto.

## Reparto actualizado

- **Andrés:** A03 (WMS + vector por separado), A04 (persistencia), A08 (QA e
  ingesta PM10) y A09 (viabilidad del modelo). Descarga completada no equivale
  a datos limpios o integrados.
- **Diego, sin Docker:** D01 actualiza metadatos; D04/D05 consumen límites
  vectoriales o WMS distinguiendo su capacidad; D09 muestra series y fichas
  MÓNICA sin ubicar estaciones en el mapa hasta tener coordenadas oficiales.
- Los prompts correspondientes están actualizados en `docs/team-plan.md`.

El catálogo versionado no contiene claves. La ingesta no modifica el frontend,
los modelos, la base de datos ni los contratos API en esta tarea.
