import type { ReactNode } from "react";

export function Panel({
  title,
  meta,
  className,
  children,
}: {
  title?: string;
  meta?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={className ? `panel ${className}` : "panel"}>
      {title && (
        <div className="panel-title">
          <h2>{title}</h2>
          {meta && <span>{meta}</span>}
        </div>
      )}
      {children}
    </section>
  );
}
