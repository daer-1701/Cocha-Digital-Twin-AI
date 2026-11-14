# Etapas

## 0. Base técnica — implementada

- Monorepo, web inicial y API de salud/catálogo.
- PostGIS, migraciones, Docker y contratos generados.
- Pruebas iniciales y CI definida para GitHub Actions.

La CI debe ejecutarse en GitHub; su existencia no implica una ejecución exitosa.

## 1. Primera evidencia real

Verificar límites, elegir producto y período, descargar una muestra y construir
un pipeline reproducible. Criterio de salida: un indicador distrital recalculable
con fuente, unidad, QA y cobertura, sin intervención manual en notebooks.

## 2. Dashboard científico

Añadir MapLibre, selección distrital, series y comparación temporal. Mostrar
datos ausentes e incertidumbre. Criterio: recorrer fuente → indicador → mapa
sin confundir temperatura superficial con temperatura del aire.

## 3. Tendencias y validación

Estacionalidad, pendientes, intervalos, autocorrelación y comparaciones múltiples.
Integrar estaciones solo si las variables y cobertura son compatibles.

## 4. Estimación mediante ML

Baseline, evaluación bloqueada y un modelo candidato. Publicar solo si existen
métricas fuera de muestra y límites de extrapolación documentados.

## 5. Asistente y escenarios

Gemini en backend con clave privada, contexto de evidencia, caché, cuota de tokens,
reserva de costo previa a cada llamada y límite global de presupuesto.
Seleccionar modelo y precios vigentes en ese momento. Escenarios claramente
hipotéticos, con modelo y supuestos; 3D solo cuando aporte información.
