# Cocha Digital Twin AI — instrucciones compartidas

Estas reglas aplican a Codex y Cursor. Las instrucciones explícitas del usuario
definen el alcance. Las reglas de subdirectorios añaden detalles de su área.

## Contexto y fuentes de verdad

- Objetivo: evidencia ambiental reproducible de Cochabamba, con datos reales.
- Consultar `README.md`, `docs/architecture.md` y los archivos afectados antes
  de proponer cambios. Para ciencia, consultar `docs/science.md`.
- La base técnica existe; consultar el código y `docs/roadmap.md` para distinguir
  lo implementado de lo planificado. No afirmar que NASA, MÓNICA, ML o Gemini
  están integrados sin comprobarlo.
- Comunicación y documentación de producto en español; identificadores de
  código y contratos en inglés. Explicar resultados y límites con precisión.

## Trabajar con dos editores

- Comenzar con `git status --short` y revisar los diffs relacionados.
- Conservar cambios del usuario y del otro editor. No revertir, borrar ni
  reformatear archivos ajenos a la tarea.
- Evitar que dos agentes editen simultáneamente el mismo archivo. Para trabajo
  paralelo acordar archivos distintos o usar ramas en worktrees separados;
  dos ramas dentro de una misma carpeta no aíslan los cambios.
- Al terminar indicar archivos modificados, verificaciones realizadas y
  pendientes. No crear commit, push, merge ni despliegue sin una solicitud
  que los incluya. Implementar cambios locales autorizados sin pedir
  confirmación repetida para decisiones rutinarias.

## Arquitectura y código

- Mantener límites: web → API → persistencia; cálculo científico fuera de
  componentes React y de peticiones HTTP largas.
- TypeScript estricto y Python tipado en interfaces nuevas. Validar entradas
  externas y respuestas de proveedores en sus límites.
- Reutilizar patrones existentes. Añadir capas y dependencias cuando resuelvan
  una necesidad concreta; no instalar todo el stack previsto por adelantado.
- Usar npm workspaces y `uv`; versionar `package-lock.json` y `uv.lock`.
  No introducir otro gestor sin justificar y acordar la migración.
- Migraciones con Alembic; no `create_all` al iniciar la aplicación. Revisar
  SQL generado, compatibilidad y efecto sobre datos existentes.
- Pydantic/OpenAPI es la fuente del contrato. Regenerar, no editar a mano:
  `uv run python scripts/export_openapi.py` y `npm run contracts:generate`.

## Integridad científica

- No inventar mediciones, límites oficiales, métricas ni predicciones. Fixtures
  sintéticas solo en pruebas o demos identificadas explícitamente.
- Separar observaciones, estimaciones y escenarios en contratos e interfaz.
- No confundir LST con temperatura del aire, ni correlación con causalidad.
- Conservar fuente, producto/versión, período, unidades, QA, resolución,
  cobertura válida y procedencia del procesamiento.
- La falta de datos es un estado válido; no convertirla en cero ni ocultarla.
- No atribuir requisitos al reto NASA sin verificar su documentación oficial.

## Secretos y costos

- No leer ni imprimir `.env` o credenciales por defecto. Inspeccionar nombres
  de variables, `.env.example` y configuración; acceder al mínimo necesario
  solo cuando la tarea lo requiera, sin revelar valores.
- Claves exclusivamente en servidor. Nunca `NEXT_PUBLIC_*`, código cliente,
  notebooks, fixtures, URLs o logs para secretos.
- No descargar colecciones completas ni lanzar entrenamiento o APIs de pago
  por el solo hecho de implementar código. Utilizar el alcance y presupuesto
  autorizado; respetar controles de cuota antes de cada llamada facturable.
- El presupuesto declarado para Gemini es aproximadamente USD 4. No asumir
  precios ni modelo vigente: verificarlos al implementar la integración.

## Validación proporcional

- Backend: `uv run ruff check .`, `uv run ruff format --check .` y las pruebas
  relacionadas con el cambio. Usar `uv run --group science pytest -q` para
  incluir las pruebas del procesamiento Landsat.
- Web: `npm run lint`, `npm run typecheck`; `npm run build` para cambios que
  afecten compilación, dependencias o comportamiento de la aplicación.
- API: regenerar contratos y verificar su diff. DB: probar migraciones y
  `uv run alembic check` en una base exclusiva de pruebas con PostGIS.
- Docker: `docker compose config --quiet` cuando exista `.env` local; sin ella,
  usar `docker compose --env-file .env.example config --quiet`. No imprimir
  la configuración resuelta, que puede incluir secretos.
- No ejecutar pruebas que escriban sobre la base de desarrollo o producción.
  No afirmar que una prueba omitida, una CI aún no ejecutada o un contenedor
  que no arrancó quedaron validados.
- No añadir pruebas que solo reproduzcan la implementación. En cambios de
  documentación basta revisar estructura, enlaces y diff.

## Skills del repositorio

Descubrir `.agents/skills/*/SKILL.md` y cargar solo la skill pertinente:

- `cocha-geospatial-ingestion`: adquisición, QA e indicadores territoriales.
- `cocha-scientific-validation`: tendencias, ML, incertidumbre y escenarios.
- `cocha-gemini-budget`: asistente con evidencia y presupuesto limitado.
- `security-best-practices`: revisión de seguridad solicitada.
- `jupyter-notebook`: crear o editar notebooks.
- `playwright`: comprobar flujos en un navegador real.
- `frontend-design`: dirección visual y redacción de interfaz; subordinada a
 la precisión científica y a `apps/web/AGENTS.md`.
- `gh-fix-ci`: diagnosticar fallos de GitHub Actions.

Ver `docs/ai-workflow.md` para invocación, requisitos y procedencia. Una skill
no autoriza publicaciones, pagos o cambios externos adicionales.
En las skills importadas, resolver scripts y referencias desde la carpeta de
la skill en este repositorio; sus ejemplos de instalación global pueden usar
otra ruta. En PowerShell adaptar sintaxis de shell sin cambiar la operación.
