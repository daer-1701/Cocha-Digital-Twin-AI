"use client";

import Link from "next/link";
import { useId, useMemo, useState, useTransition } from "react";
import { askProjectQuestion, type ExplainResult } from "../app/map-actions";
import {
  defaultGuideSuggestions,
  matchProjectGuide,
  type GuideAction,
  type GuideHit,
} from "../lib/project-guide";
import { CellCombobox } from "./cell-combobox";

type Props = {
  districts: { name: string }[];
  selectedIndex: number | null;
  disabled: boolean;
  onSelectDistrict: (index: number | null) => void;
  onGuideAction?: (action: GuideAction) => void;
};

export function MapGuideSearch({
  districts,
  selectedIndex,
  disabled,
  onSelectDistrict,
  onGuideAction,
}: Props) {
  const formId = useId();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<GuideHit[]>([]);
  const [open, setOpen] = useState(false);
  const [ai, setAi] = useState<ExplainResult | null>(null);
  const [pending, startTransition] = useTransition();
  const chips = useMemo(() => defaultGuideSuggestions(), []);

  function runLocal(nextQuery: string) {
    setAi(null);
    setHits(matchProjectGuide(nextQuery));
    setOpen(true);
  }

  function handleAction(action: GuideAction) {
    if (action.href) return;
    onGuideAction?.(action);
    if (action.intent === "pick-district") {
      runLocal("distritos");
    } else if (action.intent === "climate") {
      runLocal("microclima");
    } else {
      runLocal(action.label);
    }
  }

  return (
    <div className={`map-guide-search${open ? " is-open" : ""}`}>
      <div className="map-guide-row">
        <CellCombobox
          value={selectedIndex}
          options={districts.map((district, index) => ({
            value: index,
            label: district.name,
          }))}
          disabled={disabled || districts.length === 0}
          onSelect={onSelectDistrict}
        />
        <form
          className="map-guide-form"
          aria-labelledby={`${formId}-label`}
          onSubmit={(event) => {
            event.preventDefault();
            runLocal(query);
          }}
        >
          <label id={`${formId}-label`} className="sr-only" htmlFor={`${formId}-q`}>
            Preguntas sobre el proyecto
          </label>
          <input
            id={`${formId}-q`}
            type="search"
            value={query}
            disabled={disabled}
            placeholder="¿Qué puedo hacer aquí?"
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => {
              if (hits.length || ai) setOpen(true);
            }}
            autoComplete="off"
          />
          <button type="submit" disabled={disabled || !query.trim()}>
            Buscar
          </button>
          <button
            type="button"
            disabled={disabled || pending || !query.trim()}
            onClick={() => {
              startTransition(async () => {
                const result = await askProjectQuestion(query.trim());
                setAi(result);
                setOpen(true);
              });
            }}
          >
            {pending ? "IA…" : "IA"}
          </button>
        </form>
      </div>

      <div className="map-guide-chips" role="list" aria-label="Sugerencias">
        {chips.map((action) =>
          action.href ? (
            <Link key={action.id} href={action.href} role="listitem" className="map-guide-chip">
              {action.label}
            </Link>
          ) : (
            <button
              key={action.id}
              type="button"
              role="listitem"
              className="map-guide-chip"
              disabled={disabled}
              onClick={() => handleAction(action)}
            >
              {action.label}
            </button>
          ),
        )}
      </div>

      {open && (hits.length > 0 || ai) && (
        <div className="map-guide-results" aria-live="polite">
          <div className="map-guide-results-head">
            <strong>Guía</strong>
            <button type="button" onClick={() => setOpen(false)}>
              Cerrar
            </button>
          </div>
          {hits.map((hit) => (
            <article key={hit.id} className="map-guide-hit">
              <strong>{hit.title}</strong>
              <p>{hit.answer}</p>
              {hit.suggestions.length > 0 && (
                <div className="map-guide-hit-actions">
                  {hit.suggestions.map((action) =>
                    action.href ? (
                      <Link key={action.id} href={action.href}>
                        {action.label}
                      </Link>
                    ) : (
                      <button
                        key={action.id}
                        type="button"
                        disabled={disabled}
                        onClick={() => handleAction(action)}
                      >
                        {action.label}
                      </button>
                    ),
                  )}
                </div>
              )}
            </article>
          ))}
          {ai && (
            <article className="map-guide-hit is-ai" role="status">
              <strong>Respuesta con evidencia (IA)</strong>
              <p>{ai.message}</p>
              {ai.answer && <p style={{ whiteSpace: "pre-wrap" }}>{ai.answer}</p>}
              {(ai.spent_usd != null || ai.model) && (
                <small>
                  {ai.model ? `Modelo ${ai.model}. ` : ""}
                  {ai.spent_usd != null
                    ? `Gasto acumulado en ledger: USD ${ai.spent_usd.toFixed(4)}.`
                    : ""}
                </small>
              )}
            </article>
          )}
        </div>
      )}
    </div>
  );
}
