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

Ejemplo con herramienta nativa de PostgreSQL; evitar redirigir un dump binario
con PowerShell antiguo:

```powershell
docker compose exec db pg_dump -U cocha -d cocha -Fc -f /tmp/cocha.dump
docker compose cp db:/tmp/cocha.dump ./cocha.dump
```

Ajustar usuario y nombre de base si se cambiaron. El dump puede contener datos
sensibles; almacenarlo fuera de Git y comprobar su restauración en otra base.
