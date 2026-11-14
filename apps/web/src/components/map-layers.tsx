import type { components } from "@cocha/shared";
import { ServerDetail } from "./ui/server-detail";

type WmsLayer = components["schemas"]["WmsLayerAvailability"];

const LABELS: Record<string, { label: string; note?: string }> = {
  "Limite Urbano": { label: "Límite urbano" },
  "Cota 2750": {
    label: "Cota 2750 m",
    note: "Solo contexto. No es un modelo de elevación.",
  },
  "Áreas Verdes": { label: "Áreas verdes" },
  "Limite Distritos": {
    label: "Límites distritales",
    note: "Solo para orientarse. No permite calcular indicadores por distrito.",
  },
  "Población por Manzanas": { label: "Población por manzanas" },
};

export const layerLabel = (layer: WmsLayer) => LABELS[layer.name]?.label ?? layer.name;

/** GAMC reference images: context only, never Landsat results. */
export function MapLayers({
  layers,
  catalogError,
  active,
  failed,
  onToggle,
}: {
  layers: WmsLayer[];
  catalogError: boolean;
  active: string[];
  failed: string[];
  onToggle: (serviceId: string, on: boolean) => void;
}) {
  return (
    <fieldset className="map-layers">
      <legend>Capas municipales de contexto</legend>
      <p className="caption">
        Imágenes de referencia del Gobierno Autónomo Municipal de Cochabamba
        (servicio WMS). No son observaciones Landsat ni se usan para calcular
        indicadores. El servidor no informa la fecha de cada capa.
      </p>
      {catalogError ? (
        <p className="caption">
          No se pudo consultar qué capas ofrece el servidor. El mapa Landsat sigue
          disponible.
        </p>
      ) : layers.length === 0 ? (
        <p className="caption">El servidor no ofrece capas municipales.</p>
      ) : (
        layers.map((layer) => {
          const id = `capa-${layer.service_id}`;
          const available = layer.status === "available";
          const on = active.includes(layer.service_id);
          const broken = failed.includes(layer.service_id);
          const note = LABELS[layer.name]?.note;
          return (
            <div
              key={layer.service_id}
              className={available ? "territory-option" : "territory-option territory-option-pending"}
            >
              <input
                type="checkbox"
                id={id}
                checked={on}
                disabled={!available}
                aria-describedby={`${id}-nota`}
                onChange={(event) => onToggle(layer.service_id, event.target.checked)}
              />
              <div>
                <label htmlFor={id}>{layerLabel(layer)}</label>
                <p id={`${id}-nota`}>
                  {note}
                  {!available && (
                    <span className="territory-pending">
                      No disponible: el servidor no puede consultar el servicio municipal.
                    </span>
                  )}
                  {broken && (
                    <span className="territory-pending" role="status">
                      No se pudo cargar la imagen de esta capa.
                    </span>
                  )}
                </p>
                {!available && <ServerDetail reason={layer.reason} />}
                {on && !broken && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    className="wms-legend"
                    src={`/api/gamc/wms/legend?service_id=${layer.service_id}`}
                    alt={`Leyenda de la capa ${layerLabel(layer)}`}
                  />
                )}
              </div>
            </div>
          );
        })
      )}
    </fieldset>
  );
}
