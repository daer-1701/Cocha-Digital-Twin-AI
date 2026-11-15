"use client";

import { motion, useReducedMotion } from "motion/react";
import type { Variable } from "../lib/filters";

const OPTIONS: { id: Variable; label: string }[] = [
  { id: "lst", label: "Temperatura" },
  { id: "ndvi", label: "Vegetación" },
];

/** Two-option selector with a sliding indicator (180–240 ms). */
export function VariableSwitch({
  value,
  onChange,
  id = "variable-switch",
}: {
  value: Variable;
  onChange: (next: Variable) => void;
  id?: string;
}) {
  const reduced = useReducedMotion();
  return (
    <div className="variable-switch" role="group" aria-label="Variable del mapa" id={id}>
      <motion.span
        className="variable-switch-indicator"
        aria-hidden="true"
        animate={{ left: value === "lst" ? 3 : "calc(50% + 1px)" }}
        transition={
          reduced
            ? { duration: 0 }
            : { type: "spring", stiffness: 420, damping: 36, mass: 0.7 }
        }
      />
      {OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={value === option.id}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
