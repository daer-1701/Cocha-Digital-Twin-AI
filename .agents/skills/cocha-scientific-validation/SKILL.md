---
name: cocha-scientific-validation
description: Diseñar o revisar tendencias ambientales, relaciones LST–NDVI, estimaciones ML, incertidumbre y escenarios de Cochabamba. Usar para análisis científico y validación, no para refactorizaciones sin efecto analítico.
---

# Validación de evidencia ambiental

Consultar `docs/science.md` y los datos/manifiestos disponibles. Antes de elegir
un método definir pregunta, variable objetivo, unidad, población espacial,
período y si el resultado es descriptivo, predictivo o hipotético.

## Series y tendencias

- Revisar cobertura, huecos, QA, cambios de sensor/límite y estacionalidad.
  No comparar años con meses o cobertura sistemáticamente distintos sin ajuste.
- Estimar magnitud en unidades interpretables, intervalo y tamaño efectivo
  de muestra. Usar un método apropiado para la serie disponible, no un test fijo.
- Evaluar autocorrelación y dependencia espacial. Justificar errores robustos,
  bootstrap por bloques u otro ajuste; no tratar píxeles vecinos como réplicas
  independientes para inflar significancia.
- Definir la familia de contrastes al comparar distritos/variables y corregir
  multiplicidad cuando corresponda. Mostrar p original y ajustado con método.
- Una muestra insuficiente produce un resultado inconcluso. Un p mayor al
  umbral no demuestra ausencia de cambio; un p pequeño no demuestra causalidad.

## Relaciones y predicción

- Distinguir LST, temperatura del aire y contaminantes. Solo calibrar una
  variable con referencias compatibles, explicando diferencias de soporte.
- En LST–NDVI considerar elevación, estación, impermeabilización y muestreo.
  No interpretar asociaciones como efecto causal de plantar árboles.
- Comparar un baseline simple con el modelo candidato sobre los mismos folds.
- Separar por tiempo y bloques espaciales/estaciones según el uso esperado;
  reservar evaluación fuera de muestra y ajustar preprocesamiento solo en train.
- Registrar semilla cuando aplique, variables, hiperparámetros, datos/commit,
  particiones y MAE/RMSE en unidades originales. No reportar solo R² de train.
- Cuantificar incertidumbre con método explícito y evaluar cobertura en datos
  retenidos. Distinguir intervalo de confianza de intervalo predictivo.
- Detectar extrapolación y cambios de distribución; abstenerse o advertir ante
  condiciones sin soporte. No llamar predicción a una simple interpolación sin explicarlo.

## Escenarios y entrega

Cambiar NDVI en un regresor no valida una intervención urbana. Un escenario
debe declarar modelo, supuestos, rango admisible y qué efectos no representa.
Usar etiquetas de simulación y no prometer grados de enfriamiento como certeza.

Entregar metodología breve, procedencia, tablas de resultados calculados,
validación fuera de muestra cuando aplique e incertidumbre visible en API/UI.
Probar invariantes que importen: datos constantes o insuficientes, fuga entre
particiones, unidades y calibración de intervalos. No generar métricas de demo
para suplir una ejecución pendiente.
