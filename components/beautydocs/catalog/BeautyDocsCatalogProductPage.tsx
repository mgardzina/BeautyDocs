"use client";

import {
  ArrowRight,
  BadgeCheck,
  Check,
  ExternalLink,
  Package,
  Sun,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  ProductApplicationMap,
  type ProductApplicationArea,
} from "@/components/beautydocs/catalog/ProductApplicationMap";
import {
  ProductMediaGallery,
  type ProductGalleryImage,
} from "@/components/beautydocs/catalog/ProductMediaGallery";
import { ProductPriceComparison } from "@/components/beautydocs/catalog/ProductPriceComparison";
import {
  catalogDetailList,
  catalogDetailText,
  catalogProductPath,
} from "@/lib/beautydocs-catalog-path";
import {
  catalogPriceComparisonMeta,
  catalogPriceOffers,
  formatPricePln,
} from "@/lib/beautydocs-catalog-offers";
import type { BeautyDocsCatalogItem } from "@/types/beautydocs-catalog";

interface ProductSourceDocument {
  readonly label: string;
  readonly scope: string;
  readonly url: string;
}

/**
 * The full editorial product page content — gallery, price comparison,
 * application map, editorial sections, safety and sources — shared between
 * the public standalone product page (`/katalog/[slug]`) and the in-panel
 * product view. `onSelectRelated` lets a caller keep related-product
 * navigation inside its own view (the panels) instead of following a link
 * to the public site; omit it to get plain links (the public page's default).
 */
export function BeautyDocsCatalogProductPage({
  item,
  relatedItems,
  onSelectRelated,
}: {
  readonly item: BeautyDocsCatalogItem;
  readonly relatedItems: readonly BeautyDocsCatalogItem[];
  readonly onSelectRelated?: (item: BeautyDocsCatalogItem) => void;
}) {
  const details = item.details;
  const brand = item.brand ?? "BeautyDocs";
  const presentation = catalogDetailText(details, "presentation") ?? "Sprawdź opakowanie";
  const family = catalogDetailText(details, "productFamily") ?? fallbackFamily(item);
  const category = catalogDetailText(details, "productCategory") ?? fallbackCategory(item);
  const fallbackImagePath = catalogDetailText(details, "imagePath");
  const fallbackImageAlt = catalogDetailText(details, "imageAlt") ?? item.name;
  const galleryImages = readProductImages(details, fallbackImagePath, fallbackImageAlt);
  const applicationAreas = readApplicationAreas(details);
  const storage = catalogDetailText(details, "storage");
  const usageNotice = catalogDetailText(details, "usageNotice");
  const safetyScope = catalogDetailText(details, "safetyScope");
  const regulatoryNotice = catalogDetailText(details, "regulatoryNotice");
  const reviewedAt = catalogDetailText(details, "lastReviewedAt");
  const manufacturerUses = catalogDetailList(details, "manufacturerUses");
  const treatmentCategories = catalogDetailList(details, "treatmentCategories");
  const activeIngredients = catalogDetailList(details, "activeIngredients");
  const keyIngredients = catalogDetailList(details, "keyIngredients");
  const technologies = catalogDetailList(details, "technologies");
  const wavelengths = catalogDetailList(details, "wavelengths");
  const features = catalogDetailList(details, "features");
  const availableSizes = catalogDetailList(details, "availableSizes");
  const skinTypes = catalogDetailList(details, "skinTypes");
  const qualificationAlerts = catalogDetailList(details, "qualificationAlerts");
  const commonReactions = catalogDetailList(details, "commonReactions");
  const seriousRisks = catalogDetailList(details, "seriousRisks");
  const sourceDocuments = readSourceDocuments(details);
  const priceOffers = catalogPriceOffers(details);
  const priceComparisonMeta = catalogPriceComparisonMeta(details);
  const hasPriceComparison = priceOffers.length > 0 || priceComparisonMeta !== null;
  const containsLidocaine =
    typeof details.containsLidocaine === "boolean" ? details.containsLidocaine : null;
  const ingredientValues = activeIngredients.length > 0 ? activeIngredients : keyIngredients;
  const hasSafety =
    qualificationAlerts.length > 0 || commonReactions.length > 0 || seriousRisks.length > 0;

  return (
    <>
      <article>
        <section className="mt-6 grid items-start gap-10 lg:grid-cols-[1.04fr_0.96fr] lg:gap-14 xl:gap-20">
          <ProductMediaGallery images={galleryImages} name={item.name} />

          <div className="py-2 lg:sticky lg:top-28 lg:py-10">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="text-[11px] font-black uppercase tracking-[0.16em] text-[#245c4d]">
                {category}
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700">
                <BadgeCheck aria-hidden="true" className="size-4" /> Zweryfikowane źródła
              </span>
            </div>

            <p className="mt-8 text-xs font-black uppercase tracking-[0.22em] text-stone-500">
              {brand}
            </p>
            <PriceHeroCallout meta={priceComparisonMeta} offers={priceOffers} />
            <h1 className="mt-3 max-w-2xl font-serif text-5xl font-medium leading-[0.98] tracking-[-0.045em] text-[#211b1e] sm:text-6xl lg:text-[4.25rem]">
              {item.name}
            </h1>
            <p className="mt-7 max-w-2xl text-base leading-8 text-stone-600 sm:text-lg">
              {item.summary}
            </p>

            <dl className="mt-9 grid grid-cols-2 border-y border-[#dce3d5] sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
              <HeroFact label="Format" value={presentation} />
              <HeroFact label="Rodzina" value={family} />
              {containsLidocaine !== null ? (
                <HeroFact
                  label="Lidokaina"
                  value={containsLidocaine ? "Tak" : "Nie"}
                />
              ) : null}
              {reviewedAt ? (
                <HeroFact label="Aktualizacja" value={formatReviewDate(reviewedAt)} />
              ) : null}
            </dl>

            {treatmentCategories.length > 0 ? (
              <div className="mt-7">
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-stone-400">
                  Kategoria i obszar
                </p>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
                  {treatmentCategories.map((value) => (
                    <span
                      className="border-b border-[#bda5ad] pb-1 text-xs font-bold text-[#66414e]"
                      key={value}
                    >
                      {value}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            <nav
              aria-label="Sekcje karty produktu"
              className="mt-9 flex flex-wrap gap-x-6 gap-y-3 border-t border-[#dce3d5] pt-5 text-xs font-black text-[#4c3a41]"
            >
              <a className="hover:text-[#245c4d]" href="#charakterystyka">
                Charakterystyka
              </a>
              {applicationAreas.length > 0 ? (
                <a className="hover:text-[#245c4d]" href="#obszary">
                  Obszary zastosowania
                </a>
              ) : null}
              {hasPriceComparison ? (
                <a className="hover:text-[#245c4d]" href="#ceny">
                  Porównaj ceny
                </a>
              ) : null}
              {hasSafety ? (
                <a className="hover:text-[#245c4d]" href="#bezpieczenstwo">
                  Bezpieczeństwo
                </a>
              ) : null}
              <a className="hover:text-[#245c4d]" href="#zrodla">
                Źródła
              </a>
            </nav>
          </div>
        </section>

        <ProductPriceComparison details={details} productName={item.name} />

        <ProductApplicationMap areas={applicationAreas} />

        <EditorialSection
          eyebrow="Informacje producenta"
          id="charakterystyka"
          title="Zastosowanie i charakterystyka"
        >
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
            <p className="max-w-xl text-lg leading-8 text-stone-600">{item.summary}</p>
            <NumberedList items={manufacturerUses} />
          </div>
        </EditorialSection>

        {technologies.length > 0 || wavelengths.length > 0 || features.length > 0 ? (
          <EditorialSection eyebrow="Parametry" title="Technologia i możliwości">
            <div className="grid gap-10 lg:grid-cols-3">
              <DefinitionList label="Technologie" values={technologies} />
              <DefinitionList label="Długości fal" values={wavelengths} />
              <DefinitionList label="Cechy urządzenia" values={features} />
            </div>
          </EditorialSection>
        ) : null}

        {ingredientValues.length > 0 || availableSizes.length > 0 || skinTypes.length > 0 ? (
          <EditorialSection eyebrow="Dane produktu" title="Składniki i warianty">
            <div className="grid gap-10 lg:grid-cols-3">
              <DefinitionList label="Kluczowe składniki" values={ingredientValues} />
              <DefinitionList label="Dostępne pojemności" values={availableSizes} />
              <DefinitionList label="Typy skóry" values={skinTypes} />
            </div>
          </EditorialSection>
        ) : null}

        {usageNotice || storage ? (
          <EditorialSection eyebrow="Praktyczne informacje" title="Stosowanie i przechowywanie">
            <div className="grid gap-8 lg:grid-cols-2 lg:gap-16">
              {usageNotice ? <TextDatum label="Stosowanie" value={usageNotice} icon={Sun} /> : null}
              {storage ? <TextDatum label="Przechowywanie" value={storage} icon={Package} /> : null}
            </div>
          </EditorialSection>
        ) : null}

        {hasSafety ? (
          <section
            aria-labelledby="bezpieczenstwo-tytul"
            className="mt-20 overflow-hidden rounded-[34px] bg-[#292124] px-6 py-10 text-white sm:px-10 sm:py-14 lg:px-14"
            id="bezpieczenstwo"
          >
            <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#cadbb9]">
                  Ważne przed użyciem
                </p>
                <h2
                  className="mt-3 font-serif text-3xl font-medium sm:text-4xl"
                  id="bezpieczenstwo-tytul"
                >
                  Bezpieczeństwo bez skrótów
                </h2>
                {safetyScope ? (
                  <p className="mt-5 text-sm leading-7 text-white/60">{safetyScope}</p>
                ) : null}
              </div>
              <div className="grid gap-8 sm:grid-cols-2">
                <SafetyColumn label="Uwagi do kwalifikacji" values={qualificationAlerts} />
                <div className="space-y-8">
                  <SafetyColumn label="Częste reakcje klasy produktów" values={commonReactions} />
                  <SafetyColumn danger label="Poważne ryzyka klasy produktów" values={seriousRisks} />
                </div>
              </div>
            </div>
          </section>
        ) : null}

        <EditorialSection eyebrow="Weryfikacja" id="zrodla" title="Źródła produktu">
          <div className="divide-y divide-[#dce3d5] border-y border-[#dce3d5]">
            {sourceDocuments.map((source) => (
              <a
                className="group grid gap-2 py-5 transition hover:text-[#245c4d] sm:grid-cols-[0.8fr_1.2fr_auto] sm:items-center sm:gap-8"
                href={source.url}
                key={`${source.url}:${source.label}`}
                rel="noreferrer"
                target="_blank"
              >
                <span className="text-sm font-black">{source.label}</span>
                <span className="text-xs leading-5 text-stone-500">{source.scope}</span>
                <ExternalLink
                  aria-hidden="true"
                  className="size-4 text-stone-400 transition group-hover:text-[#245c4d]"
                />
              </a>
            ))}
            {sourceDocuments.length === 0 ? (
              <a
                className="flex items-center justify-between gap-4 py-5 text-sm font-black hover:text-[#245c4d]"
                href={item.sourceUrl}
                rel="noreferrer"
                target="_blank"
              >
                {item.sourceLabel} <ExternalLink aria-hidden="true" className="size-4" />
              </a>
            ) : null}
          </div>
          {regulatoryNotice ? (
            <p className="mt-6 max-w-4xl text-xs leading-6 text-stone-500">
              {regulatoryNotice}
            </p>
          ) : null}
        </EditorialSection>
      </article>

      <p className="mt-14 border-l-2 border-[#547b59] pl-4 text-xs leading-6 text-stone-500">
        Karta ma charakter informacyjny. Nie zastępuje aktualnej instrukcji używania,
        etykiety, szkolenia ani indywidualnej kwalifikacji przeprowadzonej przez
        uprawnionego specjalistę.
      </p>

      {relatedItems.length > 0 ? (
        <section className="mt-20" aria-labelledby="podobne-produkty">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.17em] text-[#245c4d]">
                Odkrywaj dalej
              </p>
              <h2 className="mt-2 font-serif text-3xl sm:text-4xl" id="podobne-produkty">
                Podobne produkty
              </h2>
            </div>
            {onSelectRelated ? null : (
              <Link
                className="hidden items-center gap-2 text-sm font-black text-[#245c4d] sm:inline-flex"
                href="/katalog"
              >
                Cały katalog <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            )}
          </div>
          <div className="mt-7 grid gap-5 md:grid-cols-3">
            {relatedItems.map((relatedItem) => (
              <RelatedProduct
                item={relatedItem}
                key={relatedItem.externalId}
                onSelect={onSelectRelated ? () => onSelectRelated(relatedItem) : undefined}
              />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

function PriceHeroCallout({
  meta,
  offers,
}: {
  readonly meta: ReturnType<typeof catalogPriceComparisonMeta>;
  readonly offers: ReturnType<typeof catalogPriceOffers>;
}) {
  if (!meta && offers.length === 0) return null;
  if (meta?.status === "INFORMATION_ONLY") {
    return (
      <a
        className="mt-7 flex items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-amber-950 transition hover:bg-amber-100"
        href="#ceny"
      >
        <span>
          <span className="block text-[9px] font-black uppercase tracking-[0.14em] text-amber-800/65">
            Status produktu
          </span>
          <span className="mt-1 block text-sm font-black">
            Informacje i ograniczenia sprzedaży
          </span>
        </span>
        <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
      </a>
    );
  }

  const availableOffers = offers.filter(
    (offer) => offer.availability !== "OUT_OF_STOCK",
  );
  const lowestPrice = availableOffers[0]?.pricePln ?? null;
  if (lowestPrice === null) return null;

  return (
    <a
      className="mt-7 flex items-center justify-between gap-5 rounded-2xl bg-[#173d35] px-5 py-4 text-white shadow-[0_16px_35px_rgba(48,36,42,0.16)] transition hover:bg-[#245c4d]"
      href="#ceny"
    >
      <span>
        <span className="block text-[9px] font-black uppercase tracking-[0.15em] text-white/55">
          Najniższa cena produktu
        </span>
        <span className="mt-1 block font-serif text-3xl">
          od {formatPricePln(lowestPrice)}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-2 text-xs font-black">
        Porównaj {availableOffers.length} {offerCountLabel(availableOffers.length)}
        <ArrowRight aria-hidden="true" className="size-4" />
      </span>
    </a>
  );
}

function offerCountLabel(count: number): string {
  if (count === 1) return "ofertę";
  if (count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14)) {
    return "oferty";
  }
  return "ofert";
}

function HeroFact({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="min-w-0 border-b border-[#dce3d5] py-4 pr-4 odd:border-r odd:pl-0 even:pl-4 sm:border-b-0 sm:border-r sm:pl-4 sm:first:pl-0 sm:last:border-r-0 lg:border-b lg:odd:border-r lg:last:border-b-0 xl:border-b-0">
      <dt className="text-[9px] font-black uppercase tracking-[0.13em] text-stone-400">
        {label}
      </dt>
      <dd className="mt-1 text-xs font-black leading-5 text-[#173d35]">
        {value}
      </dd>
    </div>
  );
}

function EditorialSection({
  children,
  eyebrow,
  id,
  title,
}: {
  readonly children: ReactNode;
  readonly eyebrow: string;
  readonly id?: string;
  readonly title: string;
}) {
  return (
    <section className="mt-20 scroll-mt-28 border-t border-[#dce3d5] pt-12 sm:pt-16" id={id}>
      <div className="mb-9">
        <p className="text-[11px] font-black uppercase tracking-[0.17em] text-[#245c4d]">
          {eyebrow}
        </p>
        <h2 className="mt-2 font-serif text-3xl font-medium text-[#173d35] sm:text-4xl">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

function NumberedList({ items }: { readonly items: readonly string[] }) {
  if (items.length === 0) {
    return (
      <p className="text-sm leading-7 text-stone-500">
        Szczegóły należy sprawdzić w aktualnych materiałach producenta.
      </p>
    );
  }
  return (
    <ol className="divide-y divide-[#dce3d5] border-y border-[#dce3d5]">
      {items.map((value, index) => (
        <li className="flex gap-5 py-5 text-sm leading-7 text-stone-700" key={value}>
          <span className="font-serif text-2xl italic text-[#547b59]">
            {String(index + 1).padStart(2, "0")}
          </span>
          {value}
        </li>
      ))}
    </ol>
  );
}

function DefinitionList({
  label,
  values,
}: {
  readonly label: string;
  readonly values: readonly string[];
}) {
  if (values.length === 0) return null;
  return (
    <div>
      <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-stone-400">
        {label}
      </h3>
      <ul className="mt-4 divide-y divide-[#dce3d5] border-t border-[#dce3d5]">
        {values.map((value) => (
          <li className="flex gap-3 py-3 text-sm leading-6 text-stone-600" key={value}>
            <Check aria-hidden="true" className="mt-1 size-4 shrink-0 text-[#547b59]" />
            {value}
          </li>
        ))}
      </ul>
    </div>
  );
}

function TextDatum({
  icon: Icon,
  label,
  value,
}: {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div className="border-t border-[#dce3d5] pt-5">
      <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-[#42634e]">
        <Icon aria-hidden="true" className="size-4" /> {label}
      </h3>
      <p className="mt-3 text-sm leading-7 text-stone-600">{value}</p>
    </div>
  );
}

function SafetyColumn({
  danger = false,
  label,
  values,
}: {
  readonly danger?: boolean;
  readonly label: string;
  readonly values: readonly string[];
}) {
  if (values.length === 0) return null;
  return (
    <div>
      <h3
        className={`text-[10px] font-black uppercase tracking-[0.14em] ${
          danger ? "text-[#ffb9b9]" : "text-[#cadbb9]"
        }`}
      >
        {label}
      </h3>
      <ul className="mt-4 space-y-3">
        {values.map((value) => (
          <li className="flex gap-3 text-xs font-semibold leading-6 text-white/75" key={value}>
            <span
              className={`mt-2.5 size-1.5 shrink-0 rounded-full ${
                danger ? "bg-red-400" : "bg-[#cadbb9]"
              }`}
            />
            {value}
          </li>
        ))}
      </ul>
    </div>
  );
}

function RelatedProduct({
  item,
  onSelect,
}: {
  readonly item: BeautyDocsCatalogItem;
  readonly onSelect?: () => void;
}) {
  const path = catalogProductPath(item);
  const imagePath = catalogDetailText(item.details, "imagePath");
  const imageAlt = catalogDetailText(item.details, "imageAlt") ?? item.name;
  if (!path && !onSelect) return null;
  const content = (
    <>
      <div className="relative min-h-72 overflow-hidden rounded-[26px] bg-[#eef1e7]">
        {imagePath ? (
          <Image
            alt={imageAlt}
            className="object-contain p-6 transition duration-500 group-hover:scale-105"
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            src={imagePath}
            unoptimized
          />
        ) : null}
      </div>
      <p className="mt-4 text-[10px] font-black uppercase tracking-[0.14em] text-[#547b59]">
        {item.brand}
      </p>
      <h3 className="mt-1 text-lg font-black leading-6 text-[#173d35] transition group-hover:text-[#245c4d]">
        {item.name}
      </h3>
      <span className="mt-3 inline-flex items-center gap-2 text-xs font-black text-[#245c4d]">
        Zobacz produkt
        <ArrowRight
          aria-hidden="true"
          className="size-4 transition-transform group-hover:translate-x-1"
        />
      </span>
    </>
  );
  if (onSelect) {
    return (
      <button className="group block text-left" onClick={onSelect} type="button">
        {content}
      </button>
    );
  }
  if (!path) return null;
  return (
    <Link className="group block" href={path}>
      {content}
    </Link>
  );
}

function fallbackCategory(item: BeautyDocsCatalogItem): string {
  if (item.kind === "DEVICE") return "Urządzenie profesjonalne";
  if (item.kind === "COSMETIC") return "Kosmetyk / dermokosmetyk";
  return "Preparat zabiegowy";
}

function fallbackFamily(item: BeautyDocsCatalogItem): string {
  if (item.kind === "DEVICE") return "Platforma zabiegowa";
  if (item.kind === "COSMETIC") return "Pielęgnacja skóry";
  return "Preparat profesjonalny";
}

function readProductImages(
  details: Readonly<Record<string, unknown>>,
  fallbackPath: string | null,
  fallbackAlt: string,
): ProductGalleryImage[] {
  const candidates = Array.isArray(details.productImages) ? details.productImages : [];
  const images = candidates.flatMap((entry): ProductGalleryImage[] => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const record = entry as Readonly<Record<string, unknown>>;
    if (
      typeof record.path !== "string" ||
      !record.path.startsWith("/beautydocs/catalog/") ||
      typeof record.alt !== "string"
    ) {
      return [];
    }
    const scale =
      typeof record.scale === "number" && record.scale >= 0.6 && record.scale <= 2
        ? record.scale
        : 1;
    return [
      {
        path: record.path,
        alt: record.alt,
        fit: record.fit === "cover" ? "cover" : "contain",
        label: typeof record.label === "string" ? record.label : "Produkt",
        note: typeof record.note === "string" ? record.note : null,
        scale,
      },
    ];
  });
  const uniqueImages = images.filter(
    (image, index) => images.findIndex((candidate) => candidate.path === image.path) === index,
  );
  if (uniqueImages.length > 0) return uniqueImages;
  return fallbackPath
    ? [
        {
          path: fallbackPath,
          alt: fallbackAlt,
          fit: "contain",
          label: "Produkt",
          note: null,
          scale: 1,
        },
      ]
    : [];
}

function readApplicationAreas(
  details: Readonly<Record<string, unknown>>,
): ProductApplicationArea[] {
  if (!Array.isArray(details.applicationAreas)) return [];
  return details.applicationAreas.flatMap((entry): ProductApplicationArea[] => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const record = entry as Readonly<Record<string, unknown>>;
    if (
      typeof record.code !== "string" ||
      !/^[A-Z_]{2,40}$/.test(record.code) ||
      typeof record.label !== "string" ||
      record.label.trim().length === 0
    ) {
      return [];
    }
    return [{ code: record.code, label: record.label.trim() }];
  });
}

function readSourceDocuments(
  details: Readonly<Record<string, unknown>>,
): ProductSourceDocument[] {
  if (!Array.isArray(details.sourceDocuments)) return [];
  return details.sourceDocuments.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const record = entry as Readonly<Record<string, unknown>>;
    if (
      typeof record.label !== "string" ||
      typeof record.scope !== "string" ||
      typeof record.url !== "string" ||
      !record.url.startsWith("https://")
    ) {
      return [];
    }
    return [{ label: record.label, scope: record.scope, url: record.url }];
  });
}

function formatReviewDate(value: string): string {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}.${month}.${year}` : value;
}
