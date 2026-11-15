"use client";

import Link from "next/link";
import { useCurrentPathname } from "../../lib/current-pathname";
import { SECTIONS } from "../../lib/navigation";
import { motion, useReducedMotion } from "motion/react";

export function NavLinks() {
  const pathname = useCurrentPathname();
  const reduced = useReducedMotion();
  return (
    <nav aria-label="Secciones">
      <ul className="nav">
        {SECTIONS.map((s, index) => {
          const current =
            pathname === s.href || (s.href !== "/" && pathname.startsWith(`${s.href}/`));
          return (
            <li
              key={s.href}
              className="nav-entry"
              style={{ animationDelay: `${120 + index * 70}ms` }}
            >
              <Link
                href={s.href}
                aria-current={current ? "page" : undefined}
                className={s.available ? undefined : "nav-pending"}
              >
                {current && (
                  <motion.span
                    aria-hidden="true"
                    className="nav-active-surface"
                    layoutId="active-section"
                    transition={
                      reduced ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 34 }
                    }
                  />
                )}
                {s.label}
                {!s.available && <span className="sr-only"> (en preparación)</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
