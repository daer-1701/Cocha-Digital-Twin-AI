"use client";

import Link from "next/link";
import { useCurrentPathname } from "../../lib/current-pathname";
import { SECTIONS, type Section } from "../../lib/navigation";

function sectionPath(href: string) {
  const path = href.split("?")[0] ?? href;
  return path.length > 0 ? path : "/";
}

const primaryPaths = new Set(["/", "/analisis", "/comparar", "/estaciones", "/informes"]);
const primary = SECTIONS.filter((section) => primaryPaths.has(sectionPath(section.href)));
const secondary = SECTIONS.filter((section) => !primaryPaths.has(sectionPath(section.href)));

export function NavLinks() {
  const pathname = useCurrentPathname();
  const entry = (section: Section) => {
    const path = sectionPath(section.href);
    const current =
      pathname === path || (path !== "/" && pathname.startsWith(`${path}/`));
    return (
    <Link
      key={section.href}
      href={section.href}
      aria-current={current ? "page" : undefined}
    >
      {section.label}
      {!section.available && <span className="nav-state">En preparación</span>}
    </Link>
    );
  };
  return (
    <nav aria-label="Secciones" className="workspace-nav">
      <div className="nav-primary">{primary.map(entry)}</div>
      <details className="nav-more" key={pathname}>
        <summary>Herramientas</summary>
        <div>{secondary.map(entry)}</div>
      </details>
    </nav>
  );
}
