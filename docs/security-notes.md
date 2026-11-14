# Notas de seguridad del tramo A16

Alcance de esta revisión: controles implementados en la API de lectura. No
sustituye una auditoría ni añade autenticación.

## Lo que cubre el código

- La API pública sigue en GET. CORS con métodos GET no es autenticación.
- No hay escritura pública de jobs, modelos, escenarios ni del asistente.
- `GAMC_WMS_API_KEY` y `GEMINI_API_KEY` se leen solo en el servidor. Las
  respuestas de error del proxy WMS redactan la clave, y `GET /v1/assistant`
  informa si hay clave sin devolverla.
- El proxy WMS tiene un límite de tasa en memoria por proceso. No se comparte
  entre workers ni sobrevive a un reinicio.
- El ledger de Gemini usa un candado dentro del proceso y un reemplazo de
  archivo local. No coordina varios procesos. Vive en `data/local/`, fuera de Git.
- El asistente no llama a Gemini. El presupuesto por defecto es 4 USD, un tope
  del proyecto, no un saldo verificado. Los campos de precio por millón de
  tokens son marcadores de posición: hay que contrastarlos con la tarifa
  oficial de Google antes de cualquier llamada real.
- Los jobs publicados no incluyen el JSON de parámetros, para no exponer
  valores que alguien hubiera guardado ahí.

## Pendiente de despliegue

- Roles de lectura y administración antes de abrir escrituras, inferencia o
  llamadas de pago.
- Límite de tasa compartido si hay más de un proceso.
- Confirmación de precios y modelo vigentes, y un proveedor real distinto de
  `FakeProvider`, solo con presupuesto y permiso explícitos.
