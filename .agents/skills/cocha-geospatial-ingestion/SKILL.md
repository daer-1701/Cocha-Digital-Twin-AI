---
name: cocha-geospatial-ingestion
description: Construir o revisar ingesta satelital, máscaras QA, armonización geoespacial y agregaciones distritales para Cochabamba. Usar al integrar NASA, Landsat o datos municipales, no para cambios de interfaz sin procesamiento.
---

# Ingesta geoespacial reproducible

Trabajar desde la raíz del repositorio y consultar `docs/science.md`,
`docs/data-model.md` y la implementación afectada. La lista de fuentes candidatas
no prueba que exista acceso ni que un producto cubra el período solicitado.

## Elegir una fuente verificable

- Fijar variable, área, período y soporte espacial/temporal antes de descargar.
- Consultar documentación primaria del producto y versión: bandas, unidades,
  factores de escala/offset, relleno, QA, resolución nativa y licencia.
- Comprobar una consulta y muestra pequeñas antes de ampliar la ingesta.
  Separar disponibilidad de catálogo, acceso autenticado y descarga probada.
- Para MÓNICA verificar variables y sensores reales, coordenadas, horarios,
  huso, unidades y calidad. No asumir temperatura del aire o LST disponible.
- Para distritos exigir geometrías con fuente y versión. Si faltan, reportar
  la limitación; no sustituirlas silenciosamente por polígonos aproximados.

## Procesar sin cambiar el significado

- Preservar originales; guardar manifiesto con consulta, URL sin secretos,
  producto, versión, adquisición, SHA-256, licencia y fecha de recuperación.
- Aplicar máscaras del producto antes de calcular índices o agregar. Enmascarar
  fill/nubes/sombras/saturación según documentación y conservar flags útiles.
- Aplicar escalas a reflectancias antes de calcular NDVI cuando haya offsets.
  Proteger denominador cero, NoData y valores fuera del dominio esperado.
- Convertir Kelvin a Celsius solo después de la decodificación oficial. No
  aplicar dos veces scale/offset si xarray/rasterio ya los decodificó.
- Conservar CRS explícito. Transformar al CRS apropiado para áreas/distancias;
  no calcularlas directamente en grados. Verificar orden de ejes.
- Remuestreo según variable: categóricas/QA con vecino más cercano; continuas
  con método justificado. No atribuir detalle físico adicional al remuestreo.
- Alinear soporte temporal y espacial antes de fusionar sensores. No tratar
  un compuesto multidiario como una medición instantánea de estación.
- Agregar por área de intersección cuando corresponda. Reportar fracción
  válida, número de observaciones y reglas de aceptación; no convertir NoData en 0.

## Entregar y comprobar

Resultados en `data/processed` o almacenamiento externo; metadatos y geometrías
en PostGIS mediante una migración cuando sea necesaria. Usar COG para rásteres
consultables; lógica reutilizable fuera de notebooks.

Verificar con una muestra real trazable y pruebas pequeñas de escala/offset,
QA, NoData, CRS y agregación de borde según las operaciones implementadas.
Fixtures sintéticas son válidas para estas pruebas si están identificadas.
Entregar comando reproducible, manifiesto, cobertura y limitaciones. Si no hay
credenciales, dejar configuración segura y describir qué no se ejecutó.
