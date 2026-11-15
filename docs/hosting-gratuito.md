# Alojamiento gratuito del piloto

Configuración preparada el 15/11/2026 para Vercel Hobby, Render Free y
Supabase Free. La publicación y sus comprobaciones se registran por separado;
este archivo describe cómo reproducir la configuración.

## Web en Vercel

- Repositorio monorepo, raíz `apps/web`, preset Next.js y Node.js 22.
- Comando de compilación:
  `node ../../scripts/fetch-hosted-evidence.mjs && npm run build`.
- `API_INTERNAL_URL`: URL HTTPS de la API en Render, solo en servidor.
- `EVIDENCE_PACKAGE_URL`: URL HTTPS pública del directorio del paquete
  científico en Storage, con `checksums.json`, `analysis.json`,
  `explorer.json`, `manifest.json`, `series.csv` y `trends.png`.
- `EVIDENCE_CHECKSUMS_SHA256`: SHA-256 de `checksums.json`, calculado sobre
  los archivos locales revisados. Actualizarlo expresamente al publicar
  otra revisión. La compilación falla si cualquier hash difiere.

`next.config.ts` incluye estos archivos en el trazado de funciones para que
la lectura desde servidor funcione también en Vercel. Los artefactos siguen
fuera de Git. La descarga solo ocurre durante la compilación.

## API en Render

Servicio Python desde la raíz, plan Free, una instancia y Python 3.12.
Inicio: `uv run --no-sync uvicorn cocha_api.main:app --host 0.0.0.0
--port $PORT --no-access-log`. Healthcheck: `/health/live`.

Instalar con `uv sync --frozen --no-dev`. Descargar el snapshot publicado
como `data/processed/explorer.json` durante la compilación y comprobar su
SHA-256 antes de iniciar. No descargar ni procesar escenas Landsat en HTTP.
El snapshot forma parte del artefacto construido; las escrituras posteriores
en el disco efímero no persisten.

Configurar `DATABASE_URL` con TLS (`sslmode=require`) y driver
`postgresql+psycopg`. Para redes IPv4 usar el session pooler de Supabase.
Ejecutar Alembic como paso explícito antes del primer arranque, con una
credencial de migración; la API debe usar un rol de lectura. Las migraciones
futuras requieren otra ejecución con el rol autorizado para DDL.

`GEMINI_CALLS_ENABLED=false`, sin clave Gemini, y
`MONICA_REVIEW_ENABLED=false`. No habilitar registros restringidos ni llamadas
facturables en esta demostración. CORS debe indicar el dominio publicado.

## Supabase

Crear una base dedicada, habilitar PostGIS y aplicar las migraciones Alembic.
El acceso SQL de FastAPI no requiere habilitar Data API. Mantenerla apagada
si no se usa y no exponer tablas mediante permisos de `anon` o `authenticated`.

El bucket público `pilot-evidence` contiene únicamente los seis artefactos
científicos destinados a publicación. No subir credenciales, respaldos,
archivos MÓNICA restringidos ni el contenido completo de `data/local`.
Conservar respaldos propios fuera del proveedor gratuito.

## Límites

- Vercel Hobby exige uso personal y no comercial.
- Render Free puede suspenderse tras 15 minutos sin tráfico; la primera
  petición al despertar puede superar los timeouts de la web. Volver a cargar
  cuando la API esté disponible; no simular tráfico para eludir la suspensión.
- Supabase Free limita almacenamiento y transferencia y puede pausarse por
  inactividad. No es un servicio de disponibilidad garantizada.
- Mantener todos los servicios dentro de sus cuotas gratuitas, sin planes
  de prueba de pago, add-ons ni dominios comprados.

Verificar `/health/live`, `/health/ready`, `/v1/explorer`, las geometrías
distritales importadas y la página `/analisis` después de publicar.

Referencias: [Vercel Hobby](https://vercel.com/docs/plans/hobby),
[Render Free](https://render.com/docs/free),
[Supabase Free](https://supabase.com/pricing).
