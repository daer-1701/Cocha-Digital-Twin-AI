"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SECTIONS } from "../../lib/navigation";

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav aria-label="Secciones">
      <ul className="nav">
        {SECTIONS.map((s) => (
          <li key={s.href}>
            <Link
              href={s.href}
              aria-current={pathname === s.href || (s.href !== "/" && pathname.startsWith(`${s.href}/`)) ? "page" : undefined}
              className={s.available ? undefined : "nav-pending"}
            >
              {s.label}
              {!s.available && <span className="sr-only"> (en preparación)</span>}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
