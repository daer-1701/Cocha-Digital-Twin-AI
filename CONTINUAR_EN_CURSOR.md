# Traspaso a Cursor — Cocha Digital Twin AI

Actualizado el **14 de noviembre de 2026**. Este documento permite continuar
sin leer el historial de Codex. El usuario pidió trabajar en las tareas de
**Andrés** y luego detener la ejecución para continuar en Cursor.

## 1. Qué hacer primero

1. Leer `AGENTS.md`, las reglas del área y este documento.
2. Ejecutar `git status --short` y revisar los cambios existentes. Hay trabajo
   **sin commit de A01**: conservarlo, no reconstruirlo desde cero.
3. Terminar la validación de A01 con `scripts/check_containers.ps1`.
4. Registrar el resultado en `docs/a01-validation.md` y actualizar el estado
   de A01 en `docs/team-plan.md` solo cuando corresponda.
5. Continuar A02/A03/A04/A08 según dependencias y disponibilidad de datos.

No hacer commit, push, merge, publicación o gasto API sin una solicitud que
lo incluya. No sobrescribir `.env` ni mostrar claves. No detener otros proyectos.

## 2. Documentos de referencia

| Documento | Contenido |
| --- | --- |
| `docs/team-plan.md` | Lista completa: 18 tareas de Andrés y 17 de Diego, con 35 prompts y dependencias |
| `docs/gamc-resources.md` | Recursos municipales verificados, archivos descargados y limitaciones |
| `data/catalog/gamc.json` | Catálogo sanitizado de capas GAMC y perfil inicial de MÓNICA |
| `docs/mvp.md` | Método, reproducción y limitaciones del piloto Landsat |
| `docs/architecture.md` | Arquitectura y decisiones vigentes |
| `docs/data-model.md` | Tablas actuales y entidades previstas |
| `docs/science.md` | Política científica y fuentes |
| `docs/a01-validation.md` | Procedimiento técnico A01; resultado global todavía pendiente |
| `docs/ai-workflow.md` | Skills y trabajo coordinado entre Codex y Cursor |
| `README.md` | Comandos de instalación, ejecución y pruebas |

## 3. Qué ya existe

### Repositorio y arquitectura

- Monorepo con npm workspaces y proyecto Python administrado con uv.
- `apps/web`: Next.js App Router, React, TypeScript y MapLibre.
- `services/api`: FastAPI, Pydantic, SQLAlchemy y GeoAlchemy2.
- PostgreSQL/PostGIS en Compose; Alembic con migración inicial `0001`.
- Tablas iniciales: `datasets` y `districts`. No asumir que tengan datos reales.
- `packages/shared/openapi.json` y `src/api.d.ts` generados desde FastAPI.
- Dockerfiles, GitHub Actions, Dependabot, reglas y documentación.
- Credenciales, datos crudos, resultados locales y dependencias excluidos de Git.

### Primer recorrido MVP real

- `scripts/ingest_landsat.py` obtiene escenas reales Landsat C2 L2 de Planetary
  Computer sin credenciales ni servicios facturables.
- Se descargaron ventanas pequeñas de julio de 2022, 2023 y 2024.
- Área piloto WGS84: `[-66.18, -17.41, -66.14, -17.37]`.
- Se aplican escalas/offset USGS y una máscara QA compartida para LST/NDVI.
- Cálculo puro: `services/api/src/cocha_api/science/landsat.py`.
- Se conservan recortes crudos, metadatos STAC y checksums en `data/raw/landsat-pilot/`.
- Resultado publicado: `data/processed/explorer.json`; manifiesto:
  `data/processed/landsat-manifest.json`. Son archivos locales ignorados por Git.
- API `/v1/explorer` valida el snapshot; devuelve estado vacío cuando falta
  y 503 sanitizado si es inválido.
- Dashboard con mapa, selector de adquisición/variable, medias, cobertura válida,
  gráfico descriptivo, tabla, procedencia y límites científicos.
- Mapa agregado a bloques de unos 360 m, sin inventar detalle térmico.
- Worker MapLibre servido desde la propia aplicación; generado por
  `scripts/prepare-map-assets.mjs` en predev/prebuild.
- Se comprobó previamente en navegador: cambios de fecha y variable, mapa NDVI
  y vista móvil de 390 px sin desbordamiento global.

**Este piloto no es una comparación distrital ni una tendencia climática.**
Una escena de julio por año no es una media anual. LST no es temperatura del aire.

### API actual

| Ruta | Función real |
| --- | --- |
| `/health/live` | Estado del proceso HTTP, independiente de DB |
| `/health/ready` | PostGIS y revisión Alembic; A01 añade coincidencia con el head vigente |
| `/v1/datasets` | Catálogo DB con paginación acotada |
| `/v1/explorer` | Snapshot validado del piloto |
| `/docs`, `/openapi.json` | Documentación y contrato |

No hay todavía API completa de estaciones, tendencias, modelos, jobs, escenarios,
informes o conversación Gemini. No inventar disponibilidad para completar pantallas.

## 4. Datos GAMC: descargados, todavía sin integrar

Fuente: https://recursosgamc.cochabamba.bo/api-doc

### Red MÓNICA

Descarga ya realizada y verificada:
`https://recursosgamc.cochabamba.bo/assets/geo/red_monica.zip`.

Ruta local: `data/raw/gamc/monica/`:

- `red_monica.zip`: original conservado.
- `red_monica.kanata (1).csv`: 54.711 registros.
- `red_monica.semapa (1).csv`: 71.154 registros.
- `manifest-<hash>.json`: procedencia, metadatos HTTP y SHA-256.

Campos: `estacion`, `pm10`, `fecha_medicion`. Los archivos contienen fechas de
2022 a octubre de 2026; eso no implica una serie continua ni datos actuales en vivo.

Hay **721 negativos** en Kanata y **1.499** en Semapa, además de ceros.
El perfil completo inicial está en `data/catalog/gamc.json`.
No truncar negativos a cero ni eliminar automáticamente los ceros. Conservar
originales, añadir flags y verificar el significado de los códigos.

Siguen pendientes: unidad PM10, zona horaria, coordenadas, elevación, instrumentos,
calidad y licencia de redistribución. Las fechas no tienen offset: no asumir UTC.
Los nombres Kanata/Semapa deben reconciliarse con las ubicaciones descritas por
el portal. No ubicar estaciones en el mapa por simple aproximación del nombre.

**Estos CSV son PM10, no temperatura del aire. No sirven como validación térmica
directa de LST. Dos estaciones tampoco garantizan interpolación validada para
15 distritos.** A08 debe limpiar/importar; A09 debe evaluar la viabilidad del modelo.

Para otro clon, o si faltan archivos:

```powershell
python scripts/download_gamc.py
```

Usa Python estándar, no Docker. Reutiliza archivos, verifica CRC y hashes y
rechaza sobrescrituras discrepantes. Ya se verificó su segunda ejecución.

### Límites distritales

Está identificado el WMS:
`https://serviciosgamc.cochabamba.bo/api/gs/wms`.

Servicio distrital: `7eb13092-bf0e-493b-aae6-03c43eedda2c`.
Otras capas: límite urbano, áreas verdes, población por manzanas y cota 2750.
IDs y BBOX documentados en el catálogo sanitizado, **sin claves**.

**No se obtuvo todavía un vector completo de los 15 distritos.** WMS/GetMap
devuelve imágenes; GetFeatureInfo no demuestra una descarga completa de polígonos.
Los BBOX no son geometrías distritales. No digitalizar el PNG ni asumir WFS.
El RAR de líneas de transporte anunciado en el portal no sustituye los límites.

A03 tiene dos entregas separadas:

1. Proxy WMS backend con clave de entorno, servicios permitidos, parámetros
   acotados, timeout, caché y logs/respuestas sin secretos.
2. Vector completo autorizado, con CRS, versión, licencia, IDs y validación
   geométrica, para importar a PostGIS y calcular estadísticas zonales.

No se ejecutaron solicitudes WMS autenticadas ni se integró un proxy todavía.
Si no hay credencial/fuente vectorial, documentar el bloqueo y continuar con
componentes independientes. No enviar mensajes a terceros automáticamente.

## 5. A01: cambios nuevos sin commit

El usuario autorizó empezar las tareas de Andrés. Se inició A01; **todavía no
está completada**, porque falta cerrar la validación integral de contenedores.

Cambios preparados:

- `compose.test.yaml`: stack aislado `cocha-a01-test`, sin puertos publicados,
  sin datos reales montados y con base `cocha_test` en tmpfs desechable.
- Stage `test` en `infrastructure/docker/api.Dockerfile`, con dependencias
  científicas y pruebas; el runtime de la API conserva dependencias mínimas.
- `scripts/check_containers.ps1`: construye API, runner y web secuencialmente;
  arranca el stack; ejecuta `alembic check`, pruebas HTTP/DB, comprobación de
  exclusión de NumPy/Rasterio y downgrade → upgrade → check en DB temporal.
  Limpia solo ese proyecto al terminar y muestra logs acotados ante fallos.
- `cocha_api/db/migrations.py`: obtiene la revisión Alembic esperada.
- `/health/ready`: ahora devuelve 503 si la revisión DB difiere del código.
- Pruebas nuevas de revisión vigente/obsoleta, geometría PostGIS y restricciones;
  una prueba HTTP verifica web standalone, estado vacío y worker MapLibre.
- Pruebas DB protegidas por `RUN_DB_TESTS=1` y nombre terminado en `_test`.
- Healthcheck PostgreSQL por TCP para no confundir servidor temporal de init
  con el arranque final. Ajustado en Compose y CI.
- CI usa `uv run --no-sync` después de instalar el entorno de ciencia, evitando
  quitar/reinstalar dependencias entre comandos; invoca el mismo chequeo aislado.
- `alembic.ini` añade `path_separator = os`.
- README evita sobrescribir `.env`/`.env.local`; documentación de salud actualizada.
- `.dockerignore` excluye capturas, outputs y worker generado del contexto fuente.

Revisar `git diff` y los archivos nuevos: `git diff --stat` no incluye los untracked.
No modificar migraciones existentes para acomodar cambios futuros de A04.

## 6. Qué se verificó y qué no

### Confirmado en esta sesión

- Docker Desktop está iniciado: engine 29.2.1, Compose 5.1.0.
- Ruff y formato de Python pasaron después de corregir los cambios.
- Lint y typecheck del frontend pasaron; no se cambió su funcionalidad en A01.
- OpenAPI guardado coincide con el backend actual; A01 no cambió su esquema público.
- La última ejecución local sobre el árbol final dio **17 passed, 3 skipped**.
  Se omitieron dos pruebas DB y una del stack por falta de sus flags/servicios.
  La advertencia restante procede de la transición httpx/httpx2 en Starlette.
  Ruff pasó y el formato indicó 53 archivos ya formateados.
- Sintaxis PowerShell del runner revisada y configuración Compose validada.
- **Imagen `cocha-api:a01-test` ejecutada con éxito**: importa la API, usuario
  UID 10001, sin NumPy ni Rasterio y revisión esperada `0001`.
- Aparecieron imágenes `cocha-api:local` y `cocha-a01-test-tests:latest` en Docker.
  Su existencia no demuestra que hayan pasado todas las pruebas.

### Pendiente: no afirmar validación completa

- Construcción final de la imagen web y arranque de todo `compose.test.yaml`.
- Pruebas de integración con PostGIS y detección de deriva mediante `alembic check`.
- Ciclo de downgrade/upgrade en la base exclusiva de pruebas.
- Prueba HTTP del worker MapLibre desde el contenedor standalone.
- Comprobación final de que se limpió el stack temporal.
- Ejecución del workflow en GitHub; solo se preparó/modificó su definición.

### Incidencias del entorno

Las primeras descargas y operaciones de escritura Docker resultaron muy lentas.
Se midieron unos 600 MB de RAM libre en Windows en un momento de la ejecución;
no se atribuye toda la demora a una causa única. C: tenía aproximadamente 10 GB
libres y D: unos 122 GB. Revisar recursos antes de relanzar construcciones grandes.

Se cambió de construcciones paralelas a secuenciales. La cancelación deliberada
del primer intento produjo un código de salida de fallo: **no fue evidencia
de un fallo funcional de la aplicación**. La segunda ejecución tampoco llegó
a validar el stack antes del traspaso.

Se detuvo el cliente de build de Cocha para el traspaso y el script terminó su
limpieza. La descarga independiente de PostGIS falló con:

```text
short read: expected 105457953 bytes but got 81094066: unexpected EOF
```

No existe todavía la imagen completa `postgis/postgis:17-3.5`. Reintentar la
descarga al retomar; no interpretar el EOF de transferencia como un fallo de
migraciones, que aún no se ejecutaron contra PostGIS en esta sesión.

En la última consulta no quedaron contenedores del proyecto temporal ni clientes
Docker de build/pull de esta tarea. Cursor debe comprobarlo de nuevo antes de
continuar. Las imágenes/capas cacheadas se conservan; no ejecutar prune global.

El servidor Next.js de la demo anterior se cerró para liberar recursos.
Reabrirlo con `npm run dev` cuando sea necesario; no asumir que el puerto 3000
continúa atendiendo. No se detuvieron los otros proyectos Docker activos.

## 7. Cómo retomar A01

Desde la raíz en PowerShell, con Docker Linux disponible:

```powershell
git status --short
docker compose --env-file .env.example -f compose.test.yaml ps -a
./scripts/check_containers.ps1
```

El runner utiliza el proyecto fijo `cocha-a01-test`: no ejecutar dos copias
simultáneas. Si quedó un intento previo, revisar primero su estado. La limpieza
de ese proyecto de pruebas es:

```powershell
docker compose --env-file .env.example -f compose.test.yaml -p cocha-a01-test down --remove-orphans
```

No aplicar ese comando a otro proyecto ni usar `down -v` sobre la base de desarrollo.
No hay necesidad de usar credenciales reales en la validación A01.

Checks de código, con dependencias instaladas:

```powershell
uv sync --frozen --group science
uv run --no-sync ruff check .
uv run --no-sync ruff format --check .
uv run --no-sync pytest -q
npm ci
npm run lint
npm run typecheck
```

Ruff mostró problemas para escribir su caché en una ejecución concurrente;
si se repite, usar `ruff check --no-cache .` y `ruff format --check --no-cache .`.
No lanzar instalaciones simultáneas sobre la misma `.venv` o `node_modules`.

Para regenerar contratos solo si se cambian esquemas/rutas públicas:

```powershell
uv run python scripts/export_openapi.py
npm run contracts:generate
```

## 8. Todo lo que falta a nivel de producto

El desglose exhaustivo y los prompts están en `docs/team-plan.md`; esta es
la situación de los siete módulos principales:

| Módulo | Existe | Falta |
| --- | --- | --- |
| Dashboard | Piloto LST/NDVI, mapa y tabla | Distritos oficiales, filtros territoriales completos, comparaciones e integración municipal |
| Motor GIS | Ingesta pequeña y snapshots | Vector oficial, serie extensa, QA avanzado, agregación por distrito, persistencia y jobs |
| Ciencia | Conversión de bandas y medias descriptivas | Tendencias, estacionalidad, intervalos, autocorrelación, significancia y multiplicidad |
| ML | Nada entrenado/validado | Objetivo compatible, fusión, baseline, folds bloqueados, modelos, incertidumbre y registro |
| Gemelo territorial | Mapa 2D piloto | Capas reales completas y actualización reproducible; 3D opcional |
| Escenarios | Sin implementar | Modelo defendible, supuestos, límites, API y UI claramente hipotética |
| Gemini | Solo configuración reservada | Adaptador backend, evidencia/citas, caché, cuotas, reserva atómica de gasto y UI |

Además faltan persistencia científica A04, ingesta MÓNICA A08, exportaciones e
informes A15, seguridad A16, validación integral A17 y operación/despliegue A18.
No todas las dependencias externas están resueltas: un estado vacío o adaptador
preparado no permite marcar integración científica completada.

## 9. Reparto para continuar sin conflictos

**Cursor en esta continuación debe tomar el rol de Andrés**: backend, GIS,
ciencia, persistencia, pruebas, seguridad e infraestructura.

Diego conserva frontend/UX/mapas/gráficos/pruebas de navegador/documentación,
sin necesidad de Docker. D02 aún debe crear el servidor Node de fixtures y el
comando `dev:fixtures`; no asumir que ya existen. Las fixtures deben llevar
etiqueta DEMO y no reemplazar datos reales silenciosamente.

Andrés genera Pydantic/OpenAPI/tipos. Diego los consume. Coordinar los cambios
de `package-lock.json`, contratos y documentación compartida. No editar archivos
simultáneamente desde ambos agentes.

## 10. Prompt listo para pegar en Cursor

```text
Continúa Cocha Digital Twin AI como Andrés. Lee CONTINUAR_EN_CURSOR.md,
AGENTS.md y docs/team-plan.md; inspecciona Git antes de editar y conserva los
cambios existentes sin commit. Empieza terminando A01, no recreando el proyecto.
Comprueba que no queden builds anteriores de Cocha y ejecuta la validación
aislada de scripts/check_containers.ps1. Usa únicamente la DB temporal de pruebas;
no detengas otros proyectos ni sobrescribas .env. Registra qué pasó realmente.
Después avanza A02/A03/A04/A08 según sus dependencias, usando el catálogo GAMC
y los CSV locales ya descargados. Los límites WMS no son un vector completo;
MÓNICA es PM10 con metadatos pendientes, no temperatura del aire.
Mantén a Diego sin Docker y coordina contratos sin editar su frontend en paralelo.
Usa las skills pertinentes del repositorio. No inventes resultados ni declares
validaciones omitidas como exitosas. No hagas commit, push, despliegue ni llamadas
de pago sin autorización del alcance correspondiente.
```
