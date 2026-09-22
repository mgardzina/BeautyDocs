"use client";

import { useEffect, useState } from "react";

export interface FaceAreaZone {
  readonly id: string;
  readonly name: string;
  readonly d: string;
}

interface BeautyDocsFaceAreaSelectorProps {
  readonly zones: readonly FaceAreaZone[];
  readonly chartImage: string;
  readonly initialSelected?: readonly string[];
  readonly onSelect?: (selectedIds: string[]) => void;
  readonly disabled?: boolean;
  readonly displayOnly?: boolean;
  /** SVG viewBox dimensions of the chart (face is square 980×980; body 724×1024). */
  readonly viewBoxWidth?: number;
  readonly viewBoxHeight?: number;
}

// Cherry/cream zone styling (base → hover → selected).
const COLORS = {
  base: { fill: "rgba(36,92,77,0.14)", stroke: "rgba(36,92,77,0.35)", strokeWidth: 1 },
  hover: { fill: "rgba(36,92,77,0.30)", stroke: "#245c4d", strokeWidth: 2 },
  selected: { fill: "rgba(36,92,77,0.50)", stroke: "#245c4d", strokeWidth: 3 },
} as const;

/**
 * Interactive face chart for marking the treatment area. Ported from the legacy
 * PowderBrows AnatomyFaceSelector and restyled to the BeautyDocs cherry/cream
 * system. Zones are passed in per treatment (e.g. PMU brows/lips/eyelids).
 */
export function BeautyDocsFaceAreaSelector({
  zones,
  chartImage,
  initialSelected = [],
  onSelect,
  disabled = false,
  displayOnly = false,
  viewBoxWidth = 980,
  viewBoxHeight = 980,
}: BeautyDocsFaceAreaSelectorProps) {
  const [selected, setSelected] = useState<string[]>([...initialSelected]);
  const [hovered, setHovered] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    setSelected([...initialSelected]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSelected.join(",")]);

  const commit = (next: string[]) => {
    setSelected(next);
    onSelect?.(next);
  };

  const toggleZone = (id: string) => {
    if (disabled || displayOnly) return;
    commit(
      selected.includes(id) ? selected.filter((z) => z !== id) : [...selected, id],
    );
  };

  const toggleAll = () => {
    if (disabled || displayOnly) return;
    const allIds = zones.map((z) => z.id);
    commit(selected.length === allIds.length ? [] : allIds);
  };

  const zoneName = (id: string) => zones.find((z) => z.id === id)?.name ?? id;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center">
      <div className="mb-2 flex w-full items-center justify-between gap-2">
        <div className="flex h-8 flex-1 items-center justify-center rounded-md border border-[#d4decc] bg-[#f7f8f4]">
          {hovered ? (
            <span className="text-sm font-semibold text-[#245c4d]">
              {zoneName(hovered)}
            </span>
          ) : (
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#5a6b5a]">
              {displayOnly ? "Zaznaczone obszary" : "Zaznacz obszar zabiegu"}
            </span>
          )}
        </div>
        {!displayOnly ? (
          <button
            className="h-8 whitespace-nowrap rounded-md border border-[#d4decc] bg-[#eef3e7] px-3 text-[10px] font-bold uppercase tracking-wider text-[#245c4d] transition hover:bg-[#e2ecd3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#245c4d] disabled:opacity-50"
            disabled={disabled}
            onClick={toggleAll}
            type="button"
          >
            {selected.length === zones.length ? "Odznacz wszystko" : "Zaznacz wszystko"}
          </button>
        ) : null}
      </div>

      <div
        className={`relative w-full overflow-hidden rounded-2xl border border-[#d4decc] shadow-[0_16px_40px_rgba(49,67,51,0.12)] ${displayOnly ? "cursor-default" : "cursor-crosshair"}`}
        onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
        style={{
          aspectRatio: `${viewBoxWidth} / ${viewBoxHeight}`,
          backgroundImage: `url('${chartImage}')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <svg className="h-full w-full" viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}>
          {zones.map((zone) => {
            const style = selected.includes(zone.id)
              ? COLORS.selected
              : hovered === zone.id
                ? COLORS.hover
                : COLORS.base;
            return (
              <path
                className={`${displayOnly ? "cursor-default" : "cursor-pointer"} transition-all duration-300 ease-out`}
                d={zone.d}
                fill={style.fill}
                key={zone.id}
                onClick={displayOnly ? undefined : () => toggleZone(zone.id)}
                onMouseEnter={() => setHovered(zone.id)}
                onMouseLeave={() => setHovered(null)}
                stroke={style.stroke}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={style.strokeWidth}
                style={{ outline: "none", WebkitTapHighlightColor: "transparent" }}
              >
                <title>{zone.name}</title>
              </path>
            );
          })}
        </svg>
      </div>

      <div className="mt-4 flex min-h-[40px] flex-wrap justify-center gap-2">
        {selected.map((id) =>
          displayOnly ? (
            <span
              className="inline-flex rounded-full border border-[#d4decc] bg-[#eef3e7] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#245c4d]"
              key={id}
            >
              {zoneName(id)}
            </span>
          ) : (
            <button
              className="inline-flex items-center gap-1 rounded-full border border-[#d4decc] bg-[#eef3e7] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#245c4d] transition hover:bg-[#e2ecd3] disabled:opacity-50"
              disabled={disabled}
              key={id}
              onClick={() => toggleZone(id)}
              type="button"
            >
              {zoneName(id)}
              <span className="ml-1 font-normal text-[#96a298]">×</span>
            </button>
          ),
        )}
      </div>

      {hovered ? (
        <div
          className="pointer-events-none fixed z-30 -translate-x-1/2 -translate-y-[120%] rounded-lg border border-[#cdd7c6] bg-white px-4 py-2 text-xs font-bold uppercase tracking-widest text-[#173d35] shadow-xl"
          style={{ left: mousePos.x, top: mousePos.y }}
        >
          {zoneName(hovered)}
        </div>
      ) : null}
    </div>
  );
}
