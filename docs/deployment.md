# Despliegue y operación

## Desarrollo y demo

Arranque desde PowerShell en la raíz:

```powershell
./scripts/start_docker.ps1
```

Requiere Docker Desktop iniciado con motor Linux y WSL 2 operativo. Si falta
WSL, su instalación puede pedir elevación de administrador y reinicio de Windows;
el script del proyecto no reinicia el equipo ni modifica características del sistema.
Después de instalar Docker, el script también busca el ejecutable en las rutas
estándar de instalación por usuario y para todos los usuarios, además de la
ubicación registrada en Windows para instalaciones en otro disco. Si el motor
no responde, inicia Docker Desktop y lo espera hasta 90 segundos.

Si no existe `.env`, genera uno desde `.env.example` con una contraseña aleatoria
sin mostrarla. Si existe, lo conserva íntegro. `-PrepareOnly` prepara los archivos
sin necesitar Docker. Un volumen PostgreSQL existente conserva su contraseña:
no borrar el volumen ni regenerar `.env` para intentar reparar autenticación.

La API recibe las variables opcionales de GAMC, Gemini y límites desde Compose;
no se incluyen archivos `.env` en las imágenes. Configurar una clave Gemini no
habilita llamadas facturables. Los snapshots se montan en solo lectura desde
`data/processed`; su ausencia produce un estado vacío y no genera datos ficticios.
El arranque no descarga datos satelitales.

El Compose raíz está orientado a un equipo local con Docker Desktop Linux.
Los contenedores web/API corren sin root; PostgreSQL usa la imagen PostGIS.
La cuenta POSTGRES_USER de esa imagen inicializa la base con privilegios altos:
no reutilizar esa configuración como política de permisos de producción.

Las imágenes y acciones usan versiones legibles. Para un despliegue regulado,
resolver y fijar digests/SHA tras verificar las imágenes y acciones elegidas.
Los lockfiles fijan las dependencias de aplicación; los parches de las imágenes
base se actualizan mediante reconstrucción y revisión.

## Antes de producción

- Proxy HTTPS, dominio y CORS explícito.
- Base en red privada, credenciales distintas para migraciones y aplicación;
  aplicación con privilegios mínimos.
- Secrets del proveedor, sin claves en Git ni variables NEXT_PUBLIC_*.
- Autenticación/autorización antes de publicar escritura, trabajos costosos o Gemini.
- Límites de solicitudes, cuotas y presupuesto para endpoints con costo.
- Copias de seguridad, prueba de restauración y monitoreo de errores y disco.
- Almacenamiento persistente de rásteres y política de retención.
- Migración previa al cambio de versión y rollback de aplicación compatible.

## Preparación de producción (AF10)

Estado: **configuración y procedimientos preparados, nada desplegado ni
ensayado**. El entorno final sigue siendo una decisión pendiente del equipo.

### Red y HTTPS

- Un proxy inverso (Caddy, Nginx o el del proveedor) termina TLS y reenvía a
  `web:3000`. La API no se publica: la web la llama por red interna
  (`API_INTERNAL_URL`). Si la API debe ser pública, exponerla solo detrás del
  proxy con HTTPS y `CORS_ORIGINS` igual al dominio de la web.
- PostgreSQL sin puerto público; en Compose se quita `ports` de `db` o se deja
  ligado a `127.0.0.1` del host.

### Base y privilegios mínimos

`infrastructure/postgres/least_privilege.sql` es una plantilla, no ejecutada,
con tres roles: `cocha_migrator` (Alembic), `cocha_api` (lectura y ledger del
asistente) y `cocha_worker` (procesos offline). Cada servicio usa su propia
credencial. La cuenta `POSTGRES_USER` de la imagen no se usa en producción.

### Secretos y roles

- Secretos solo en el gestor del proveedor o en `.env` del servidor, nunca en
  Git ni en `NEXT_PUBLIC_*`: `POSTGRES_PASSWORD`, `GAMC_WMS_API_KEY`,
  `GEMINI_API_KEY`, `API_OPERATOR_TOKEN`, `API_REVIEWER_TOKEN`,
  `API_ASSISTANT_TOKEN`.
- Los tokens por rol tienen al menos 24 caracteres y son secretos compartidos
  entre servidores, no cuentas de usuario. Rotarlos implica reiniciar API y web.

### Costos

- `GEMINI_CALLS_ENABLED=false` hasta una autorización explícita. Con `true`,
  el ledger central `assistant_requests` reserva antes de cada llamada y
  rechaza al superar `GEMINI_BUDGET_USD`. Configurar además una alerta de
  facturación en Google Cloud: el ledger no ve otros consumos de la cuenta.
- La cuota por cliente del asistente y del proxy WMS vive en memoria por
  proceso; con varias réplicas se multiplica. Usar una sola réplica de API o un
  limitador compartido antes de escalar.

### Salud y alertas

- Comprobar `/health/ready` cada minuto desde fuera del host; alertar tras dos
  fallos seguidos.
- Alertar por disco (`data/`, volumen de PostgreSQL) por encima del 80 %.
- Revisar `GET /v1/jobs?status=running` y ejecutar
  `uv run python scripts/recover_jobs.py` (simulación) para detectar trabajos
  sin latido. `--apply` solo con acuerdo del operador.
- Registrar errores 5xx del proxy; los logs de la API no incluyen secretos ni
  texto de excepciones del proveedor.

### Despliegue y rollback

1. Respaldo previo (procedimiento de Eduardo, abajo) y checksum anotado.
2. `docker compose run --rm migrate` con la nueva imagen. La migración 0003
   añade columnas y restricciones; falla si hay indicadores duplicados con
   `processing_run_id` nulo o si demo y oficial comparten número en el
   downgrade. Comprobar antes:
   `SELECT district_id, boundary_version, variable, period_start, period_end, statistic, count(*) FROM district_indicators WHERE processing_run_id IS NULL GROUP BY 1,2,3,4,5,6 HAVING count(*) > 1;`
3. Arrancar API y web nuevas; verificar `/health/ready`.
4. Rollback de aplicación: volver a la imagen anterior. La 0003 es aditiva y
   la API anterior ignora las columnas nuevas, así que no hace falta bajar el
   esquema. `alembic downgrade 0002` solo si se decide expresamente y tras
   respaldo: elimina `assistant_requests` y los estados de publicación.

### Pendiente de decisión

- Proveedor y región, dominio y certificado.
- Gestor de secretos y política de rotación.
- Almacenamiento externo cifrado de respaldos y retención (EF10).
- Limitador compartido si se usa más de una réplica.
- Monitoreo concreto (servicio de uptime, alertas de disco y facturación).

## Operación

`/health/live` solo comprueba HTTP. `/health/ready` verifica conectividad a
PostGIS y coincidencia de la revisión Alembic con el código; no evalúa calidad científica
ni deriva del esquema. Ejecutar `alembic check` en el proceso de entrega.

No ejecutar migraciones en cada worker ni usar `create_all`. El servicio
`migrate` de Compose es un trabajo explícito de una sola ejecución.

## Backup local

Procedimiento de Eduardo (EF10). Herramienta preparada, todavía pendiente de
pruebas; el ensayo de restauración lo ejecuta Eduardo en una base nueva, nunca
contra desarrollo. Esta entrega no afirma ninguna restauración exitosa.

```powershell
uv run python scripts/database_archive.py backup data/local/backups/cocha-20261114.dump
uv run python scripts/database_archive.py restore data/local/backups/cocha-20261114.dump --database cocha_20261114_restore_test
```

No se ejecutó durante esta entrega. El respaldo incluye un manifiesto SHA-256 y
se rechaza sobrescribir archivos. Requiere un sistema de archivos con enlaces
duros (NTFS/ext4) para publicar el archivo completo sin reemplazar otro.
La restauración crea una base nueva: nunca reutiliza ni limpia una existente.
Verificar PostGIS, revisión Alembic y conteos antes de aceptar una restauración.
La base de ensayo se conserva para inspección. El dump no incluye snapshots,
CSV originales ni roles globales: respaldarlos por separado según permisos.
Guardar copias cifradas fuera del equipo y configurar retención antes de producción.
En Windows, proteger la carpeta con permisos del usuario; `chmod` no sustituye ACL.

La revisión de filas MÓNICA requiere `MONICA_REVIEW_ENABLED=true` en configuración
local del servidor, `API_REVIEWER_TOKEN` en la API y en el servidor web, y
reiniciar ambos. Se mantiene apagada por defecto; no activar
en un servicio público antes de confirmar licencia y controles de acceso.
Compose pasa la clave WMS desde `GAMC_WMS_API_KEY` exclusivamente a la API.

Ejemplo con herramienta nativa de PostgreSQL; evitar redirigir un dump binario
con PowerShell antiguo:

```powershell
docker compose exec db pg_dump -U cocha -d cocha -Fc -f /tmp/cocha.dump
docker compose cp db:/tmp/cocha.dump ./cocha.dump
```

Ajustar usuario y nombre de base si se cambiaron. El dump puede contener datos
sensibles; almacenarlo fuera de Git y comprobar su restauración en otra base.
