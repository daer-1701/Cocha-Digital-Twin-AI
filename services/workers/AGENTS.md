# Procesamiento científico

Aplicar también `AGENTS.md` de la raíz y `docs/science.md`.

- Actualmente este directorio contiene un diseño, no un worker ejecutable.
- Extraer cálculos a funciones/módulos independientes del framework de colas.
  Empezar con lotes reproducibles; Celery/Redis cuando exista necesidad real.
- Manifestar entradas, versiones, parámetros, commit y checksum. Reintentos
  idempotentes; publicar solo después de validar artefactos completos.
- Preservar datos crudos. Separar temporales, procesados y modelos; no subir
  rásteres ni pesos a Git. Limitar concurrencia y volumen de descarga.
- No deducir soporte espacial/temporal de nombres de archivo. Consultar el
  producto y QA oficial; distinguir resolución nativa de remuestreo.
- Usar las skills geoespacial y de validación según la etapa, sin simular
  resultados cuando falte acceso o una variable terrestre compatible.
