export type DataNature = "observed" | "estimated" | "simulated" | "synthetic";

const NATURE: Record<DataNature, { label: string; description: string }> = {
  observed: {
    label: "Observación",
    description: "Medido por un sensor, sin interpolación ni predicción",
  },
  estimated: {
    label: "Estimación",
    description: "Calculado por un modelo validado, con incertidumbre",
  },
  simulated: {
    label: "Simulación",
    description: "Escenario hipotético, no una predicción ni una medición",
  },
  synthetic: {
    label: "Sintético",
    description: "Dato de prueba para desarrollo, no una medición",
  },
};

export function NatureBadge({
  nature,
  detailed = false,
}: {
  nature: DataNature;
  detailed?: boolean;
}) {
  const { label, description } = NATURE[nature];
  return (
    <span className={`nature nature-${nature}`}>
      <span className="nature-label">{label}</span>
      {detailed && <span className="nature-description">{description}</span>}
    </span>
  );
}
