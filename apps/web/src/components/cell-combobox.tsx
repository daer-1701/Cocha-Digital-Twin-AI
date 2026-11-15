"use client";
import { useId, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

type Option = { value: number; label: string };
export function CellCombobox({ options, value, disabled, onSelect }: {
  options: Option[]; value: number | null; disabled: boolean;
  onSelect: (value: number | null) => void;
}) {
  const id = useId();
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
  const filtered = options.filter(option => normalize(option.label).includes(normalize(query.trim())));
  const current = Math.min(active, Math.max(0, filtered.length - 1));
  function choose(next: number | null) { onSelect(next); setOpen(false); setQuery(""); }
  return <div className="cell-combobox" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) { setOpen(false); setQuery(""); } }}>
    <input role="combobox" aria-label="Buscar y seleccionar distrito" aria-expanded={open && !disabled}
      aria-controls={`${id}-list`} aria-autocomplete="list"
      aria-activedescendant={open && filtered.length ? `${id}-${filtered[current].value}` : undefined}
      disabled={disabled} value={open ? query : options.find(option => option.value === value)?.label ?? ""}
      placeholder="Buscar distrito por nombre…" onFocus={() => { setOpen(true); setActive(0); }}
      onChange={event => { setQuery(event.target.value); setActive(0); setOpen(true); }}
      onKeyDown={event => {
        if (event.key === "Escape") { event.stopPropagation(); setOpen(false); setQuery(""); }
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault(); setOpen(true);
          setActive(Math.max(0, Math.min(filtered.length - 1, current + (event.key === "ArrowDown" ? 1 : -1))));
        }
        if (event.key === "Enter" && open && filtered[current]) { event.preventDefault(); choose(filtered[current].value); }
      }} />
    <AnimatePresence>{open && !disabled && <motion.div className="cell-options-panel" key="options"
      initial={reduced ? false : { opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduced ? 0 : -4 }} transition={{ duration: reduced ? 0 : .18 }}>
      <div role="listbox" id={`${id}-list`} aria-label="Distritos oficiales">
        {filtered.map((option,index) => <div role="option" id={`${id}-${option.value}`} key={option.value}
          aria-selected={value === option.value} data-active={index === current}
          onPointerMove={() => setActive(index)} onPointerDown={event => event.preventDefault()}
          onClick={() => choose(option.value)}>{option.label}</div>)}
      </div>
      {!filtered.length && <p role="status">No hay distritos que coincidan.</p>}
      {value !== null && <button type="button" onPointerDown={event => event.preventDefault()} onClick={() => choose(null)}>Quitar selección</button>}
    </motion.div>}</AnimatePresence>
  </div>;
}
