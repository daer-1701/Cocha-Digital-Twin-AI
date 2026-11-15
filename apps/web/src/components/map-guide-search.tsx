"use client";

import { CellCombobox } from "./cell-combobox";

type Props = {
  districts: { name: string }[];
  selectedIndex: number | null;
  disabled: boolean;
  onSelectDistrict: (index: number | null) => void;
};

/** Distrito picker arriba del mapa (sin buscador de IA). */
export function MapGuideSearch({
  districts,
  selectedIndex,
  disabled,
  onSelectDistrict,
}: Props) {
  return (
    <div className="map-guide-search">
      <CellCombobox
        value={selectedIndex}
        options={districts.map((district, index) => ({
          value: index,
          label: district.name,
        }))}
        disabled={disabled || districts.length === 0}
        onSelect={onSelectDistrict}
      />
    </div>
  );
}
