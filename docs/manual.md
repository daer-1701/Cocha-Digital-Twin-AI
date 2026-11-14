# Manual de uso y guion de demostración (D16)

Versión del 14/11/2026. Describe la web tal como está en el código. Antes de
presentar, revisar `docs/team-plan.md` y `docs/a17-checklist.md`: la validación
integral (A17) **todavía no se ejecutó completa**, así que nada de este manual
debe presentarse como resultado validado de Cochabamba.

## Qué es y qué no es

Cocha Digital Twin AI muestra evidencia ambiental reproducible: temperatura de
la superficie terrestre (LST) y vegetación (NDVI) de Landsat sobre una ventana
urbana de estudio de unos 4 × 4 km, con su cobertura, procedencia y límites.

No es todavía un gemelo digital validado. No tiene límites distritales
verificados, tendencias inferenciales, modelos de estimación, escenarios ni
asistente con llamadas reales.

| Estado | Qué incluye |
| --- | --- |
| **Implementado y probado con datos reales** | Ingesta Landsat (STAC → QA → snapshot) y explorador en el MVP previo; ver `docs/mvp.md` |
| **Implementado, probado solo con fixtures sintéticas** | Capas WMS municipales por proxy, comparación de dos fechas, pendiente descriptiva del piloto, fichas MÓNICA, informes CSV/JSON, estado del asistente; 45 pruebas de navegador |
| **Bloqueado o planificado** | Comparar distritos (falta vector oficial), series PM10, estimaciones ML (no viables con los datos actuales), escenarios, asistente Gemini con llamadas, 3D (descartado por ahora) |

## Manual de uso

### Explorador (`/`)

1. **Territorio.** Hoy solo está disponible la ventana piloto. «Distritos con
   análisis» aparece deshabilitado con el motivo del servidor.
2. **Fecha de adquisición.** Cada fecha es una escena Landsat de julio. Los
   valores son de ese día y esa hora de paso, no promedios mensuales.
3. **Comparar con.** Añade una tabla con la diferencia entre dos fechas. Es una
   descripción: puede deberse al clima del día, no indica una tendencia.
4. **Variable.** LST en °C (superficie, **no** temperatura del aire) o NDVI
   (sin unidad, de −1 a 1). El mapa usa escalas fijas: 0–50 °C y −1 a 1.
5. **Copiar enlace.** La URL guarda territorio, fechas y variable.
6. **Capas municipales.** Imágenes de referencia del GAMC (límite urbano, áreas
   verdes, etc.). Solo sirven para orientarse; no se usan para calcular nada.
7. **¿Hay una tendencia?** Por distrito, no. Para la ventana piloto se muestra
   una pendiente descriptiva por escena, con cuántas fechas tienen valor. No es
   una tendencia climática ni tiene significancia.
8. **Calidad y procedencia.** Revisar siempre la cobertura válida. Si es menor
   al 70 % aparece un aviso; las celdas sin datos se ven como huecos y en la
   tabla como «Sin datos», nunca como cero.

### Estaciones (`/estaciones`)

Fichas de las estaciones MÓNICA de PM10 con la dirección descrita, la unidad
(µg/m³, declarada a partir de informes de la Red MoniCA) y los metadatos que
faltan: zona horaria, coordenadas, códigos de calidad y licencia. No hay series
ni marcadores en el mapa hasta confirmarlos. El PM10 mide partículas en el
aire: no es temperatura y no valida la LST.

### Informes (`/informes`)

Elegir «Resumen por escena» (todas o una) o «Celdas de una escena» y descargar
CSV o JSON. Los archivos incluyen fuente, versión, licencia, unidades, período,
fecha del snapshot, fecha de descarga y limitaciones. Los faltantes quedan
vacíos. Es la exportación de la ventana piloto, no un informe distrital.

### Secciones en preparación

`/comparar`, `/modelos`, `/escenarios` y `/asistente` explican qué falta para
mostrar resultados. No muestran valores de ejemplo. El asistente informa el
presupuesto (USD 4), si los precios se verificaron y que las llamadas están
desactivadas.

### Si ve la franja «Demo»

La web está conectada al servidor de datos sintéticos de desarrollo. Esos
valores son inventados por fórmula y **no deben aparecer en capturas,
presentaciones ni análisis como evidencia**.

## Guion de demostración (8–10 minutos)

**Preparación (antes del día):**

```powershell
uv sync --frozen --group science
uv run --group science python scripts/ingest_landsat.py   # requiere Internet
uv run uvicorn cocha_api.main:app --no-access-log          # terminal 1
npm ci; npm run build; npm run start -w @cocha/web         # terminal 2
```

Comprobar que no aparece la franja «Demo» y que el explorador muestra tres
fechas con fuente Landsat. Guardar una copia de `data/processed/` (snapshot y
manifiesto) para el plan B.

**Recorrido:**

1. *Problema (1 min).* Cochabamba necesita evidencia ambiental trazable; las
   cifras sin fuente ni cobertura no sirven para decidir.
2. *Datos y método (2 min).* En el explorador: escena, plataforma y cobertura
   válida. Abrir «Procedencia»: colección Landsat C2 L2, máscaras QA, celdas de
   unos 360 m. Recalcar que LST no es temperatura del aire.
3. *Hallazgo descriptivo (2 min).* Cambiar de fecha y usar «Comparar con».
   Leer la diferencia y el aviso: tres fechas de julio no son una tendencia.
   Mostrar la pendiente del piloto con su conteo de escenas.
4. *Contexto municipal (1 min).* Activar «Áreas verdes» o «Límite urbano»
   (requiere la clave WMS en el servidor y conexión al GAMC).
5. *Trazabilidad (1 min).* Copiar el enlace de la vista y descargar el CSV
   desde «Descargar los datos de esta fecha»; abrirlo y mostrar el encabezado.
6. *Límites (1 min).* Mostrar `/comparar` y `/modelos`: el sistema dice qué
   falta (vector distrital, viabilidad ML) en lugar de inventar resultados.
7. *Innovación (1 min).* Separación visible entre observación, estimación,
   simulación y dato sintético; ausencia de datos como estado válido.

**Preguntas probables:** por qué no hay tendencias (serie corta, estacionalidad
y autocorrelación sin tratar); por qué no ML (PM10 no es una variable objetivo
compatible con LST; ver `docs/ml-viability.md`); qué es la ventana (un
rectángulo de estudio, no un distrito).

## Plan B sin Internet

- **API y snapshot locales:** con `data/processed/explorer.json` ya generado, la
  API sirve el explorador sin red. Indicadores, tabla, gráfico, procedencia e
  informes funcionan. El mapa base de OpenStreetMap y las capas WMS no cargan;
  decirlo y apoyarse en la tabla y el gráfico.
- **Sin snapshot real:** usar las fixtures (`npm run dev:fixtures` y
  `API_INTERNAL_URL=http://127.0.0.1:8100`) **solo para mostrar el
  funcionamiento de la interfaz**, con la franja «Demo» visible y diciéndolo
  en voz alta. No presentar esos valores como Cochabamba.
- **Capturas:** solo de una sesión con datos reales y sin franja «Demo».

## Pendiente para cerrar D16

- Capturas verificadas de un caso real local: en esta máquina no hay snapshot
  Landsat generado (`data/processed/` vacío) y no se incluyen capturas
  sintéticas como resultado.
- Actualizar el estado con los resultados de A17 cuando se ejecute.
- Verificar requisitos y formato de entrega vigentes del reto en su
  documentación oficial antes de preparar la publicación o diapositivas.
