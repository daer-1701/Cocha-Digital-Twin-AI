# Punto 1 · Análisis local para la presentación

## Alcance fijo

Pregunta: ¿cómo varían la temperatura superficial y la vegetación de la ventana
piloto en adquisiciones de julio de 2014–2025?

La zona es `[-66.18, -17.41, -66.14, -17.37]` en WGS84. No representa los
15 distritos ni el municipio. Solo Landsat 8 Collection 2 Level-2 L2SP;
LST en °C y NDVI adimensional. Una adquisición por año, no una media anual.
El análisis es exploratorio: no prueba causalidad ni una tendencia climática regional.

## Adquisición acotada y calidad

Se consulta julio de cada uno de los doce años. Se rechaza una búsqueda
truncada. Los candidatos se ordenan por nubosidad global y luego ID; se leen
como máximo tres recortes por año y se detiene al alcanzar 95% de cobertura
válida local. En otro caso se conserva el candidato con mayor cobertura local.
La elección no depende de la temperatura, NDVI ni significancia obtenidos.
Se conserva la auditoría de candidatos, STAC y hashes de los archivos.

Se reutiliza la máscara del piloto: QA_PIXEL bits 0–5, QA_RADSAT=0,
reflectancias escaladas y válidas, temperatura no nula, denominador NDVI válido.
No se añade ajuste por aerosoles ni umbral ST_QA. Esto limita las conclusiones.
La descarga lee ventanas COG de cinco bandas; no colecciones completas.

Para analizar se exige al menos 80% de cobertura válida en cada escena y 80%
de soporte común. Si no se cumple, el comando falla sin publicar inferencia.
No se sustituyen años ausentes por ceros. Todas las fechas se alinean a la
cuadrícula de la primera escena con vecino más cercano; solo se usan centros
de píxel dentro de la ventana y válidos para ambas variables en todos los años.
Esta alineación no añade resolución física. La inferencia usa doce medias
temporales, nunca miles de píxeles como observaciones independientes.

## Estadística y límites

- Ajuste OLS frente al año calendario, pendiente por año.
- Incertidumbre: mayor error estándar entre OLS convencional y Newey–West
  con pesos Bartlett y retardos 1 y 2; corrección de muestra n/(n−2).
- Intervalos marginales de 95% y prueba bilateral con aproximación t(n−2).
  Es una sensibilidad conservadora entre esos ajustes, no una garantía de
  cobertura exacta en doce años ni una corrección de todos los sesgos.
- Se informa correlación residual de retardo 1 y rango de pendientes al
  excluir un año, sin eliminar observaciones por su resultado.
- Familia de dos contrastes (LST, NDVI), ajuste Holm y umbral 0,05.
  Los intervalos no son simultáneos; la decisión usa el valor p ajustado.
- Un resultado sin significancia no demuestra ausencia de cambio.

Julio reduce diferencias estacionales, pero las fechas de paso y la meteorología
no son idénticas. La selección de días despejados, emisividad y recuperación
satelital siguen limitando la interpretación. No hay calibración con estaciones.

## Ejecutar y repetir

```powershell
uv sync --frozen --group science
uv run --group science python scripts/analyze_pilot_trends.py
uv run --offline --group science python scripts/analyze_pilot_trends.py --offline
```

La segunda ejecución verifica hashes y usa solo archivos locales. El comando
no modifica endpoints, contratos, base de datos ni el snapshot activo.

Artefactos en `data/processed/pilot-trends/` (ignorados por Git):

- `manifest.json`: IDs, selección, archivos, hashes, código y lockfile.
- `analysis.json`: serie sobre soporte común, pruebas, intervalos y límites.
- `series.csv`: valores, fechas exactas y cobertura de cada escena.
- `trends.png`: figura estática para presentación.
- `explorer.json`: snapshot ampliado compatible con el contrato existente.

Las medias del snapshot son por escena. Las de `series.csv` y las pruebas
usan soporte común; no deben confundirse. La publicación en la interfaz
se resuelve en el punto 2 después de verificar los resultados.

## Referencias primarias

- [USGS: producto, escalas y limitaciones LST](https://www.usgs.gov/landsat-missions/landsat-collection-2-surface-temperature)
- [USGS: bandas QA](https://www.usgs.gov/landsat-missions/landsat-collection-2-quality-assessment-bands)
- [SciPy: regresión y prueba de pendiente](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.linregress.html)
- [Referencia HAC/Newey–West](https://www.statsmodels.org/stable/generated/statsmodels.stats.sandwich_covariance.cov_hac.html)

## Resultado ejecutado · 15/11/2026

Se procesaron las doce adquisiciones 2014–2025. Cobertura común: 99,5273%
de los centros de píxel de la ventana de referencia. Ninguna escena seleccionada
quedó por debajo de 80%; 2024 tuvo 99,8% y las restantes 100% en sus recortes.
En 2014 y 2017 se usó un candidato alternativo con mejor cobertura local.

- LST: pendiente +0,08125 °C/año; IC95% [−0,24843; +0,41093];
  p ajustado Holm 0,59496. Sin significancia al 5%.
- NDVI: pendiente +0,00099184/año; IC95% [−0,00053877; +0,00252246];
  p ajustado Holm 0,35874. Sin significancia al 5%.
- La pendiente LST al quitar un año varía entre −0,04393 y +0,17201 °C/año:
  su dirección tampoco es estable a esa sensibilidad.

Frase para presentar: «Analizamos doce adquisiciones de julio de la misma
ventana urbana entre 2014 y 2025. Hay variación entre fechas, pero este análisis
exploratorio no detecta una tendencia lineal estadísticamente significativa
en temperatura superficial ni vegetación. Esto no demuestra ausencia de cambio».

Validación ejecutada: reproducción offline idéntica de series, cobertura y
resultados; hashes de todos los insumos seleccionados verificados; recálculo
de escala térmica y NDVI de un píxel real y prueba de exclusión al activar el
flag de nube sobre esa entrada. La activación del flag es una perturbación de
prueba, no una medición adicional. Figura revisada visualmente.

`uv run --group science pytest -q`: 102 aprobadas, 13 omitidas de integración
con base de datos; una advertencia de deprecación del cliente de pruebas.
Ruff y formato aprobados. No se ejecutaron migraciones ni se escribió en DB.
Las APIs y el snapshot activo original permanecen sin cambios en este punto.

## Punto 2 · Integración web local

Preparar los archivos web después de ejecutar o reproducir el análisis:

```powershell
node scripts/prepare-pilot-web.mjs
```

El empaquetador coteja CSV, análisis, escenas y hash del manifiesto antes de
copiar cinco artefactos a `apps/web/public/pilot-analysis/`, fuera de Git.
La web verifica los hashes del paquete al leerlo. Si falta, conserva el flujo
original de API; si está corrupto, falla explícitamente. No se mezclan fixtures
sintéticas con el paquete real en el explorador o sus exportaciones.

- `/`: doce adquisiciones del paquete local; mapa y tabla con medias por escena.
- `/analisis`: pendientes, intervalos, p ajustado, figura y doce medias sobre
  soporte común; CSV/JSON descargables y enlaces STAC por adquisición.
- `/informes`: exporta las mismas escenas del explorador con sus filtros;
  enlaza al análisis para descargar las medias sobre soporte común.

No se cambian APIs FastAPI, contratos ni datos persistidos. El snapshot original
de `data/processed/explorer.json` sigue con tres fechas para los consumidores
externos de la API; la web identifica la entrega ampliada como paquete local.
Para otro equipo o una reconstrucción de contenedores, preparar el paquete
antes de compilar la web; el Dockerfile existente copia la carpeta `public`.

Verificación del punto 2: lint, typecheck y build aprobados sin advertencias de
compilación. En Chrome se comprobaron las doce fechas, la navegación y la página
de análisis. Se cotejaron las 24 medias renderizadas con `analysis.json`, los
resultados JSON descargables con el archivo original, las doce escenas exportadas
con el snapshot y la exportación filtrada de una escena. La API FastAPI conserva
sus tres escenas originales. No se ejecutó una auditoría móvil ni la suite E2E
completa como parte de este punto.
