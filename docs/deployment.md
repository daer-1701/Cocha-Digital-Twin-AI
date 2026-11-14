# Despliegue y operación

## Desarrollo y demo

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

## Operación

`/health/live` solo comprueba HTTP. `/health/ready` verifica conectividad a
PostGIS y coincidencia de la revisión Alembic con el código; no evalúa calidad científica
ni deriva del esquema. Ejecutar `alembic check` en el proceso de entrega.

No ejecutar migraciones en cada worker ni usar `create_all`. El servicio
`migrate` de Compose es un trabajo explícito de una sola ejecución.

## Backup local

Herramienta preparada, todavía pendiente de pruebas:

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
local del servidor y reiniciar la API. Se mantiene apagada por defecto; no activar
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
