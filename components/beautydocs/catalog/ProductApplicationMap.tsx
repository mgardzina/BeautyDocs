"use client";

import { useT } from "../i18n";
import Image from "next/image";
import { BODY_ZONES } from "@/types/body-zones";
import { ZONES as FACE_ZONES } from "@/types/face-zones";

export interface ProductApplicationArea {
  readonly code: string;
  readonly label: string;
}

interface AreaColor {
  readonly fill: string;
  readonly solid: string;
  readonly stroke: string;
}

const faceAreaZoneIds: Readonly<Record<string, readonly string[]>> = {
  FACE: ["forehead", "glabella", "nose", "left_cheek", "right_cheek", "chin", "jaw_left", "jaw_right"],
  SUN_EXPOSED: ["forehead", "nose", "left_cheek", "right_cheek"],
  FACIAL_LINES: ["forehead", "glabella", "nasolabial_folds", "marionette_lines"],
  CHEEKS: ["left_cheek", "right_cheek"],
  NASOLABIAL_FOLDS: ["nasolabial_folds"],
  LIPS: ["lips"],
  MARIONETTE_LINES: ["marionette_lines"],
  CHIN: ["chin"],
  JAWLINE: ["jaw_left", "jaw_right"],
  EYES: ["left_eye", "right_eye", "eyes"],
  BROWS: ["eyebrow_left", "eyebrow_right"],
};

const allBodyZoneIds = BODY_ZONES.filter(
  (zone) => zone.d && zone.id !== "face",
).map((zone) => zone.id);

const bodyAreaZoneIds: Readonly<Record<string, readonly string[]>> = {
  BODY: allBodyZoneIds,
  NECK: ["neck"],
  DECOLLETE: ["chest"],
  UNDERARMS: ["arm_left", "arm_right"],
  ARMS: ["arm_left", "arm_right", "forearm_left", "forearm_right"],
  CHEST: ["chest"],
  ABDOMEN: ["belly"],
  BACK: ["back"],
  BIKINI: ["bikini_area"],
  BUTTOCKS: ["ass"],
  LEGS: ["thight_left", "thight_right", "calf_left", "calf_right", "shin_left", "shin_right"],
};

const areaColors: readonly AreaColor[] = [
  { fill: "rgba(36,92,77, 0.48)", solid: "#245c4d", stroke: "#427b6d" },
  { fill: "rgba(96,190,166, 0.46)", solid: "#aa684d", stroke: "#92543e" },
  { fill: "rgba(118,91,121, 0.44)", solid: "#765b79", stroke: "#604764" },
  { fill: "rgba(185,139,70, 0.42)", solid: "#a87935", stroke: "#8d642c" },
];

export function ProductApplicationMap({
  areas,
}: {
  readonly areas: readonly ProductApplicationArea[];
}) {
  const t = useT();
  if (areas.length === 0) return null;

  const faceHighlights = areas.flatMap((area, areaIndex) =>
    (faceAreaZoneIds[area.code] ?? []).flatMap((zoneId) => {
      const zone = FACE_ZONES.find((candidate) => candidate.id === zoneId);
      return zone?.d ? [{ area, areaIndex, zone }] : [];
    }),
  );
  const bodyHighlights = areas.flatMap((area, areaIndex) =>
    (bodyAreaZoneIds[area.code] ?? []).flatMap((zoneId) => {
      const zone = BODY_ZONES.find((candidate) => candidate.id === zoneId);
      return zone?.d ? [{ area, areaIndex, zone }] : [];
    }),
  );

  return (
    <section
      aria-labelledby="obszary-stosowania"
      className="mt-20 scroll-mt-24 overflow-hidden rounded-[34px] bg-[#eee2d5] sm:scroll-mt-28"
      id="obszary"
    >
      <div className="grid items-center lg:grid-cols-[1.05fr_0.95fr]">
        <div
          className={`grid min-h-full items-stretch ${
            faceHighlights.length > 0 && bodyHighlights.length > 0 ? "sm:grid-cols-2" : "grid-cols-1"
          }`}
        >
          {faceHighlights.length > 0 ? (
            <ApplicationDiagram
              alt={t("Schemat twarzy BeautyDocs z zaznaczonymi obszarami zastosowania produktu")}
              aspectClass="aspect-square"
              highlights={faceHighlights}
              imagePath="/women-face-chart.jpg"
              label={t("Twarz")}
              viewBox="0 0 980 980"
            />
          ) : null}
          {bodyHighlights.length > 0 ? (
            <ApplicationDiagram
              alt={t("Schemat ciała BeautyDocs z zaznaczonymi obszarami zastosowania produktu")}
              aspectClass="aspect-[724/1024]"
              highlights={bodyHighlights}
              imagePath="/women-body-chart.JPG"
              label={t("Ciało")}
              viewBox="0 0 724 1024"
            />
          ) : null}
        </div>

        <div className="px-6 pb-10 pt-8 sm:px-10 lg:px-14 lg:py-16">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#245c4d]">{t("Mapa zastosowania")}</p>
          <h2
            className="mt-3 max-w-lg font-serif text-3xl font-medium leading-tight text-[#173d35] sm:text-4xl"
            id="obszary-stosowania"
          >
            {t("Obszary wymienione w materiałach produktu")}
          </h2>
          <p className="mt-4 max-w-lg text-sm leading-7 text-stone-600">
            {t("Wykorzystujemy te same schematy twarzy i ciała, które są dostępne w formularzach BeautyDocs. Mapa nie oznacza rekomendacji zabiegu ani nie zastępuje kwalifikacji specjalisty.")}
          </p>

          <ol className="mt-8 border-t border-[#d8c7b9]">
            {areas.map((area, index) => {
              const color = areaColors[index % areaColors.length];
              return (
                <li className="flex items-center gap-4 border-b border-[#d8c7b9] py-4" key={`${area.code}:${area.label}`}>
                  <span
                    className="grid size-8 shrink-0 place-items-center rounded-full border text-xs font-black text-white"
                    style={{ backgroundColor: color.solid, borderColor: color.stroke }}
                  >
                    {index + 1}
                  </span>
                  <span className="text-sm font-bold text-[#333d34]">{t(area.label)}</span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}

function ApplicationDiagram({
  alt,
  aspectClass,
  highlights,
  imagePath,
  label,
  viewBox,
}: {
  readonly alt: string;
  readonly aspectClass: string;
  readonly highlights: readonly {
    readonly area: ProductApplicationArea;
    readonly areaIndex: number;
    readonly zone: { readonly d: string; readonly id: string };
  }[];
  readonly imagePath: string;
  readonly label: string;
  readonly viewBox: string;
}) {
  const t = useT();
  return (
    <div className={`relative overflow-hidden bg-[#e6d9cb] ${aspectClass}`}>
      <Image
        alt={alt}
        className="object-cover opacity-80 mix-blend-multiply"
        fill
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 28vw"
        src={imagePath}
      />
      <span className="absolute left-4 top-4 z-10 rounded-full bg-white/85 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.14em] text-[#245c4d] backdrop-blur-sm">
        {t(label)}
      </span>
      <svg aria-hidden="true" className="absolute inset-0 h-full w-full" viewBox={viewBox}>
        {highlights.map(({ area, areaIndex, zone }) => {
          const color = areaColors[areaIndex % areaColors.length];
          return (
            <path
              d={zone.d}
              fill={color.fill}
              key={`${area.code}:${areaIndex}:${zone.id}`}
              stroke={color.stroke}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="4"
            />
          );
        })}
      </svg>
    </div>
  );
}
