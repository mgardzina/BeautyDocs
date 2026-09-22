import { BeautyDocsFaceAreaSelector } from "./BeautyDocsFaceAreaSelector";
import {
  resolveBodyAreaSet,
  resolveFaceAreaSet,
} from "./face-area-zones";

export interface BeautyDocsTreatmentAreaAnatomy {
  readonly model: "face" | "body" | "both";
  readonly faceZoneSet: string | null;
  readonly bodyZoneSet: string | null;
}

export function getTreatmentAreaLabels(
  anatomy: BeautyDocsTreatmentAreaAnatomy | null,
  selectedIds: readonly string[],
): string[] {
  const faceAreaSet = resolveFaceAreaSet(anatomy?.faceZoneSet);
  const bodyAreaSet = resolveBodyAreaSet(anatomy?.bodyZoneSet);
  const zoneNames = new Map(
    [...(faceAreaSet?.zones ?? []), ...(bodyAreaSet?.zones ?? [])].map(
      (zone) => [zone.id, zone.name],
    ),
  );
  return selectedIds.map((id) => zoneNames.get(id) ?? "Inny obszar");
}

export function BeautyDocsTreatmentAreaVisualization({
  anatomy,
  selectedIds,
}: {
  readonly anatomy: BeautyDocsTreatmentAreaAnatomy | null;
  readonly selectedIds: readonly string[];
}) {
  const faceAreaSet = resolveFaceAreaSet(anatomy?.faceZoneSet);
  const bodyAreaSet = resolveBodyAreaSet(anatomy?.bodyZoneSet);
  const faceIds = faceAreaSet
    ? selectedIds.filter((id) =>
        faceAreaSet.zones.some((zone) => zone.id === id),
      )
    : [];
  const bodyIds = bodyAreaSet
    ? selectedIds.filter((id) =>
        bodyAreaSet.zones.some((zone) => zone.id === id),
      )
    : [];

  if (faceIds.length === 0 && bodyIds.length === 0) return null;

  return (
    <div
      className={`grid gap-6 ${faceIds.length > 0 && bodyIds.length > 0 ? "lg:grid-cols-2" : "mx-auto max-w-xl"}`}
    >
      {faceAreaSet && faceIds.length > 0 ? (
        <BeautyDocsFaceAreaSelector
          chartImage={faceAreaSet.chartImage}
          disabled
          displayOnly
          initialSelected={faceIds}
          viewBoxHeight={faceAreaSet.viewBoxHeight}
          viewBoxWidth={faceAreaSet.viewBoxWidth}
          zones={faceAreaSet.zones}
        />
      ) : null}
      {bodyAreaSet && bodyIds.length > 0 ? (
        <BeautyDocsFaceAreaSelector
          chartImage={bodyAreaSet.chartImage}
          disabled
          displayOnly
          initialSelected={bodyIds}
          viewBoxHeight={bodyAreaSet.viewBoxHeight}
          viewBoxWidth={bodyAreaSet.viewBoxWidth}
          zones={bodyAreaSet.zones}
        />
      ) : null}
    </div>
  );
}
