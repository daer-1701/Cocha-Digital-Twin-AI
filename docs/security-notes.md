# Notas de seguridad del tramo A16

Alcance de esta revisión: controles implementados en la API de lectura. No
sustituye una auditoría ni añade autenticación completa de usuarios.

## Lo que cubre el código

- La API pública sigue en GET. CORS con métodos GET no es autenticación.
- No hay escritura pública de jobs, modelos, escenarios ni del asistente.
- `require_write_token` (`API_WRITE_TOKEN`) bloquea rutas mutadoras futuras:
  sin token configurado responde 503; token ausente/ inválido 401/403.
- `GAMC_WMS_API_KEY` y `GEMINI_API_KEY` se leen solo en el servidor. Las
  respuestas de error del proxy WMS redactan la clave, y `GET /v1/assistant`
  informa si hay clave sin devolverla.
- El proxy WMS tiene un límite de tasa en memoria por proceso. No se comparte
  entre workers ni sobrevive a un reinicio.
- El ledger de Gemini usa un candado dentro del proceso y un reemplazo de
  archivo local. No coordina varios procesos. Vive en `data/local/`, fuera de Git.
- El asistente no llama a Gemini. El presupuesto por defecto es 4 USD, un tope
  del proyecto, no un saldo verificado. Modelo `gemini-3.6-flash` y tarifas
  pagadas 0.75/3.75 USD por 1M tokens (hasta 2026-12-31) verificadas el
  14/11/2026 en https://ai.google.dev/gemini-api/docs/pricing. Las llamadas
  reales siguen deshabilitadas.
- Los jobs publicados no incluyen el JSON de parámetros, para no exponer
  valores que alguien hubiera guardado ahí.

## Pendiente de despliegue

- Roles de lectura y administración antes de abrir escrituras, inferencia o
  llamadas de pago.
- Límite de tasa compartido si hay más de un proceso.
- Activar proveedor real distinto de `FakeProvider` solo con presupuesto y
  permiso explícitos.
