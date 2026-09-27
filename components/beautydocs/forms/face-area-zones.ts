import { BODY_ZONES } from "../../../types/body-zones";
import { ZONES as FACE_ZONES } from "../../../types/face-zones";
import { ZONES as TISSUE_ZONES } from "../../../types/face-zones-tissue";
import { ZONES as PMU_ZONES } from "../../../types/face-zone-pernament";
import type { FaceAreaZone } from "./BeautyDocsFaceAreaSelector";

export interface FaceAreaSet {
  readonly chartImage: string;
  readonly zones: readonly FaceAreaZone[];
  readonly viewBoxWidth: number;
  readonly viewBoxHeight: number;
}

const FACE_CHART = "/women-face-chart.jpg";
const BODY_CHART = "/women-body-chart.JPG";

/**
 * Named treatment-area zone sets keyed by the `anatomy.faceZoneSet` /
 * `anatomy.bodyZoneSet` ids carried in a form template's schema. Reuses the
 * legacy zone geometry so the interactive chart stays identical to the original
 * BeautyDocs forms.
 */
const FACE_AREA_SETS: Record<string, FaceAreaSet> = {
  pmu: { chartImage: FACE_CHART, zones: PMU_ZONES, viewBoxWidth: 980, viewBoxHeight: 980 },
  face: { chartImage: FACE_CHART, zones: FACE_ZONES, viewBoxWidth: 980, viewBoxHeight: 980 },
  tissue: { chartImage: FACE_CHART, zones: TISSUE_ZONES, viewBoxWidth: 980, viewBoxHeight: 980 },
};

const BODY_AREA_SETS: Record<string, FaceAreaSet> = {
  body: { chartImage: BODY_CHART, zones: BODY_ZONES, viewBoxWidth: 724, viewBoxHeight: 1024 },
};

export function resolveFaceAreaSet(zoneSet: string | null | undefined): FaceAreaSet | null {
  if (!zoneSet) return null;
  return FACE_AREA_SETS[zoneSet] ?? null;
}

export function resolveBodyAreaSet(zoneSet: string | null | undefined): FaceAreaSet | null {
  if (!zoneSet) return null;
  return BODY_AREA_SETS[zoneSet] ?? null;
}
