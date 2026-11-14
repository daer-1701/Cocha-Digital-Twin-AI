import type { ReactNode } from "react";

/** A null value renders "Sin datos" and hides the unit; missing data is never zero. */
export function Metric({
  label,
  value,
  unit,
  digits = 2,
  children,
}: {
  label: string;
  value: number | null | undefined;
  unit?: string;
  digits?: number;
  children?: ReactNode;
}) {
  const missing = value == null;
  return (
    <article className="metric">
      <p className="metric-label">{label}</p>
      <p className={missing ? "metric-value metric-missing" : "metric-value"}>
        {missing ? "Sin datos" : value.toFixed(digits)}
        {!missing && unit && <small> {unit}</small>}
      </p>
      {children && <p className="metric-note">{children}</p>}
    </article>
  );
}
