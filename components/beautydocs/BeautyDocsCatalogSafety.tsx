"use client";

import { useT } from "./i18n";
import { AlertTriangle, ChevronDown, ExternalLink, Info, Siren } from "lucide-react";
import type { BeautyDocsCatalogItem, BeautyDocsSalonCatalogItem } from "@/types/beautydocs-catalog";

type CatalogSafetyItem = Pick<
  BeautyDocsCatalogItem | BeautyDocsSalonCatalogItem,
  "details" | "kind"
>;

type SafetyStatus = "PHOTOSENSITIZING" | "VERIFY";

interface SafetyAssessment {
  readonly status: SafetyStatus;
  readonly label: string;
  readonly summary: string;
  readonly evidenceLabel: string;
  readonly evidenceUrl: string;
  readonly relevantTreatmentFamilies: readonly string[];
}

export function BeautyDocsCatalogSafety({
  item,
  compact = false,
}: {
  readonly item: CatalogSafetyItem;
  readonly compact?: boolean;
}) {
  const t = useT();
  if (item.kind !== "MEDICINE") return null;
  const assessment = readSafetyAssessment(item.details);
  const activeSubstance = detailText(item.details, "activeSubstance");
  const pharmaceuticalForm = detailText(item.details, "pharmaceuticalForm");
  const strength = detailText(item.details, "strength");
  const isPhotosensitizing = assessment.status === "PHOTOSENSITIZING";
  const Icon = isPhotosensitizing ? Siren : AlertTriangle;

  return (
    <details
      className={`group mt-3 overflow-hidden rounded-2xl border ${
        isPhotosensitizing
          ? "border-red-200 bg-red-50/80"
          : "border-amber-200 bg-amber-50/70"
      }`}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 [&::-webkit-details-marker]:hidden">
        <Icon
          className={`size-4 shrink-0 ${isPhotosensitizing ? "text-red-700" : "text-amber-700"}`}
        />
        <span
          className={`min-w-0 flex-1 text-[11px] font-black uppercase tracking-[0.08em] ${
            isPhotosensitizing ? "text-red-800" : "text-amber-800"
          }`}
        >
          {t(assessment.label)}
        </span>
        <span className="hidden text-[10px] font-bold text-stone-500 sm:inline">
          {t("Szczegóły")}
        </span>
        <ChevronDown className="size-4 shrink-0 text-stone-500 transition group-open:rotate-180" />
      </summary>

      <div className="border-t border-black/5 bg-white/65 px-3 py-3">
        {!compact && (activeSubstance || pharmaceuticalForm || strength) ? (
          <dl className="grid gap-x-4 gap-y-2 text-[11px] sm:grid-cols-2">
            {activeSubstance ? (
              <CatalogFact label={t("Substancja czynna")} value={activeSubstance} />
            ) : null}
            {pharmaceuticalForm ? (
              <CatalogFact label={t("Postać")} value={pharmaceuticalForm} />
            ) : null}
            {strength ? <CatalogFact label={t("Dawka / moc")} value={strength} /> : null}
          </dl>
        ) : null}

        <p
          className={`flex items-start gap-2 text-[11px] font-semibold leading-5 ${
            !compact && (activeSubstance || pharmaceuticalForm || strength)
              ? "mt-3 border-t border-black/5 pt-3"
              : ""
          } ${isPhotosensitizing ? "text-red-900" : "text-amber-950"}`}
        >
          <Info className="mt-0.5 size-3.5 shrink-0" />
          {t(assessment.summary)}
        </p>

        {assessment.relevantTreatmentFamilies.length > 0 ? (
          <p className="mt-2 text-[10px] font-black uppercase tracking-[0.08em] text-red-700">
            {t("Szczególnie istotne przy zabiegach: laser, IPL i UV")}
          </p>
        ) : null}

        <a
          className="mt-2 inline-flex items-center gap-1 text-[10px] font-black text-[#508276] hover:underline"
          href={assessment.evidenceUrl}
          rel="noreferrer"
          target="_blank"
        >
          {t(assessment.evidenceLabel)} <ExternalLink className="size-3" />
        </a>

        <p className="mt-2 text-[10px] leading-4 text-stone-500">
          {t("To sygnał do oceny przed zabiegiem, nie decyzja o odstawieniu leku ani automatyczna kwalifikacja klientki.")}
        </p>
      </div>
    </details>
  );
}

function CatalogFact({ label, value }: { readonly label: string; readonly value: string }) {
  const t = useT();
  return (
    <div>
      <dt className="font-black text-stone-500">{t(label)}</dt>
      <dd className="mt-0.5 font-semibold leading-4 text-[#303d32]">{value}</dd>
    </div>
  );
}

function readSafetyAssessment(
  details: Readonly<Record<string, unknown>>,
): SafetyAssessment {
  const raw = asRecord(details.safetyAssessment);
  const status = raw?.status === "PHOTOSENSITIZING" ? "PHOTOSENSITIZING" : "VERIFY";
  const fallback = status === "PHOTOSENSITIZING"
    ? "W oficjalnym źródle wskazano ryzyko nadwrażliwości na światło."
    : "Sprawdź aktualną Charakterystykę Produktu Leczniczego przed zabiegiem.";
  return {
    status,
    label:
      typeof raw?.label === "string"
        ? raw.label
        : status === "PHOTOSENSITIZING"
          ? "Światłouczulający"
          : "Wymaga weryfikacji",
    summary: typeof raw?.summary === "string" ? raw.summary : fallback,
    evidenceLabel:
      typeof raw?.evidenceLabel === "string"
        ? raw.evidenceLabel
        : "Charakterystyka Produktu Leczniczego (RPL)",
    evidenceUrl:
      typeof raw?.evidenceUrl === "string" && raw.evidenceUrl.startsWith("https://")
        ? raw.evidenceUrl
        : detailUrl(details, "characteristicUrl") ?? "https://rejestry.ezdrowie.gov.pl/rpl/search/public",
    relevantTreatmentFamilies: Array.isArray(raw?.relevantTreatmentFamilies)
      ? raw.relevantTreatmentFamilies.filter(
          (value): value is string => typeof value === "string",
        )
      : [],
  };
}

function asRecord(value: unknown): Readonly<Record<string, unknown>> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : null;
}

function detailText(
  details: Readonly<Record<string, unknown>>,
  key: string,
): string | null {
  const value = details[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function detailUrl(
  details: Readonly<Record<string, unknown>>,
  key: string,
): string | null {
  const value = details[key];
  return typeof value === "string" && value.startsWith("https://") ? value : null;
}
