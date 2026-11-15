import type { TerritoryId, TerritoryOption } from "../lib/territory";
export function TerritorySelector({options,value,onChange}: {options:TerritoryOption[];value:TerritoryId;onChange:(id:TerritoryId)=>void}) {
 const selected=options.find(option=>option.id===value);
 return <div className="territory-select"><label htmlFor="territory-choice">Zona del mapa</label>
 <select id="territory-choice" value={value} onChange={event=>onChange(event.target.value as TerritoryId)}>
 {options.map(option=><option key={option.id} value={option.id} disabled={!option.available}>{option.label}{!option.available ? " · no disponible" : ""}</option>)}
 </select><p>{selected?.description}</p></div>;
}
