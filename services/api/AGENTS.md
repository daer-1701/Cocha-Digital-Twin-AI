# Backend y base de datos

Aplicar también `AGENTS.md` de la raíz.

- Rutas bajo `/v1` para el dominio; salud separada. Esquemas públicos Pydantic
  separados de modelos ORM. Paginación y filtros acotados.
- No devolver excepciones SQL, cadenas de conexión ni claves en respuestas.
- Mantener sesiones con cierre garantizado y transacciones explícitas en
  escrituras. No concatenar entradas de usuario en SQL.
- Usar rutas síncronas con el engine síncrono actual. No bloquear el event loop
  con SQLAlchemy síncrono ni con trabajo científico intensivo.
- Cambios de modelos requieren una migración revisada. No alterar migraciones
  ya compartidas/aplicadas; crear otra. Evaluar pérdida de datos al revertir.
- PostGIS lo provisiona infraestructura. Mantener SRID explícito, geometrías
  válidas y metadatos de versión del límite territorial.
- No añadir autenticación aparente: antes de publicar escritura, trabajos o
  Gemini, implementar y verificar permisos, cuotas y límites pertinentes.
- Mantener liveness independiente de DB; readiness no significa calidad
  científica. Reutilizar el patrón de fallo sanitizado existente.
- Regenerar contratos desde la raíz y validar pruebas sobre una DB exclusiva.
