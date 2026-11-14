import type { TerritoryId, TerritoryOption } from "../lib/territory";
import { ServerDetail } from "./ui/server-detail";

export function TerritorySelector({
  options,
  value,
  onChange,
}: {
  options: TerritoryOption[];
  value: TerritoryId;
  onChange: (id: TerritoryId) => void;
}) {
  return (
    <fieldset className="panel territory-selector">
      <legend>Territorio</legend>
      {options.map((option) => {
        const inputId = `territorio-${option.id}`;
        const descriptionId = `${inputId}-descripcion`;
        return (
          <div
            key={option.id}
            className={
              option.available
                ? "territory-option"
                : "territory-option territory-option-pending"
            }
          >
            <input
              type="radio"
              id={inputId}
              name="territorio"
              value={option.id}
              checked={value === option.id}
              disabled={!option.available}
              aria-describedby={descriptionId}
              onChange={() => onChange(option.id)}
            />
            <div>
              <label htmlFor={inputId}>{option.label}</label>
              <p id={descriptionId}>
                {option.description}
                {option.pending && (
                  <span className="territory-pending">{option.pending}</span>
                )}
              </p>
              {!option.available && <ServerDetail reason={option.detail} />}
            </div>
          </div>
        );
      })}
    </fieldset>
  );
}
