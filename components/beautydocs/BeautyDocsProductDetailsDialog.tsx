"use client";

import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  Cpu,
  Droplets,
  ExternalLink,
  FlaskConical,
  Info,
  ListChecks,
  Package,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Sun,
  Waves,
  X,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type {
  BeautyDocsCatalogItem,
  BeautyDocsSalonCatalogItem,
} from "@/types/beautydocs-catalog";

type ProductCatalogItem = Pick<
  BeautyDocsCatalogItem | BeautyDocsSalonCatalogItem,
  | "brand"
  | "details"
  | "kind"
  | "name"
  | "sourceLabel"
  | "sourceUrl"
  | "summary"
>;

type ProductTab = "overview" | "details" | "safety" | "sources";

interface ProductSourceDocument {
  readonly label: string;
  readonly url: string;
  readonly scope: string;
}

export function isProfessionalCatalogProduct(
  item: Pick<ProductCatalogItem, "details">,
): boolean {
  return item.details.catalogProfile === "PROFESSIONAL_PRODUCT";
}

export function BeautyDocsProductDetailsDialog({
  item,
  onClose,
  onPrimaryAction,
  primaryActionDisabled = false,
  primaryActionLabel = "Dodaj do katalogu salonu",
}: {
  readonly item: ProductCatalogItem;
  readonly onClose: () => void;
  readonly onPrimaryAction?: () => void;
  readonly primaryActionDisabled?: boolean;
  readonly primaryActionLabel?: string;
}) {
  const [activeTab, setActiveTab] = useState<ProductTab>("overview");

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  const isDevice = item.kind === "DEVICE";
  const isCosmetic = item.kind === "COSMETIC";
  const presentation =
    detailText(item.details, "presentation") ?? "Sprawdź etykietę";
  const family =
    detailText(item.details, "productFamily") ??
    (isDevice
      ? "Platforma zabiegowa"
      : isCosmetic
        ? "Pielęgnacja skóry"
        : "Preparat profesjonalny");
  const productCategory =
    detailText(item.details, "productCategory") ??
    (isDevice
      ? "Urządzenie profesjonalne"
      : isCosmetic
        ? "Kosmetyk"
        : "Preparat zabiegowy");
  const storage = detailText(item.details, "storage");
  const safetyScope = detailText(item.details, "safetyScope");
  const regulatoryNotice = detailText(item.details, "regulatoryNotice");
  const usageNotice = detailText(item.details, "usageNotice");
  const imagePath = detailText(item.details, "imagePath");
  const imageAlt = detailText(item.details, "imageAlt") ?? item.name;
  const imageCreditUrl = detailText(item.details, "imageCreditUrl");
  const imageNote = detailText(item.details, "imageNote");
  const reviewedAt = detailText(item.details, "lastReviewedAt");
  const activeIngredients = detailList(item.details, "activeIngredients");
  const manufacturerUses = detailList(item.details, "manufacturerUses");
  const technologies = detailList(item.details, "technologies");
  const wavelengths = detailList(item.details, "wavelengths");
  const features = detailList(item.details, "features");
  const availableSizes = detailList(item.details, "availableSizes");
  const keyIngredients = detailList(item.details, "keyIngredients");
  const skinTypes = detailList(item.details, "skinTypes");
  const qualificationAlerts = detailList(item.details, "qualificationAlerts");
  const commonReactions = detailList(item.details, "commonReactions");
  const seriousRisks = detailList(item.details, "seriousRisks");
  const sourceDocuments = readSourceDocuments(item.details);
  const containsLidocaine = detailBoolean(item.details, "containsLidocaine");
  const brand = item.brand ?? "BeautyDocs";
  const primaryActionText = primaryActionDisabled
    ? "Produkt jest już w katalogu"
    : primaryActionLabel;
  const tabs: readonly { readonly id: ProductTab; readonly label: string }[] = [
    { id: "overview", label: "Opis" },
    {
      id: "details",
      label: isDevice
        ? "Technologia"
        : isCosmetic
          ? "Skład i użycie"
          : "Dane produktu",
    },
    { id: "safety", label: "Bezpieczeństwo" },
    { id: "sources", label: "Źródła" },
  ];

  return createPortal(
    <div
      aria-modal="true"
      className="fixed inset-0 z-[240] grid items-end overflow-hidden bg-[#131714]/65 p-0 backdrop-blur-[5px] sm:place-items-center sm:p-5"
      onClick={onClose}
      role="dialog"
    >
      <div
        className="font-catalog relative flex max-h-[100dvh] w-full max-w-[1240px] flex-col overflow-hidden rounded-t-[30px] bg-[#fcfff9] shadow-[0_32px_100px_rgba(17,23,18,0.34)] sm:max-h-[calc(100dvh-2.5rem)] sm:rounded-[34px]"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          aria-label="Zamknij kartę produktu"
          className="absolute right-4 top-4 z-30 grid size-11 place-items-center rounded-full border border-black/5 bg-white/90 text-stone-600 shadow-sm backdrop-blur transition hover:scale-105 hover:bg-white hover:text-black sm:right-6 sm:top-6"
          onClick={onClose}
          type="button"
        >
          <X className="size-5" />
        </button>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <section className="grid min-h-[520px] lg:grid-cols-[1.08fr_0.92fr]">
            <ProductHeroVisual
              brand={brand}
              imageAlt={imageAlt}
              imageCreditUrl={imageCreditUrl}
              imageNote={imageNote}
              imagePath={imagePath}
              kind={item.kind}
              name={item.name}
            />

            <div className="flex flex-col justify-center bg-[#fcfff9] px-6 pb-9 pt-8 sm:px-10 lg:px-12 lg:py-16">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#5b9b8b]">
                {brand}
              </p>
              <h2 className="mt-3 max-w-xl text-[2rem] font-extrabold leading-[1.02] tracking-[-0.045em] text-[#1d241e] sm:text-[2.75rem] lg:text-[3.35rem]">
                {item.name}
              </h2>
              <p className="mt-4 text-sm font-medium leading-7 text-stone-600 sm:text-[15px]">
                {item.summary}
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                <ProductChip icon={Package} label={presentation} />
                <ProductChip
                  icon={isDevice ? Cpu : isCosmetic ? Sparkles : FlaskConical}
                  label={productCategory}
                />
                {!isDevice && !isCosmetic ? (
                  <ProductChip
                    icon={ShieldCheck}
                    label={
                      containsLidocaine === true
                        ? "Z lidokainą"
                        : containsLidocaine === false
                          ? "Bez lidokainy"
                          : "Sprawdź wariant"
                    }
                  />
                ) : null}
              </div>

              {manufacturerUses.length > 0 ? (
                <div className="mt-7 border-t border-[#e9dfda] pt-5">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-stone-400">
                    Informacje producenta
                  </p>
                  <ul className="mt-3 space-y-2.5">
                    {manufacturerUses.slice(0, 3).map((use) => (
                      <li
                        className="flex items-start gap-2.5 text-sm font-semibold leading-6 text-[#333d34]"
                        key={use}
                      >
                        <CheckCircle2 className="mt-1 size-4 shrink-0 text-emerald-600" />
                        {use}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {onPrimaryAction ? (
                <button
                  className="mt-8 hidden w-full items-center justify-center rounded-full bg-[#212822] px-6 py-4 text-sm font-extrabold text-white shadow-[0_12px_30px_rgba(30,39,31,0.22)] transition hover:-translate-y-0.5 hover:bg-[#508074] disabled:translate-y-0 disabled:bg-stone-200 disabled:text-stone-500 disabled:shadow-none lg:flex"
                  disabled={primaryActionDisabled}
                  onClick={onPrimaryAction}
                  type="button"
                >
                  {primaryActionText}
                </button>
              ) : null}
            </div>
          </section>

          <nav className="sticky top-0 z-20 border-y border-[#e4eadc] bg-[#fcfff9]/95 px-5 backdrop-blur sm:px-9">
            <div className="mx-auto flex max-w-5xl gap-7 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {tabs.map((tab) => (
                <button
                  className={`relative shrink-0 py-4 text-xs font-extrabold transition sm:text-sm ${
                    activeTab === tab.id
                      ? "text-[#232c24]"
                      : "text-stone-400 hover:text-stone-700"
                  }`}
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  type="button"
                >
                  {tab.label}
                  {activeTab === tab.id ? (
                    <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-[#5b9b8b]" />
                  ) : null}
                </button>
              ))}
            </div>
          </nav>

          <div className="mx-auto w-full max-w-5xl px-5 py-7 sm:px-9 sm:py-10">
            {activeTab === "overview" ? (
              <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
                <ProductPanel icon={BadgeCheck} title="O produkcie">
                  <p className="text-sm font-medium leading-7 text-stone-600">
                    {item.summary}
                  </p>
                  <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-stone-500">
                    <Info className="mt-0.5 size-4 shrink-0 text-[#5b9b8b]" />
                    {isCosmetic
                      ? "Karta przedstawia informacje o produkcie, a nie automatyczne zalecenie pozabiegowe."
                      : isDevice
                        ? "Zakres zastosowań zależy od konfiguracji urządzenia, aktualnej instrukcji i uprawnień operatora."
                        : "To karta informacyjna, a nie automatyczna kwalifikacja do zabiegu. Decyzję podejmuje uprawniony specjalista po wywiadzie i badaniu."}
                  </p>
                </ProductPanel>
                <ProductPanel icon={Package} title="Wariant i format">
                  <DataRow label="Rodzina" value={family} />
                  <DataRow label="Format" value={presentation} />
                  <DataRow label="Marka" value={brand} />
                </ProductPanel>
                {manufacturerUses.length > 0 ? (
                  <div className="lg:col-span-2">
                    <ProductPanel
                      icon={ListChecks}
                      title="Zastosowania opisane przez producenta"
                    >
                      <BulletList items={manufacturerUses} tone="emerald" />
                    </ProductPanel>
                  </div>
                ) : null}
              </div>
            ) : null}

            {activeTab === "details" ? (
              <div className="grid gap-5 md:grid-cols-2">
                {activeIngredients.length > 0 || keyIngredients.length > 0 ? (
                  <ProductPanel
                    icon={FlaskConical}
                    title={
                      isCosmetic
                        ? "Kluczowe składniki"
                        : "Skład wskazany w karcie"
                    }
                  >
                    <PillList
                      items={isCosmetic ? keyIngredients : activeIngredients}
                    />
                  </ProductPanel>
                ) : null}
                {isDevice && technologies.length > 0 ? (
                  <ProductPanel icon={Cpu} title="Technologie">
                    <PillList items={technologies} />
                  </ProductPanel>
                ) : null}
                {isDevice && wavelengths.length > 0 ? (
                  <ProductPanel icon={Waves} title="Długości fal">
                    <PillList items={wavelengths} />
                  </ProductPanel>
                ) : null}
                {isDevice && features.length > 0 ? (
                  <ProductPanel icon={ListChecks} title="Najważniejsze cechy">
                    <BulletList items={features} tone="stone" />
                  </ProductPanel>
                ) : null}
                {isCosmetic && availableSizes.length > 0 ? (
                  <ProductPanel icon={Package} title="Dostępne formaty">
                    <PillList items={availableSizes} />
                  </ProductPanel>
                ) : null}
                {isCosmetic && skinTypes.length > 0 ? (
                  <ProductPanel
                    icon={Droplets}
                    title="Typy skóry opisane przez markę"
                  >
                    <BulletList items={skinTypes} tone="stone" />
                  </ProductPanel>
                ) : null}
                {storage ? (
                  <ProductPanel icon={Package} title="Przechowywanie">
                    <p className="text-sm font-medium leading-6 text-stone-600">
                      {storage}
                    </p>
                  </ProductPanel>
                ) : null}
                {isCosmetic && usageNotice ? (
                  <ProductPanel
                    icon={Sun}
                    title="Stosowanie i dobór po zabiegu"
                  >
                    <p className="text-sm font-medium leading-6 text-stone-600">
                      {usageNotice}
                    </p>
                  </ProductPanel>
                ) : null}
              </div>
            ) : null}

            {activeTab === "safety" ? (
              <div className="grid gap-5 md:grid-cols-2">
                {!isDevice && !isCosmetic ? (
                  <>
                    <ProductPanel
                      icon={AlertTriangle}
                      title="Co zgłosić przed kwalifikacją"
                      tone="amber"
                    >
                      <BulletList items={qualificationAlerts} tone="amber" />
                    </ProductPanel>
                    <ProductPanel
                      icon={Info}
                      title="Możliwe reakcje po iniekcji"
                    >
                      <BulletList items={commonReactions} tone="stone" />
                    </ProductPanel>
                    <div className="md:col-span-2">
                      <ProductPanel
                        icon={ShieldAlert}
                        title="Poważne ryzyka wymagające uwagi"
                        tone="red"
                      >
                        <BulletList items={seriousRisks} tone="red" />
                        {safetyScope ? (
                          <p className="mt-4 border-t border-red-100 pt-4 text-xs leading-5 text-red-900/70">
                            {safetyScope}
                          </p>
                        ) : null}
                      </ProductPanel>
                    </div>
                  </>
                ) : (
                  <div className="md:col-span-2">
                    <ProductPanel
                      icon={ShieldCheck}
                      title="Zakres informacji o bezpieczeństwie"
                    >
                      <p className="text-sm font-medium leading-7 text-stone-600">
                        {regulatoryNotice ??
                          usageNotice ??
                          "Przed użyciem sprawdź aktualną instrukcję producenta, konfigurację produktu i wymogi obowiązujące na danym rynku."}
                      </p>
                    </ProductPanel>
                  </div>
                )}
              </div>
            ) : null}

            {activeTab === "sources" ? (
              <div className="space-y-4">
                <div className="flex flex-col gap-2 rounded-[24px] bg-[#f3ede8] p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-[#528d7e]">
                      Dane zweryfikowane
                    </p>
                    <p className="mt-1 text-sm font-semibold text-stone-600">
                      {item.sourceLabel ?? "Materiały producenta lub marki"}
                    </p>
                  </div>
                  {reviewedAt ? (
                    <p className="text-xs text-stone-500">
                      Aktualizacja: {formatReviewDate(reviewedAt)}
                    </p>
                  ) : null}
                </div>
                {sourceDocuments.map((source) => (
                  <a
                    className="group flex items-start justify-between gap-4 rounded-[22px] border border-[#e6dcd7] bg-white p-5 transition hover:-translate-y-0.5 hover:border-[#c0cdae] hover:shadow-[0_12px_28px_rgba(43,63,58,0.08)]"
                    href={source.url}
                    key={`${source.label}-${source.url}`}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <span>
                      <span className="block text-sm font-extrabold text-[#29352b]">
                        {source.label}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-stone-500">
                        {source.scope}
                      </span>
                    </span>
                    <ExternalLink className="mt-0.5 size-4 shrink-0 text-[#5b9b8b] transition group-hover:scale-110" />
                  </a>
                ))}
                {sourceDocuments.length === 0 && item.sourceUrl ? (
                  <a
                    className="inline-flex items-center gap-2 text-sm font-extrabold text-[#447569] hover:underline"
                    href={item.sourceUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Otwórz źródło produktu <ExternalLink className="size-4" />
                  </a>
                ) : null}
                {regulatoryNotice ? (
                  <p className="rounded-[22px] bg-stone-100 px-5 py-4 text-xs font-medium leading-6 text-stone-600">
                    {regulatoryNotice}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        <footer className="shrink-0 border-t border-[#e2e8da] bg-white/95 p-4 backdrop-blur lg:hidden">
          <div className="flex gap-2">
            <button
              className="rounded-full px-5 py-3.5 text-sm font-extrabold text-stone-500"
              onClick={onClose}
              type="button"
            >
              Zamknij
            </button>
            {onPrimaryAction ? (
              <button
                className="min-w-0 flex-1 rounded-full bg-[#212822] px-5 py-3.5 text-sm font-extrabold text-white disabled:bg-stone-200 disabled:text-stone-500"
                disabled={primaryActionDisabled}
                onClick={onPrimaryAction}
                type="button"
              >
                {primaryActionText}
              </button>
            ) : null}
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

function ProductHeroVisual({
  brand,
  imageAlt,
  imageCreditUrl,
  imageNote,
  imagePath,
  kind,
  name,
}: {
  readonly brand: string;
  readonly imageAlt: string;
  readonly imageCreditUrl: string | null;
  readonly imageNote: string | null;
  readonly imagePath: string | null;
  readonly kind: BeautyDocsCatalogItem["kind"];
  readonly name: string;
}) {
  const [failedImagePath, setFailedImagePath] = useState<string | null>(null);
  const VisualIcon =
    kind === "DEVICE" ? Cpu : kind === "COSMETIC" ? Sparkles : FlaskConical;
  const background =
    kind === "DEVICE"
      ? "from-[#dfe7e2] via-[#f0f2ed] to-[#d6dfdb]"
      : kind === "COSMETIC"
        ? "from-[#ead9bd] via-[#f8eedc] to-[#ddc39b]"
        : "from-[#e2ead7] via-[#f2f8ea] to-[#cdd9bd]";
  const resolvedImagePath =
    imagePath && failedImagePath !== imagePath ? imagePath : null;

  return (
    <div
      className={`relative isolate flex min-h-[390px] flex-col overflow-hidden bg-gradient-to-br ${background} sm:min-h-[500px] lg:min-h-[620px]`}
    >
      <div className="absolute -left-24 top-8 size-72 rounded-full border border-white/40" />
      <div className="absolute -bottom-24 -right-20 size-80 rounded-full bg-white/30 blur-2xl" />
      <p className="absolute left-6 top-6 z-10 rounded-full border border-white/60 bg-white/55 px-4 py-2 text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#465848] shadow-sm backdrop-blur sm:left-9 sm:top-8">
        {brand}
      </p>
      {resolvedImagePath ? (
        <div className="relative mx-auto mt-16 h-[280px] w-[88%] flex-1 sm:mt-20 sm:h-[400px] lg:h-[500px]">
          <Image
            alt={imageAlt}
            className="object-contain p-6 drop-shadow-[0_28px_28px_rgba(44,64,59,0.17)] transition duration-700 hover:scale-[1.025] sm:p-10 lg:p-14"
            fill
            onError={() => setFailedImagePath(resolvedImagePath)}
            priority
            sizes="(max-width: 1024px) 100vw, 55vw"
            src={resolvedImagePath}
            unoptimized
          />
        </div>
      ) : (
        <div className="relative z-10 m-auto flex max-w-md flex-col items-center px-8 text-center">
          <span className="grid size-20 place-items-center rounded-[28px] bg-white/65 text-[#4b604e] shadow-sm backdrop-blur">
            <VisualIcon className="size-8" />
          </span>
          <p className="mt-6 text-3xl font-extrabold tracking-[-0.04em] text-[#28342a]">
            {name}
          </p>
          <p className="mt-3 text-xs font-bold uppercase tracking-[0.16em] text-[#5b735e]">
            Packshot w przygotowaniu
          </p>
        </div>
      )}
      {imageNote || imageCreditUrl ? (
        <div className="relative z-10 mx-5 mb-5 rounded-2xl border border-white/55 bg-white/55 px-4 py-3 text-[10px] font-semibold leading-4 text-[#516253] backdrop-blur sm:mx-8 sm:mb-7">
          {imageNote ? <p>{imageNote}</p> : null}
          {imageCreditUrl ? (
            <a
              className="mt-1 inline-flex items-center gap-1 font-extrabold text-[#447569] hover:underline"
              href={imageCreditUrl}
              rel="noreferrer"
              target="_blank"
            >
              Oficjalny materiał marki <ExternalLink className="size-3" />
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function ProductPackVisual({
  brand,
  family,
  imageAlt,
  imageFit = "contain",
  imagePath,
  kind,
  name,
  presentation,
  compact = false,
  minimal = false,
}: {
  readonly brand: string;
  readonly family: string;
  readonly imageAlt?: string | null;
  readonly imageFit?: "contain" | "cover";
  readonly imagePath?: string | null;
  readonly kind?: BeautyDocsCatalogItem["kind"];
  readonly name: string;
  readonly presentation: string;
  readonly compact?: boolean;
  readonly minimal?: boolean;
}) {
  const [failedImagePath, setFailedImagePath] = useState<string | null>(null);
  const isMinimalCompact = compact && minimal;

  if (imagePath && failedImagePath !== imagePath) {
    return (
      <div
        className={`font-catalog group relative isolate overflow-hidden ${
          isMinimalCompact
            ? "aspect-[4/3] bg-[#f2f4ef]"
            : `border border-[#e5eadf] bg-[radial-gradient(circle_at_50%_32%,#ffffff_0%,#f8f0ea_58%,#ead9d7_100%)] shadow-[0_18px_45px_rgba(37,57,52,0.12)] ${compact ? "min-h-44 rounded-[22px]" : "min-h-[390px] rounded-[28px]"}`
        }`}
      >
        {!isMinimalCompact ? (
          <div className="absolute left-3 top-3 z-20 max-w-[calc(100%-1.5rem)] rounded-full border border-white/90 bg-white/85 px-3 py-1.5 text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#507355] shadow-sm backdrop-blur">
            {brand}
          </div>
        ) : null}
        <div
          className={`relative w-full ${
            isMinimalCompact ? "h-full" : compact ? "h-44" : "h-[300px]"
          }`}
        >
          <Image
            alt={imageAlt ?? name}
            className={`transition duration-500 group-hover:scale-[1.025] ${
              imageFit === "cover"
                ? "object-cover"
                : `object-contain ${
                    isMinimalCompact ? "p-7" : compact ? "p-4 pt-9" : "p-8 pt-12"
                  }`
            }`}
            fill
            onError={() => setFailedImagePath(imagePath)}
            sizes={
              isMinimalCompact
                ? "(min-width: 1536px) 340px, (min-width: 640px) 42vw, 100vw"
                : compact
                  ? "150px"
                  : "330px"
            }
            src={imagePath}
            unoptimized
          />
        </div>
        {!compact ? (
          <div className="relative z-10 border-t border-white/80 bg-white/80 px-5 py-4 backdrop-blur">
            <p className="text-lg font-extrabold leading-5 tracking-[-0.025em] text-[#173d35]">
              {name}
            </p>
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="text-[11px] font-semibold text-stone-500">
                {family}
              </p>
              <span className="shrink-0 rounded-full bg-[#28342a] px-3 py-1.5 text-[9px] font-extrabold text-white">
                {presentation}
              </span>
            </div>
          </div>
        ) : !isMinimalCompact ? (
          <span className="absolute bottom-3 right-3 z-20 rounded-full border border-white bg-white/90 px-2.5 py-1 text-[9px] font-extrabold text-[#354938] shadow-sm">
            {presentation}
          </span>
        ) : null}
      </div>
    );
  }

  const VisualIcon =
    kind === "DEVICE" ? Cpu : kind === "COSMETIC" ? Sparkles : FlaskConical;
  if (isMinimalCompact) {
    return (
      <div className="font-catalog relative aspect-[4/3] overflow-hidden bg-[#f2f4ef] p-5 text-[#173d35]">
        <div className="flex h-full flex-col border border-[#e6dfdb] bg-white/55 p-5">
          <p className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-stone-500">
            {brand}
          </p>
          <p className="mt-3 max-w-[17rem] text-lg font-extrabold leading-5 tracking-[-0.025em]">
            {name}
          </p>
          <div className="mt-auto flex items-end justify-between gap-3 pt-5">
            <span className="text-[10px] font-bold text-stone-500">
              {presentation}
            </span>
            <VisualIcon className="size-5 text-[#245c4d]" />
          </div>
        </div>
      </div>
    );
  }
  return (
    <div
      className={`font-catalog relative isolate overflow-hidden bg-[#263328] text-white shadow-[0_18px_45px_rgba(37,57,52,0.18)] ${compact ? "min-h-36 rounded-[22px] p-4" : "min-h-72 rounded-[28px] p-6"}`}
    >
      <div className="absolute -right-14 -top-16 size-52 rounded-full bg-[#6eb8a5]/35 blur-2xl" />
      <div className="absolute -bottom-20 -left-20 size-56 rounded-full bg-emerald-400/20 blur-3xl" />
      <div className="relative z-10 flex h-full min-h-[inherit] flex-col">
        <p className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-white/55">
          {brand}
        </p>
        <p
          className={`mt-3 max-w-[16rem] font-extrabold leading-[0.95] tracking-[-0.045em] ${compact ? "text-xl" : "text-4xl"}`}
        >
          {name}
        </p>
        {!compact ? (
          <p className="mt-4 max-w-[15rem] text-xs font-semibold leading-5 text-white/60">
            {family}
          </p>
        ) : null}
        <div className="mt-auto flex items-end justify-between gap-3 pt-6">
          <span className="rounded-full border border-white/15 bg-white/10 px-3 py-2 text-[10px] font-extrabold backdrop-blur">
            {presentation}
          </span>
          <span className="grid size-10 place-items-center rounded-full bg-white text-[#263328]">
            <VisualIcon className="size-4" />
          </span>
        </div>
      </div>
    </div>
  );
}

function ProductChip({
  icon: Icon,
  label,
}: {
  readonly icon: LucideIcon;
  readonly label: string;
}) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-[#dfe4d7] bg-white px-3.5 py-2 text-[11px] font-extrabold text-stone-600 shadow-sm">
      <Icon className="size-3.5 text-[#528e7f]" /> {label}
    </span>
  );
}

function ProductPanel({
  children,
  icon: Icon,
  title,
  tone = "default",
}: {
  readonly children: ReactNode;
  readonly icon: LucideIcon;
  readonly title: string;
  readonly tone?: "default" | "amber" | "red";
}) {
  const panelTone =
    tone === "red"
      ? "border-red-200 bg-red-50/55"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50/55"
        : "border-[#e6dcd7] bg-white";
  const iconTone =
    tone === "red"
      ? "bg-red-100 text-red-700"
      : tone === "amber"
        ? "bg-amber-100 text-amber-800"
        : "bg-[#edf2e5] text-[#54877a]";
  return (
    <section
      className={`h-full rounded-[24px] border p-5 shadow-[0_10px_30px_rgba(49,70,52,0.045)] sm:p-6 ${panelTone}`}
    >
      <h3 className="flex items-center gap-3 text-sm font-extrabold text-[#283329]">
        <span
          className={`grid size-9 place-items-center rounded-2xl ${iconTone}`}
        >
          <Icon className="size-4" />
        </span>
        {title}
      </h3>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function DataRow({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-5 border-b border-stone-100 py-3 first:pt-0 last:border-0 last:pb-0">
      <span className="text-xs font-semibold text-stone-400">{label}</span>
      <span className="text-right text-xs font-extrabold text-stone-700">
        {value}
      </span>
    </div>
  );
}

function PillList({ items }: { readonly items: readonly string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          className="rounded-full bg-emerald-50 px-3 py-2 text-xs font-extrabold text-emerald-800"
          key={item}
        >
          {item}
        </span>
      ))}
    </div>
  );
}

function BulletList({
  items,
  tone,
}: {
  readonly items: readonly string[];
  readonly tone: "amber" | "emerald" | "red" | "stone";
}) {
  const dotClass =
    tone === "red"
      ? "bg-red-600"
      : tone === "amber"
        ? "bg-amber-500"
        : tone === "emerald"
          ? "bg-emerald-600"
          : "bg-stone-400";
  if (items.length === 0) {
    return (
      <p className="text-xs font-medium leading-5 text-stone-500">
        Szczegóły należy sprawdzić w aktualnej instrukcji właściwej dla danego
        rynku.
      </p>
    );
  }
  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li
          className="flex items-start gap-2.5 text-xs font-semibold leading-5 text-stone-700"
          key={item}
        >
          <span className={`mt-2 size-1.5 shrink-0 rounded-full ${dotClass}`} />
          {item}
        </li>
      ))}
    </ul>
  );
}

function detailText(
  details: Readonly<Record<string, unknown>>,
  key: string,
): string | null {
  const value = details[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function detailList(
  details: Readonly<Record<string, unknown>>,
  key: string,
): string[] {
  const value = details[key];
  return Array.isArray(value)
    ? value.filter(
        (entry): entry is string =>
          typeof entry === "string" && entry.trim() !== "",
      )
    : [];
}

function detailBoolean(
  details: Readonly<Record<string, unknown>>,
  key: string,
): boolean | null {
  const value = details[key];
  return typeof value === "boolean" ? value : null;
}

function readSourceDocuments(
  details: Readonly<Record<string, unknown>>,
): ProductSourceDocument[] {
  const value = details.sourceDocuments;
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry))
      return [];
    const source = entry as Readonly<Record<string, unknown>>;
    if (
      typeof source.label !== "string" ||
      typeof source.url !== "string" ||
      !source.url.startsWith("https://") ||
      typeof source.scope !== "string"
    ) {
      return [];
    }
    return [{ label: source.label, url: source.url, scope: source.scope }];
  });
}

function formatReviewDate(value: string): string {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}.${month}.${year}` : value;
}
