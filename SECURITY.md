# Seguridad

No publicar claves en issues, pull requests, capturas ni logs. Si una clave se
filtra, revocarla y rotarla; eliminar el archivo del último commit no elimina
el secreto del historial.

Usar el canal privado del equipo o los avisos privados de seguridad del
repositorio cuando estén habilitados. No hay contacto de seguridad definido aún.

Esta base ofrece lecturas de catálogo y salud. Autenticación, autorización,
protección de trabajos costosos y controles Gemini están pendientes; deben
implementarse antes de exponer esas funciones.

Las configuraciones `.env` son locales. La clave Gemini queda reservada al
servidor y todavía no se utiliza. Las respuestas de fallo de base de datos no
incluyen cadenas de conexión ni detalles SQL.
