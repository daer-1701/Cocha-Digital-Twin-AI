# Correcciones de la revisión — 14/11/2026

## Alcance

Correcciones locales de la importación MÓNICA, comparación demo, presupuesto
y documentación. No se habilitan APIs de pago ni se inventan límites oficiales.

| Problema | Comportamiento corregido | Regresión |
| --- | --- | --- |
| Importación fallida guardaba datos parciales | Transacción de datos completa y auditoría del fallo en sesión independiente | Archivo ausente después del primero y error SQL real en PostGIS |
| Duplicados reemplazaban observaciones válidas | Primera fila canónica; duplicados excluidos y claves existentes conservadas con su procedencia | Fechas equivalentes, valores contradictorios y reimportación |
| Comparación truncada y primera escena implícita | Una adquisición antes de paginar, última fecha por defecto y selector explícito; hasta 30 indicadores por escena | 15 rectángulos × 3 escenas desordenadas; paginación y fecha inexistente; navegación entre fechas |
| Ledger solo sincronizado dentro de una instancia | Bloqueo de archivo estable y recarga bajo bloqueo en Windows/Linux | Procesos simultáneos, instancias desactualizadas y conciliación idempotente |

El ledger en archivo requiere el mismo disco y ruta compartidos. Su modo en
memoria sigue limitado a una instancia. Varios hosts requieren un almacén
transaccional central antes de habilitar llamadas reales. Una actualización
de observaciones ya importadas requiere revisión explícita del proveedor;
no se modificaron datos de desarrollo durante esta corrección.

El target de pruebas Docker incluye ahora scripts, el ejecutor local y los
fixtures geográficos que usa la suite actual. Esos recursos no se añaden al
runtime de producción. No cambió el esquema de la base de datos.

## Validación

La ejecución de validación quedó interrumpida. Posteriormente el usuario pidió
mejorar frontend/backend **sin ejecutar pruebas**; las nuevas interacciones 3D,
línea temporal y caché de snapshots quedan pendientes de validación. No tomar
resultados parciales anteriores como aprobación del estado actual.

Validación web retomada el 14/11/2026 (Julio, sin Docker) sobre `9bbbe8f`:
lint, tipos y build correctos; Playwright con 108 pruebas que pasan y 7
incidencias abiertas como `test.fixme`. Cubre también la revisión MÓNICA, el
historial de procesamiento, la lectura guiada y la interacción 3D, siempre con
fixtures. Detalle en [informe de QA](qa-report.md). Las pruebas Python,
científicas, de migraciones y de contenedores siguen pendientes para este estado.

Comandos para ejecutar cuando el usuario retome la validación:

Ampliación posterior: rutas de revisión de registros MÓNICA (desactivadas por
defecto), historial de procesamiento con paginación, lectura guiada sin IA y
respaldo/restauración local. Contratos regenerados; no se ejecutaron pruebas ni
operaciones de respaldo/restauración. Estado de cierre en `release-status.md`.

```powershell
uv run --group science pytest -q
uv run ruff check .
uv run ruff format --check .
uv run python scripts/export_openapi.py
npm run contracts:generate
npm run lint
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e -w @cocha/web
./scripts/check_containers.ps1
```

Sin `RUN_DB_TESTS=1`, pytest omite las pruebas con PostGIS. El script de
contenedores usa `cocha_test` en tmpfs, sin puertos publicados ni volúmenes
de desarrollo, comprueba Alembic y restaura su stack al terminar. Playwright
usa fixtures sintéticas en 8110 y la web en 3110. Ninguna de estas pruebas
comprueba disponibilidad actual del GAMC ni consume Gemini.

## Pendientes del producto

Metadatos y validación MÓNICA; cobertura multitemporal municipal completa;
inferencia, ML y escenarios validados; orquestación distribuida; despliegue y
restauración de backups. Ver `team-plan.md` y `andres-blockers.md`.

### Series distritales oficiales — 15/11/2026

Se ejecutó el lote local
`ingest_landsat.py --replay-manifest … --district-version gamc-official-20261114`
y se aceptaron 90 filas (`area_weighted_mean_shared_qa`, LST/NDVI × 15 distritos ×
3 escenas julio 2022–2024). La cobertura (`valid_fraction`) usa el área completa
del polígono oficial frente a la ventana piloto Landsat: varios distritos tienen
cobertura baja o nula y valores nulos. Aceptación local etiquetada
`local-zonal-replay-20261115`; la revisión científica formal de Mateo (MF04)
sigue pendiente. El asistente puede adjuntar esa serie aceptada cuando la
petición incluye `district_number` y `boundary_version`.


## Reorganización y rendimiento — 15/11/2026

- Navegación principal: explorador, análisis, distritos, estaciones e informes;
  procesamiento y funciones en preparación se agrupan en Herramientas.
- Controles de zona y fechas antes del mapa. Lectura lateral de LST, NDVI y
  cobertura; color por celda en escala fija, faltantes transparentes. El piloto
  es la zona inicial. Relieve 3D optativo; selección disponible en 2D.
- Se retiran el fondo de partículas y el controlador global de animación/scroll.
  La portada deja de pedir series y tendencias que no representaba; esos datos
  se consultan en distritos. El paquete local se valida y cachea por revisión de
  todos sus archivos, conservando el fallo explícito si se corrompe.
- Distritos incorpora paginación de indicadores y selección de versión; modelos
  muestra registros aceptados. No se entrenaron ni publicaron modelos nuevos.
- Importación oficial conserva anillos interiores y rechaza coordenadas no
  finitas. Esto no repara automáticamente geometrías ya importadas; requieren
  revisión del original y nueva importación controlada.
- Evidencia corrupta responde con error sanitizado también en consumidores de
  dominio. Las tarifas Gemini caducan; la reserva toma el mayor entre el importe
  configurado y una cota conservadora de tokens. Las llamadas siguen apagadas.

La validación visual usa el build local y el paquete de doce adquisiciones.
Las pruebas PostGIS requieren una base aislada; no se ejecutan sobre desarrollo.
El informe QA anterior corresponde a la interfaz anterior: sus selectores y
suposiciones de arranque 3D deben actualizarse antes de usarlo como aceptación
integral de este rediseño.


### Mapa para presentación

- Dentro del mapa: fecha, referencia, variable, intensidad y modos Valores / Diferencias.
  Los controles se conservan en pantalla completa, con entrada inmediata.
- Diferencia = fecha del mapa menos fecha de referencia, emparejando celdas por
  sus límites publicados. Solo se dibujan pares con valores válidos. Es una
  diferencia descriptiva de agregados: el soporte de píxeles válidos puede cambiar;
  no demuestra tendencia ni causalidad.
- Leyenda fija divergente de −5 a +5 °C o −0,25 a +0,25 NDVI. Los extremos se
  saturan; la leyenda muestra el rango real sin recortarlo y el número de celdas.
- Opacidad actualiza solo la pintura de MapLibre; no reconstruye geometrías.
  Cambiar fechas o variable reutiliza fuentes y mapa. Sombreado de relieve solo
  en 3D. Sin nuevas peticiones científicas, dependencias ni descargas de escenas.


Validación local: 39 pruebas de mapa y accesibilidad aprobadas; las 13 pruebas
del mapa se repitieron satisfactoriamente después del ajuste de presentación.
Compilación, lint y tipos verificados. Backend: 110 pruebas aprobadas y 13
omitidas por requerir integración; no se validó PostGIS en esta sesión.
Captura de revisión: `output/playwright/mapa-presentacion.png`.
La suite E2E histórica completa sigue pendiente de actualización de selectores
para la nueva navegación; no se declara aprobada en su totalidad.


### Clima y presentación

Introducción cinematográfica restablecida en 3D, con omisión y repetición;
movimiento reducido conserva 2D. Panel meteorológico dentro del mapa y de
pantalla completa: Open-Meteo para el punto -17.3895, -66.1568, hora de Bolivia,
caché de diez minutos y timeout. Estimaciones de modelo, no sensores por celda
ni meteorología de la adquisición Landsat histórica. API verificada con HTTP 200.
La lectura meteorológica por reglas se identifica sin IA generativa. El botón
IA consulta el endpoint existente /v1/assistant/ask desde servidor, conservando
cuotas y reserva central; no habilita automáticamente llamadas ni expone tokens.
Su contexto es la evidencia publicada del backend, no necesariamente la fecha
seleccionada ni el paquete local de doce escenas. No se efectuaron llamadas pagadas.
El helper E2E selecciona 2D explícitamente tras la introducción para probar las
interacciones planas. No se repitió toda la suite en este cambio. En navegador
se verificaron carga meteorológica, repetición y omisión de la introducción.
