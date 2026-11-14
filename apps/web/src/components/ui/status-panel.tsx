import type { ReactNode } from "react";

export type Status = "loading" | "empty" | "error" | "pending";

const KIND: Record<Status, string> = {
  loading: "Cargando",
  empty: "Sin datos",
  error: "Error",
  pending: "En preparación",
};

export function StatusPanel({
  status,
  title,
  children,
  action,
}: {
  status: Status;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section
      className={`status status-${status}`}
      role={status === "error" ? "alert" : "status"}
      aria-busy={status === "loading" || undefined}
    >
      <p className="status-kind">{KIND[status]}</p>
      <h2>{title}</h2>
      {children}
      {action && <div className="status-action">{action}</div>}
    </section>
  );
}
