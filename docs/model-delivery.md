# Contrato de entrega de modelos y escenarios (AF06)

Estado: **bloqueado**. No existe un modelo aceptado (MF08) ni un escenario
validado (MF09). La API responde `unavailable` en `/v1/models` y
`/v1/scenarios`. Este documento fija qué debe entregar Mateo para que Andrés
publique un modelo sin decisiones improvisadas.

## Qué entrega procesamiento

1. Artefacto en un formato que no ejecute código al cargarse: `.json`
   (coeficientes), `.onnx` o `.csv`. Pickle, joblib y similares se rechazan.
2. Manifiesto JSON validado por
   `cocha_api.science.model_registry.ModelManifest`:
   - `objective`, `target_variable`, `target_units`, `model_version`;
   - `artifact_file` (relativo a la carpeta de registro) y `artifact_sha256`;
   - `validation_partition` (por ejemplo, bloques espaciales/temporales);
   - `metrics` fuera de muestra y `baseline_metrics` comparables;
   - `uncertainty`: método, nivel del intervalo y descripción;
   - `domain_of_use`: entradas con unidades y rango, bbox WGS84, período y
     versión territorial si aplica;
   - `nature` siempre `estimate`.
3. Una fila `model_runs` cargada como `draft` con `model_version`,
   `artifact_checksum_sha256`, `uncertainty` y `domain_of_use`.

## Aceptación y publicación

```powershell
uv run python scripts/publish_results.py model_runs --processing-run-id <uuid> --accepted-by "Mateo"
uv run python scripts/publish_results.py model_runs --processing-run-id <uuid> --accepted-by "Mateo" --apply
```

La base rechaza `accepted` sin versión, checksum, incertidumbre y dominio
(restricción `model_runs_acceptance`, migración 0003). Solo entonces
`/v1/models` lista `accepted_models` con `status=available`.

## Ejecución

- `verify_artifact` comprueba ruta y SHA-256 antes de leer el artefacto.
- `out_of_domain` lista entradas ausentes, no finitas o fuera de rango; una
  petición con problemas debe responder fuera de dominio, nunca extrapolar.
- La inferencia no se ejecuta dentro de una petición HTTP larga. Cuando exista
  un modelo aceptado, se decidirá entre inferencia acotada en proceso (si es
  un cálculo de milisegundos) o un trabajo offline con `cocha_api.jobs`.
- Los escenarios se publican como `scenario`, con supuestos y resultado
  separados de observaciones y estimaciones.

## Pendiente

- Endpoint de inferencia y de escenarios: no se implementa sin modelo aceptado.
- Formato concreto del artefacto según el tipo de modelo que elija Mateo.
- Carpeta y almacenamiento del registro en el entorno compartido.
