/** Visual position of a published value on its scientific scale. Missing stays empty. */
export function SignalGauge({
  signal,
  value,
  min,
  max,
  unit = "",
}: {
  signal: "heat" | "vegetation" | "coverage";
  value: number | null | undefined;
  min: number;
  max: number;
  unit?: string;
}) {
  const missing = value == null || Number.isNaN(value);
  const span = max - min;
  const pct = missing || span === 0 ? null : Math.min(100, Math.max(0, ((value - min) / span) * 100));
  const minLabel = `${min}${unit}`;
  const maxLabel = `${max}${unit}`;
  return (
    <div
      className={`signal-gauge signal-${signal}`}
      role="img"
      aria-label={
        missing
          ? `Escala de ${minLabel} a ${maxLabel}: sin datos`
          : `Escala de ${minLabel} a ${maxLabel}: valor en ${pct?.toFixed(0)} por ciento del rango`
      }
    >
      <div className="signal-gauge-track">
        <span
          className="signal-gauge-fill"
          style={pct == null ? undefined : { width: `${pct}%` }}
          data-missing={pct == null || undefined}
        />
        {pct != null && (
          <span className="signal-gauge-marker" style={{ left: `${pct}%` }} />
        )}
      </div>
      <div className="signal-gauge-ends">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
    </div>
  );
}
