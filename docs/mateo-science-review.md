# Revisión del piloto y protocolo científico

## MF02 · Revisión del piloto Landsat

Estado en revisión sobre `9bbbe8f`. La revisión cubre el código, el método
documentado y las fuentes USGS. En esta copia faltan los GeoTIFF de entrada,
el manifiesto y el snapshot. La comprobación sobre datos reales y la ejecución
de las pruebas quedan pendientes.

| Control | Resultado de la revisión |
| --- | --- |
| Decodificación | El código aplica escala y offset a rojo y NIR antes del NDVI. La banda térmica se decodifica en kelvin y se convierte a °C. |
| QA y faltantes | Excluye los bits 0–5 de QA_PIXEL, cualquier QA_RADSAT distinto de cero y DN cero. Aplica una máscara conjunta, por lo que un faltante de un indicador reduce la cobertura de ambos. Una celda sin píxeles válidos devuelve `null`. |
| Soporte espacial | Compara CRS y transformaciones entre bandas y verifica dimensiones al calcular los indicadores. Los bordes del recorte dependen de la cuadrícula de cada escena. El píxel entregado es de 30 m, el soporte térmico nativo es de 100 m y el mapa agrupa bloques de hasta 12 × 12 píxeles. |
| Procedencia | El CLI conserva metadatos STAC y genera hashes de los recortes. La ingesta por años consulta nuevamente el catálogo. El modo por manifiesto añadido en MF03 permite repetir los IDs a partir de los archivos locales. |

Para cerrar MF02, ejecutar las pruebas existentes cuando se retome la
validación y contrastar al menos un recorte real con su manifiesto:

1. Confirmar colección, escena, fecha, bandas y SHA-256. Comparar CRS,
   transformación y dimensiones de las cinco bandas.
2. Seleccionar un píxel válido y un píxel excluido por QA o NoData. Recalcular
   manualmente LST y NDVI del primero y verificar que el segundo quede fuera
   de ambos cálculos.
3. Reconciliar píxeles válidos y totales, fracción válida y medias de la escena
   con el snapshot. Registrar el commit, los IDs de escena y los resultados.

```powershell
uv run --group science pytest -q tests/unit/test_landsat.py tests/unit/test_landsat_multitemporal.py
```

Fuentes y detalles del método en [MVP Landsat](mvp.md), [QA USGS](https://www.usgs.gov/landsat-missions/landsat-collection-2-quality-assessment-bands)
y [temperatura superficial USGS](https://www.usgs.gov/landsat-missions/landsat-collection-2-surface-temperature).

## MF01 · Protocolo propuesto

Pendiente de acordar alcance con el equipo (AF01) y contrastar disponibilidad
y permisos con el inventario de Eduardo (EF01).

- **Objetivo inicial.** Describir LST en °C y NDVI adimensional de Landsat
  8/9 Collection 2 Level-2 para adquisiciones de julio. Cada escena refleja
  su fecha y hora de paso. La unidad del piloto es la ventana urbana recortada.
  Para resultados distritales, usar distrito oficial versionado por adquisición.
- **Soporte comparable.** Documentar cuadrícula, área de intersección, área
  válida y versión territorial. Para comparaciones, evaluar la sensibilidad
  a los cambios de cobertura usando el soporte común entre fechas.
- **Datos mínimos.** Exigir bandas e identificación completas, máscara QA,
  cobertura válida registrada y trazabilidad al manifiesto. Fijar umbrales de
  cobertura y tamaño muestral con el inventario y la validación antes de
  publicar inferencias. Las tres adquisiciones del piloto admiten una
  comparación descriptiva acotada a esas fechas.
- **Tendencias y asociación.** Comparar ventanas estacionales equivalentes.
  Evaluar autocorrelación, dependencia espacial y estabilidad frente a cobertura
  y selección de escenas. Reportar intervalos y ajuste por comparaciones
  múltiples cuando el diseño lo requiera. Interpretar LST–NDVI como asociación.
- **MÓNICA y modelos.** Mantener PM10 como serie propia, con huso, coordenadas,
  unidades, cobertura y QA verificados antes de agregar. Requerir una referencia
  compatible y evaluación espacial y temporal fuera de muestra para publicar
  estimaciones. Los escenarios requieren además un modelo apto para intervención.

## Siguiente etapa

Para MF03, el [modo de reproducción local](mvp.md#artefactos-y-reproducción)
ya verifica los insumos contra el manifiesto. Queda acordar con Eduardo el
lote acotado (EF07) y repetirlo con recortes reales. MF04 requiere el vector
oficial importado (EF03). Los bloqueos de
referencia para MF08 están en [Viabilidad de ML](ml-viability.md).

## MF04–MF11 · Criterios de aceptación pendientes

| Tarea | Evidencia que falta y criterio para avanzar |
| --- | --- |
| MF04 · Series distritales | El [lote por manifiesto](mvp.md#persistencia-distrital) calcula las intersecciones y persiste medias y cobertura por adquisición con procedencia. Queda ejecutar el lote con los recortes reales de MF03 y la versión oficial de EF03, y validar sus resultados. |
| MF05 · Tendencias | Disponible una pendiente descriptiva por año transcurrido, con filtro de cobertura, un mes fijo y una observación por año. Falta validar con series de MF04. Definir la referencia estacional para anomalías y verificar sensibilidad al soporte común y a la autocorrelación antes de estimar intervalos y comparar distritos. |
| MF06 · MÓNICA | Disponible la [auditoría local de filas](monica-status.md#auditoría-local-previa-a-la-conciliación-mf06). Falta conciliar contra EF05 y validar periodicidad, huso, cobertura y reglas de QA con los CSV reales. |
| MF07 · LST–NDVI | Disponible el cálculo de ambas medias sobre el mismo soporte válido para una adquisición. La estimación de asociación e incertidumbre requiere MF04 y MF05. Revisar elevación, impermeabilización y selección de escenas, y definir bloques espaciales y temporales acordes a los datos. |
| MF08 · ML | La fusión LST–PM10 es inviable con los insumos conocidos. Para reconsiderar, EF08 debe aportar referencia de la variable objetivo con soporte compatible. Comparar baseline y candidato en las mismas particiones retenidas, con MAE/RMSE, cobertura de intervalos y límites de extrapolación. |
| MF09 · Escenarios | Requiere un modelo evaluado para la intervención concreta. Documentar intervención, supuestos, dominio, sensibilidad e incertidumbre antes de presentar un resultado hipotético. |
| MF10 · Índice y zonas críticas | Requiere alcance AF01, capas EF06 y series MF04/MF05. Fijar dirección de indicadores, normalización, pesos y cobertura mínima. Revisar estabilidad de la clasificación frente a pesos y faltantes, y dependencia espacial antes de publicar zonas críticas. |
| MF11 · Informe | Este documento registra el método y los bloqueos. El informe final requiere artefactos aplicables de MF05–MF10 con commit, procedencia, cobertura, figuras e incertidumbre. Contrastar fechas, unidades y cifras con API y revisar las interpretaciones del frontend y del asistente. |

Para MF04, `summarize_raster_intersections` recibe áreas de píxeles
no solapados, ya recortadas al distrito y expresadas en m² en el mismo CRS.
La media divide la suma ponderada entre el área válida. La cobertura divide
el área válida entre el área distrital completa, incluyendo en el denominador
la superficie fuera del ráster. El área intersectada incluye píxeles NoData.
Sin área válida, la media devuelve `None` y la cobertura es cero.
El punto de entrada `district_raster_means` en `science/zonal.py` acepta
un polígono o multipolígono WKT y dos matrices alineadas con norte arriba.
Preparar la geometría y la cuadrícula en el mismo CRS proyectado en metros
y aplicar la máscara QA antes de llamar al cálculo.

La [ficha de viabilidad](ml-viability.md) registra la decisión actual para
MF08, la evidencia que debe aportar EF08 y el criterio adicional para MF09.
El índice de MF10 sigue condicionado al alcance AF01 y al inventario de capas
EF06. En MF11, registrar esos resultados como pendientes hasta disponer de
artefactos y validaciones que permitan revisar sus cifras.

## Entrega local y orden de reanudación

### Demostración sintética MF05–MF07

Desde la raíz, con las dependencias del proyecto instaladas:

```powershell
uv run --offline python scripts/demo_mateo_science.py
```

El JSON identifica la ejecución como `synthetic_demo`. MF05 calcula la
pendiente descriptiva y las anomalías de julio respecto a 2021–2022. MF06
compara SHA-256, conteos QA y balance de filas de un CSV sintético con un
reporte de importación de ejemplo. MF07 calcula Pearson sobre tres pares
LST–NDVI con superficie válida común. La demo trabaja con una carpeta
temporal y no accede a la red ni a PostGIS.

Para MF11, sustituir este ejemplo por un reporte que identifique la versión
territorial, las adquisiciones, la referencia de anomalías, los umbrales,
la cobertura, las exclusiones y la incertidumbre. Adjuntar las tablas
validadas y contrastar las cifras con las vistas de la aplicación.

Las comprobaciones puntuales con datos sintéticos cubrieron la auditoría
MÓNICA, la ponderación por área, la pendiente descriptiva y el emparejamiento
LST–NDVI. En Python 3.13, Ruff y su control de formato pasaron. La suite con
PostGIS 17 aislado dio 90 pruebas aprobadas y una omitida, incluidas las
comprobaciones de reproducción del manifiesto, intersecciones y reintento
de la persistencia sin duplicar indicadores.
`alembic upgrade head` y `alembic check` pasaron en esa base de pruebas.
Queda validar con las fuentes reales.

1. Con Andrés y Eduardo, confirmar AF01 y EF01 para cerrar el protocolo MF01.
2. Obtener los recortes y el manifiesto del piloto. Completar MF02 y repetir
   el lote de MF03. Comparar escenas, cobertura y medias con el snapshot original.
3. Con EF03, producir las intersecciones y las series de MF04. Usar esas
   series para decidir qué análisis de MF05 y MF07 admite la muestra.
4. Con los CSV y la importación aislada de EF05, conciliar MF06 y decidir
   si hay evidencia para habilitar agregados.
5. Registrar las decisiones sobre MF08–MF10 con el equipo y completar MF11
   con los resultados aplicables y su evidencia de validación.
