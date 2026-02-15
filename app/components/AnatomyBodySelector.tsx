"use client";

import { useState, useEffect } from "react";
import { BODY_ZONES } from "@/types/body-zones";

interface BodyChartProps {
  onSelect?: (selectedIds: string[]) => void;
  initialSelected?: string[];
  allowedZones?: string[]; // Prop for filtering global ZONES
  customZones?: typeof BODY_ZONES; // New prop for completely custom zones
}

export default function AnatomyBodySelector({
  onSelect,
  initialSelected = [],
  allowedZones,
  customZones,
}: BodyChartProps) {
  const [selected, setSelected] = useState<string[]>(initialSelected);

  // Synchronize internal state with props when initialSelected changes
  useEffect(() => {
    setSelected(initialSelected);
  }, [initialSelected]);

  const [hovered, setHovered] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent) => {
    // Relatywna pozycja względem viewportu (dla fixed tooltipa)
    setMousePos({ x: e.clientX, y: e.clientY });
  };

  // STAŁE WYMIARY (dopasowane do koordynatów w body-zones)
  const WIDTH = 724;
  const HEIGHT = 1024;

  // KOLORYSTYKA STREF
  const colors = {
    // 1. BAZOWY (Widoczny od razu): Delikatny szary
    base: {
      fill: "rgba(143, 166, 157, 0.8)", // sage z większą widocznością (szare pola) - ZMIANA NA 0.8
      stroke: "rgba(143, 166, 157, 0.6)", // sage obrys
      strokeWidth: 1,
    },
    // 2. HOVER (Po najechaniu): Złoty (Brand)
    hover: {
      fill: "rgba(212, 175, 55, 0.6)", // Brand (#D4AF37) z przezroczystością - TEŻ ZWIĘKSZAM LEKKO
      stroke: "#D4AF37", // Pełny kolor obrysu (Brand)
      strokeWidth: 2,
    },
    // 3. SELECTED (Wybrany): Mocny Złoty
    selected: {
      fill: "rgba(212, 175, 55, 0.9)", // Brand (#D4AF37) z większą przezroczystością - TEŻ ZWIĘKSZAM
      stroke: "#D4AF37", // mocny złoty (Brand)
      strokeWidth: 3,
    },
  };

  // Determine which zones to use
  const baseZones = customZones || BODY_ZONES;

  // Filter base zones if allowedZones is provided
  const visibleZones = allowedZones
    ? baseZones.filter((z) => allowedZones.includes(z.id))
    : baseZones;

  const toggleZone = (id: string) => {
    let newSelected;
    if (selected.includes(id)) {
      newSelected = selected.filter((z) => z !== id);
    } else {
      newSelected = [...selected, id];
    }

    setSelected(newSelected);
    if (onSelect) onSelect(newSelected);
  };

  const selectAll = () => {
    const allIds = visibleZones.map((z) => z.id);
    if (selected.length === allIds.length) {
      // Deselect all if all are selected
      setSelected([]);
      if (onSelect) onSelect([]);
    } else {
      // Select all
      setSelected(allIds);
      if (onSelect) onSelect(allIds);
    }
  };

  const getZoneName = (id: string) =>
    baseZones.find((z) => z.id === id)?.name || id;

  return (
    <div className="flex flex-col items-center w-full max-w-2xl mx-auto">
      {/* Nagłówek z nazwą strefy po najechaniu (szybki podgląd) */}
      <div className="mb-2 flex items-center justify-between w-full">
        <div className="h-8 flex items-center justify-center flex-1 bg-black/40 rounded-md border border-emerald/30 mr-2">
          {hovered ? (
            <span className="text-brand font-semibold text-sm animate-pulse transition-all">
              {getZoneName(hovered)}
            </span>
          ) : (
            <span className="text-ui-textSecondary text-[10px] uppercase tracking-[0.2em]">
              Wybierz obszar zabiegu
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={selectAll}
          className="h-8 px-3 text-[10px] font-bold uppercase tracking-wider text-brand bg-brand/10 rounded-md border border-brand/20 hover:bg-brand/20 transition-all whitespace-nowrap"
        >
          {selected.length === visibleZones.length
            ? "Odznacz wszystko"
            : "Zaznacz wszystko"}
        </button>
      </div>

      {/* Kontener na SVG */}
      <div
        className="relative w-full aspect-[724/1024] shadow-2xl rounded-2xl overflow-hidden border border-emerald/20 cursor-crosshair"
        style={{
          backgroundImage: "url('/women-body-chart.JPG')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
        onMouseMove={handleMouseMove}
      >
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-full">
          {/* WARSTWA 2: INTERAKTYWNE STREFY */}
          {visibleZones.map((zone) => {
            const isSelected = selected.includes(zone.id);
            const isHovered = hovered === zone.id;

            // Ustalanie aktualnego stylu na podstawie stanu
            let currentStyle = colors.base;
            if (isSelected) {
              currentStyle = colors.selected;
            } else if (isHovered) {
              currentStyle = colors.hover;
            }

            return (
              <g key={zone.id}>
                <path
                  d={zone.d}
                  onClick={() => toggleZone(zone.id)}
                  onMouseEnter={() => setHovered(zone.id)}
                  onMouseLeave={() => setHovered(null)}
                  fill="transparent"
                  stroke="transparent"
                  strokeWidth={30}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="cursor-pointer"
                  style={{
                    outline: "none",
                    WebkitTapHighlightColor: "transparent",
                  }}
                >
                  <title>{zone.name}</title>
                </path>
                <path
                  d={zone.d}
                  pointerEvents="none"
                  fill={currentStyle.fill}
                  stroke={currentStyle.stroke}
                  strokeWidth={currentStyle.strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="transition-all duration-300 ease-out"
                />
              </g>
            );
          })}
        </svg>
      </div>

      {/* Lista wybranych tagów pod spodem */}
      <div className="mt-4 flex flex-wrap justify-center gap-2 min-h-[40px]">
        {selected.map((id) => (
          <button
            key={id}
            onClick={() => toggleZone(id)}
            className="px-3 py-1 bg-brand/10 text-brand text-[10px] font-bold rounded-full border border-brand/20 hover:bg-brand/20 hover:border-brand/40 transition-colors flex items-center gap-1 group uppercase tracking-wider"
          >
            {getZoneName(id)}
            <span className="text-brand/60 group-hover:text-brand font-normal ml-1">
              ×
            </span>
          </button>
        ))}
      </div>

      {/* Cursor Tooltip */}
      {hovered && (
        <div
          className="fixed pointer-events-none z-[9999] bg-ui-card text-white px-4 py-2 rounded-lg shadow-2xl border border-brand/30 text-xs font-bold uppercase tracking-widest transform -translate-x-1/2 -translate-y-[120%] backdrop-blur-md"
          style={{
            left: mousePos.x,
            top: mousePos.y,
            transition: "opacity 0.15s ease-out",
          }}
        >
          {getZoneName(hovered)}
          {/* Add a small arrow pointing down */}
          <div className="absolute bottom-[-6px] left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-ui-card" />
        </div>
      )}
    </div>
  );
}
