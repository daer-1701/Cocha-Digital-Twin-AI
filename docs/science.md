# Plan científico y política de evidencia

## Estado

No se ha descargado, procesado ni validado ningún dataset. Las fuentes
siguientes son candidatas, no integraciones disponibles.

| Fuente | Uso candidato | Verificación pendiente |
| --- | --- | --- |
| Landsat Collection 2 Level-2 | LST y NDVI a partir de reflectancia | Cobertura local, QA, escala, nubes, huecos y acceso |
| MODIS | Contexto temporal de mayor frecuencia | Producto y versión exactos, resolución y cobertura distrital |
| Red MÓNICA | Observaciones terrestres de variables disponibles | Archivos, variables, unidades, sensores, fechas, calidad y licencia |
| GAMC | Límites de los distritos | Fuente oficial, versión, CRS y permiso de uso |

No usar temperatura superficial como equivalente a temperatura del aire.
No remuestrear un producto para afirmar que tiene una resolución física mayor.
No asumir que MÓNICA mide todas las variables necesarias para calibrar LST.

## Pipeline futuro

```mermaid
flowchart TD
    A[Verificar fuente y acceso] --> B[Descargar y registrar checksum]
    B --> C[Aplicar escalas, unidades y máscaras QA]
    C --> D[Armonizar CRS y soporte espacial/temporal]
    D --> E[Calcular indicadores y cobertura válida]
    E --> F[Agregar por límites distritales verificados]
    F --> G[Analizar estacionalidad y tendencias]
    G --> H[Validar y registrar incertidumbre]
    H --> I[Publicar evidencia y procedencia]
```

Cada ejecución debe fijar período, área de estudio, productos/versiones,
parámetros, commit y entorno. Rásteres originales inmutables; procesamiento
idempotente con checksum y manifiesto. Reintentos no deben duplicar indicadores.

## Análisis y aprendizaje automático

- Definir la variable objetivo antes de entrenar.
- Comparar temporadas equivalentes; registrar sesgo por nubosidad y datos faltantes.
- Mostrar pendiente, intervalo, tamaño de muestra y cobertura válida.
- Evaluar autocorrelación y ajustar comparaciones múltiples cuando corresponda.
- Reportar asociación LST–NDVI sin atribuir causalidad automáticamente.
- Comparar baseline con un modelo adicional solo con datos suficientes.
- Validar por bloques espaciales y temporales; ajustar transformaciones usando
  únicamente entrenamiento. Evitar fuga entre píxeles vecinos o fechas futuras.
- Mostrar MAE/RMSE en unidades del objetivo y evaluar cobertura de intervalos.
- Distinguir observaciones, estimaciones y escenarios en API y gráficos.

## Recursos

- Reto: https://www.spaceappschallenge.org/2026/challenges/earth-system-trend-detective/
- Enfoque local: https://spaceappschallenge-cbba.com/#retos
- Portal municipal: https://recursosgamc.cochabamba.bo/
- Producto LST: https://www.usgs.gov/landsat-missions/landsat-collection-2-surface-temperature

La revisión inicial encontró el enfoque local publicado, pero no pudo verificar
archivos municipales descargables. Confirmar los recursos y criterios oficiales
antes de presentar; el stack de este repositorio es una decisión del proyecto.
