# Trabajar con Codex y Cursor

## Configuración compartida

`AGENTS.md` contiene las reglas comunes. Hay instrucciones de área en
`apps/web/AGENTS.md`, `services/api/AGENTS.md` y `services/workers/AGENTS.md`.
Cursor tiene además un adaptador en `.cursor/rules/project.mdc` y una regla
de contexto científico. No hay que copiar estas instrucciones a preferencias
globales de cada editor.

Las ocho skills están en `.agents/skills/`, ubicación de proyecto reconocida
por ambos productos en su documentación vigente. Se versionan junto al código,
para que otra persona obtenga las mismas instrucciones al clonar el repositorio.
No se modificó la configuración global de Codex ni de Cursor.

Las skills estarán disponibles para descubrimiento en el próximo turno de
Codex. En Cursor abrir la raíz del repositorio y una nueva conversación;
si no aparecen, recargar la ventana y comprobar la versión instalada.
Los archivos preparados no prueban que la interfaz de cada editor los haya
cargado; comprobarlo en el selector de skills o pidiendo al agente que indique
las instrucciones y skills disponibles antes de comenzar.

## Selección

| Skill | Uso recomendado | Origen |
| --- | --- | --- |
| `cocha-geospatial-ingestion` | Productos satelitales, escalas, QA, CRS y agregación distrital | Creada para este proyecto |
| `cocha-scientific-validation` | Tendencias, LST–NDVI, particiones ML, incertidumbre y escenarios | Creada para este proyecto |
| `cocha-gemini-budget` | Evidencia, reservas de costo, cuotas, caché y errores Gemini | Creada para este proyecto |
| `security-best-practices` | Revisiones solicitadas de seguridad Python, Next.js y React | Catálogo de OpenAI |
| `jupyter-notebook` | Notebooks de experimentación reproducibles | Catálogo de OpenAI |
| `playwright` | Explorar y verificar flujos en navegador real | Catálogo de OpenAI |
| `gh-fix-ci` | Diagnosticar checks fallidos de GitHub Actions | Catálogo de OpenAI |
| `frontend-design` | Dirección visual, tipografía y redacción de interfaz | Repositorio de skills de Anthropic |

Se revisó el catálogo curado de OpenAI y se eligieron capacidades relevantes
para el stack existente. No se incorporaron skills de AWS, Vercel, Figma u otros
proveedores porque todavía no hay una decisión de plataforma que las requiera.
Las tres skills locales cubren requisitos científicos y de presupuesto que
las seleccionadas del catálogo no cubren de forma específica.

## Ejemplos de uso

En Codex se puede invocar una skill por nombre con `$nombre`. En Cursor,
escribir `/` y buscar la skill. También se puede solicitar por su nombre en
lenguaje natural; la selección automática depende de la tarea y del agente.

Ejemplos:

```text
Usa cocha-geospatial-ingestion para comprobar un producto Landsat sobre
Cochabamba. Empieza con una muestra pequeña y entrega procedencia y QA.

Usa cocha-scientific-validation para revisar si la comparación entre años
controla estacionalidad y si la validación del modelo tiene fuga espacial.

Usa cocha-gemini-budget para implementar el adaptador con pruebas sin llamadas
reales y un límite global de gasto configurable.

Usa security-best-practices para revisar la API y el manejo de secretos.

Usa playwright para verificar selección de distrito, leyenda y estados sin datos
cuando esas funcionalidades estén implementadas.
```

## Requisitos de las skills importadas

- **Seguridad:** incluye referencias para FastAPI, Next.js y React. Es una
  revisión técnica asistida; no reemplaza controles verificables ni una auditoría.
- **Notebooks:** el generador usa Python estándar; ejecutar notebooks requiere
  instalar las dependencias de su contenido cuando se incorpore esa función.
  Ruta local del generador:
  `.agents/skills/jupyter-notebook/scripts/new_notebook.py`.
- **Playwright:** la skill usa CLI y un wrapper Bash con npx. En Windows se
  puede usar Git Bash o adaptar los comandos a PowerShell mediante
  `npx.cmd --package @playwright/cli playwright-cli`. Requiere paquetes y un
  navegador compatibles; no se descargaron navegadores durante esta preparación.
  La versión de CLI ejecutada por npx debe fijarse al incorporar un flujo
  reproducible al proyecto. El wrapper upstream usa resolución dinámica.
- **CI:** requiere GitHub CLI (`gh`), autenticación y un repositorio remoto/PR.
  `gh` no estaba disponible en PATH durante esta preparación. No se intentó
  iniciar sesión, publicar ni ejecutar acciones remotas.

Las skills upstream traen ejemplos en `~/.codex/skills`. En este proyecto sus
scripts y referencias se resuelven desde `.agents/skills/<nombre>/`.
La skill de CI incluye una etapa de aprobación del plan; interpretar las
instrucciones explícitas de la sesión y no pedir de nuevo autorizaciones ya
otorgadas. Las instrucciones de una skill no conceden permisos por sí mismas.

## Coordinar los editores

Para tareas consecutivas en la misma carpeta:

1. Terminar la edición activa y revisar el diff.
2. Indicar al siguiente agente qué cambió y qué falta verificar.
3. El siguiente agente lee Git y el código actual antes de editar.

Para tareas simultáneas, asignar archivos distintos. Si ambas pueden tocar
contratos, lockfiles o configuración, usar worktrees separados y revisar la
integración. Evitar instalaciones o regeneraciones concurrentes en la misma
carpeta. No hace falta dividir tareas artificialmente entre editores: cualquiera
puede trabajar en frontend, backend o ciencia con las mismas reglas.

Las reglas son instrucciones para los agentes, no un mecanismo de bloqueo ni
una garantía de cumplimiento. CI y revisión de cambios siguen siendo necesarias.

## Procedencia y mantenimiento

Las cuatro skills externas provienen de `openai/skills`, revisión:
`49f948faa9258a0c61caceaf225e179651397431`.
Se instalaron con el helper de skill-installer fijando esa revisión. Se
conservaron scripts, referencias, assets y licencias Apache-2.0 de cada skill.
No se ejecutaron los scripts importados para operar servicios externos.

`frontend-design` proviene de `anthropics/skills`, revisión
`1780c5e5a552fd4d1c9d6a7b0cab26b0c2bef064`, con su licencia Apache-2.0. Se
incorporó para D03 porque el catálogo de OpenAI solo ofrecía skills de diseño
dependientes de Figma. Sus criterios estéticos no prevalecen sobre la precisión
científica ni sobre las reglas de `apps/web/AGENTS.md`.

`.agents/skills.lock.json` registra origen, revisión y SHA-256 de los archivos
externos. Es un manifiesto de procedencia para revisión; los editores no lo
interpretan como gestor de paquetes ni verifican sus hashes automáticamente.
Los archivos de texto se normalizan a LF, como establece `.gitattributes`,
antes de calcular los hashes para que sean estables al clonar en otro sistema.
Ruff excluye solamente estas cuatro carpetas de terceros para no reformatear
código ajeno. Las skills propias se mantienen con el proyecto.

Actualizar de forma deliberada: revisar el diff de la nueva revisión, conservar
licencias y actualizar el manifiesto. No editar una skill vendorizada y seguir
afirmando que coincide exactamente con upstream. Las skills locales deben
validarse con el validador de skill-creator cuando se modifiquen.

## Referencias consultadas

- [Skills de Codex](https://learn.chatgpt.com/docs/build-skills)
- [AGENTS.md de Codex](https://learn.chatgpt.com/docs/agent-configuration/agents-md)
- [Skills de Cursor](https://cursor.com/docs/skills)
- [Reglas de Cursor](https://cursor.com/docs/rules)
- [Catálogo de OpenAI, revisión utilizada](https://github.com/openai/skills/tree/49f948faa9258a0c61caceaf225e179651397431/skills/.curated)
