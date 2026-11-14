import type { ReactNode } from "react";

/** Only http(s) URLs from the server become links; anything else stays as text. */
export function safeExternalUrl(value: string | null | undefined): URL | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

export function ExternalLink({ href, children }: { href: URL; children: ReactNode }) {
  return (
    <a href={href.href} target="_blank" rel="noopener noreferrer">
      {children}
      <span className="sr-only"> (se abre en una pestaña nueva)</span> ↗
    </a>
  );
}
