# Notas de seguridad del tramo A16

Alcance de esta revisión: controles implementados en la API de lectura. No
sustituye una auditoría ni añade autenticación completa de usuarios.

## Lo que cubre el código

- La API es de lectura salvo `POST /v1/assistant/ask`, protegido por rol.
  CORS con métodos GET no es autenticación.
- No hay escritura HTTP de jobs, modelos ni escenarios; se cargan con scripts.
- `require_write_token` (`API_WRITE_TOKEN`) bloquea rutas mutadoras futuras:
  sin token configurado responde 503; token ausente o inválido, 401/403.
  No se montó `POST /v1/admin/ping`: CORS solo permite GET y la API pública
  sigue siendo de lectura. El helper se prueba en `tests/unit/test_auth.py`.
- `GAMC_WMS_API_KEY` y `GEMINI_API_KEY` se leen solo en el servidor. Las
  respuestas de error del proxy WMS redactan la clave, y `GET /v1/assistant`
  informa si hay clave sin devolverla.
- El proxy WMS tiene un límite de tasa en memoria por proceso. No se comparte
  entre workers ni sobrevive a un reinicio.
- El ledger JSON local (`data/local/`, fuera de Git) solo informa el estado con
  las llamadas apagadas. Con llamadas habilitadas, el presupuesto se reserva en
  la tabla central `assistant_requests` con un bloqueo consultivo común a hosts.
- El asistente no llama a Gemini. El presupuesto por defecto es 4 USD, un tope
  del proyecto, no un saldo verificado. Modelo `gemini-3.6-flash` y tarifas
  pagadas 0.75/3.75 USD por 1M tokens (hasta 2026-12-31) verificadas el
  14/11/2026 en https://ai.google.dev/gemini-api/docs/pricing. Las llamadas
  reales siguen deshabilitadas y requieren autorización explícita.
- Los jobs publicados no incluyen el JSON de parámetros, para no exponer
  valores que alguien hubiera guardado ahí.

## Permisos por capacidad (AF08)

- `core/auth.py` define tres roles: `operator`, `reviewer` y `assistant`.
  Cada uno se habilita con su propio secreto (`API_*_TOKEN`, al menos 24
  caracteres); sin él, la capacidad responde 503. La comparación usa
  `hmac.compare_digest`. `require_write_token` también pasó a tiempo constante.
- No es un sistema de cuentas: no identifica personas, no audita usuarios ni
  rota claves. Quien posee un token tiene la capacidad completa.
- `reviewer` protege los registros MÓNICA, además de `MONICA_REVIEW_ENABLED`.
  La web reenvía el token desde el servidor; cualquier visitante de esa página
  ve los registros, así que solo se activa en entornos privados.
- `assistant` protege `POST /v1/assistant/ask`, la única acción con costo.
  Además exige `GEMINI_CALLS_ENABLED=true`, clave y precios verificados.
- `operator` queda reservado para futuras rutas de operación; hoy las
  operaciones se hacen con scripts que usan credenciales de base de datos.

## Pendiente de despliegue

- Cuentas de usuario y auditoría individual si el producto las necesita
  (decisión pendiente en `docs/matriz-alcance.md`).
- Límite de tasa compartido si hay más de un proceso.
- Autorización explícita y acotada antes de `GEMINI_CALLS_ENABLED=true`.
