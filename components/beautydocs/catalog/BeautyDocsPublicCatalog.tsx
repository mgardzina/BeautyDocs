"use client";
import { activeIntlLocale } from "../../../lib/i18n/active";

import { useT } from "../i18n";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Cpu,
  ExternalLink,
  FileText,
  FlaskConical,
  LoaderCircle,
  PackageSearch,
  Pill,
  Search,
  SlidersHorizontal,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BeautyDocsCatalogSafety } from "@/components/beautydocs/BeautyDocsCatalogSafety";
import { ProductPackVisual } from "@/components/beautydocs/BeautyDocsProductDetailsDialog";
import { BeautyDocsCatalogProductPage } from "@/components/beautydocs/catalog/BeautyDocsCatalogProductPage";
import {
  catalogDetailList,
  catalogDetailText,
  catalogProductPath,
} from "@/lib/beautydocs-catalog-path";
import {
  catalogOfficialReferencePrice,
  catalogLowestPrice,
  catalogPriceComparisonMeta,
  catalogPriceOffers,
  formatCatalogMoney,
  formatPricePln,
} from "@/lib/beautydocs-catalog-offers";
import { relatedCatalogProducts } from "@/lib/beautydocs-catalog-related";
import type {
  BeautyDocsCatalogItem,
  BeautyDocsCatalogKind,
  BeautyDocsMedicineCatalogPage,
} from "@/types/beautydocs-catalog";

type PublicKind = BeautyDocsCatalogKind;
type KindFilter = PublicKind | "ALL";
type SortMode = "DEFAULT" | "POPULARITY_DESC" | "PRICE_ASC" | "PRICE_DESC";
type PriceAvailability = "ALL" | "WITH_PRICE" | "WITHOUT_PRICE";
type MedicineSearchStatus = "IDLE" | "LOADING" | "READY" | "ERROR";
type BrandOption = {
  readonly name: string;
  readonly logoPath: string | null;
};

const kindFilters: readonly {
  readonly value: KindFilter;
  readonly label: string;
  readonly Icon: LucideIcon;
}[] = [
  { value: "ALL", label: "Wszystkie", Icon: PackageSearch },
  { value: "TREATMENT_SUBSTANCE", label: "Preparaty", Icon: FlaskConical },
  { value: "DEVICE", label: "Urządzenia", Icon: Cpu },
  { value: "COSMETIC", label: "Kosmetyki", Icon: Sparkles },
  { value: "MEDICINE", label: "Informacje o lekach", Icon: Pill },
];

const sortOptions: readonly {
  readonly value: SortMode;
  readonly label: string;
}[] = [
  { value: "DEFAULT", label: "Domyślnie" },
  { value: "POPULARITY_DESC", label: "Najpopularniejsze" },
  { value: "PRICE_ASC", label: "Cena: od najniższej" },
  { value: "PRICE_DESC", label: "Cena: od najwyższej" },
];

export function BeautyDocsPublicCatalog({
  items,
  renderItemAction,
  stayInPanel = false,
}: {
  readonly items: readonly BeautyDocsCatalogItem[];
  /** Optional extra control rendered on each card, e.g. an "add to salon" button in the panel. */
  readonly renderItemAction?: (item: BeautyDocsCatalogItem) => ReactNode;
  /**
   * When true (used inside the owner/client panels), "see product" opens an
   * in-place details dialog instead of navigating to the standalone public
   * product page, so viewing a product doesn't leave the dashboard.
   */
  readonly stayInPanel?: boolean;
}) {
  const t = useT();
  const [query, setQuery] = useState("");
  const [openItem, setOpenItem] = useState<BeautyDocsCatalogItem | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [kind, setKind] = useState<KindFilter>("ALL");
  const [brand, setBrand] = useState("ALL");
  const [treatment, setTreatment] = useState("ALL");
  const [sortMode, setSortMode] = useState<SortMode>("DEFAULT");
  const [priceAvailability, setPriceAvailability] =
    useState<PriceAvailability>("ALL");
  const [minimumPrice, setMinimumPrice] = useState("");
  const [maximumPrice, setMaximumPrice] = useState("");
  const [medicineItems, setMedicineItems] = useState<
    readonly BeautyDocsCatalogItem[]
  >([]);
  const [medicineSearchStatus, setMedicineSearchStatus] =
    useState<MedicineSearchStatus>("IDLE");
  const [medicinePage, setMedicinePage] = useState(1);
  const [medicineTotal, setMedicineTotal] = useState(0);
  const [medicineTotalPages, setMedicineTotalPages] = useState(0);
  const [medicalNotice, setMedicalNotice] = useState(
    t("Katalog ma charakter informacyjny. Nie odstawiaj ani nie zmieniaj leku bez konsultacji z lekarzem lub farmaceutą."),
  );
  const medicineQuery = query.trim();
  const isMedicineSearch = kind === "MEDICINE";

  useEffect(() => {
    if (!isMedicineSearch) return;

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setMedicineSearchStatus("LOADING");
      const params = new URLSearchParams({
        q: medicineQuery,
        page: String(medicinePage),
        pageSize: "30",
      });
      void fetch(
        `/api/beautydocs-preview/catalog/medicines?${params.toString()}`,
        {
          headers: { accept: "application/json" },
          signal: controller.signal,
        },
      )
        .then(async (response) => {
          if (!response.ok) throw new Error("medicine catalog unavailable");
          return (await response.json()) as BeautyDocsMedicineCatalogPage;
        })
        .then((result) => {
          if (!Array.isArray(result.items)) {
            throw new Error("invalid medicine catalog response");
          }
          setMedicineItems(result.items.filter((item) => item.kind === "MEDICINE"));
          setMedicineTotal(result.total);
          setMedicineTotalPages(result.totalPages);
          setMedicalNotice(result.medicalNotice);
          setMedicineSearchStatus("READY");
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setMedicineItems([]);
          setMedicineSearchStatus("ERROR");
        });
    }, 300);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [isMedicineSearch, medicinePage, medicineQuery]);

  const activeItems = useMemo(
    () => (isMedicineSearch ? medicineItems : items),
    [isMedicineSearch, items, medicineItems],
  );

  const brands = useMemo(
    () => {
      const options = new Map<string, BrandOption>();
      for (const item of items) {
        if (!item.brand) continue;
        const logoPath = catalogDetailText(item.details, "brandLogoPath");
        const current = options.get(item.brand);
        options.set(item.brand, {
          name: item.brand,
          logoPath: current?.logoPath ?? logoPath,
        });
      }
      return [...options.values()].sort((left, right) =>
        left.name.localeCompare(right.name, "pl"),
      );
    },
    [items],
  );
  const treatments = useMemo(
    () =>
      [
        ...new Set(
          items.flatMap((item) =>
            catalogDetailList(item.details, "treatmentCategories"),
          ),
        ),
      ].sort((left, right) => left.localeCompare(right, "pl")),
    [items],
  );
  const visibleItems = useMemo(() => {
    const phrase = normalizeSearch(query);
    const parsedMinimumPrice = parsePriceFilter(minimumPrice);
    const parsedMaximumPrice = parsePriceFilter(maximumPrice);
    const filtered = activeItems.filter((item) => {
      if (kind !== "ALL" && item.kind !== kind) return false;
      if (brand !== "ALL" && item.brand !== brand) return false;
      const offers = catalogPriceOffers(item.details);
      const treatmentCategories = catalogDetailList(
        item.details,
        "treatmentCategories",
      );
      if (treatment !== "ALL" && !treatmentCategories.includes(treatment)) {
        return false;
      }
      const lowestPrice = catalogLowestPrice(item.details);
      const officialReferencePrice = catalogOfficialReferencePrice(item.details);
      const hasVisiblePrice = lowestPrice !== null || officialReferencePrice !== null;
      if (priceAvailability === "WITH_PRICE" && !hasVisiblePrice) return false;
      if (priceAvailability === "WITHOUT_PRICE" && hasVisiblePrice) return false;
      if (
        parsedMinimumPrice !== null &&
        (lowestPrice === null || lowestPrice < parsedMinimumPrice)
      ) {
        return false;
      }
      if (
        parsedMaximumPrice !== null &&
        (lowestPrice === null || lowestPrice > parsedMaximumPrice)
      ) {
        return false;
      }
      if (!phrase) return true;
      const haystack = normalizeSearch(
        [
          item.name,
          item.brand ?? "",
          item.summary,
          ...treatmentCategories,
          ...catalogDetailList(item.details, "manufacturerUses"),
          ...catalogDetailList(item.details, "keyIngredients"),
          ...catalogDetailList(item.details, "technologies"),
          catalogDetailText(item.details, "commonName") ?? "",
          catalogDetailText(item.details, "activeSubstance") ?? "",
          catalogDetailText(item.details, "pharmaceuticalForm") ?? "",
          catalogDetailText(item.details, "registryNumber") ?? "",
          catalogDetailText(item.details, "atcCode") ?? "",
          ...offers.map((offer) => offer.seller),
        ].join(" "),
      );
      return phrase.split(" ").every((term) => haystack.includes(term));
    });
    if (sortMode === "DEFAULT") return filtered;
    return [...filtered].sort((left, right) => {
      const leftOffers = catalogPriceOffers(left.details);
      const rightOffers = catalogPriceOffers(right.details);
      if (sortMode === "POPULARITY_DESC") {
        return (
          catalogPopularityScore(right, activeItems) -
            catalogPopularityScore(left, activeItems) ||
          rightOffers.length - leftOffers.length ||
          left.name.localeCompare(right.name, "pl")
        );
      }
      const leftPrice = catalogLowestPrice(left.details);
      const rightPrice = catalogLowestPrice(right.details);
      if (leftPrice === null) return 1;
      if (rightPrice === null) return -1;
      return sortMode === "PRICE_ASC" ? leftPrice - rightPrice : rightPrice - leftPrice;
    });
  }, [
    brand,
    activeItems,
    kind,
    maximumPrice,
    minimumPrice,
    priceAvailability,
    query,
    sortMode,
    treatment,
  ]);
  const hasFilters =
    query.trim() !== "" ||
    kind !== "ALL" ||
    brand !== "ALL" ||
    treatment !== "ALL" ||
    sortMode !== "DEFAULT" ||
    priceAvailability !== "ALL" ||
    minimumPrice !== "" ||
    maximumPrice !== "";

  function clearFilters() {
    setQuery("");
    setKind("ALL");
    setBrand("ALL");
    setTreatment("ALL");
    setSortMode("DEFAULT");
    setPriceAvailability("ALL");
    setMinimumPrice("");
    setMaximumPrice("");
  }

  function selectKind(value: KindFilter) {
    setKind(value);
    setBrand("ALL");
    if (value === "MEDICINE") {
      setMedicinePage(1);
      setMedicineSearchStatus("LOADING");
      setTreatment("ALL");
      setSortMode("DEFAULT");
      setPriceAvailability("ALL");
      setMinimumPrice("");
      setMaximumPrice("");
    }
  }

  if (stayInPanel && openItem) {
    return (
      <section aria-labelledby="katalog-produkt" className="bd-container">
        <h2 className="sr-only" id="katalog-produkt">
          {openItem.name}
        </h2>
        <button
          className="inline-flex min-h-11 items-center gap-2 text-sm font-black text-[#245c4d] transition hover:text-[#173d35]"
          onClick={() => setOpenItem(null)}
          type="button"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />{" "}{t("Wróć do katalogu")}
        </button>
        <BeautyDocsCatalogProductPage
          item={openItem}
          onSelectRelated={setOpenItem}
          relatedItems={relatedCatalogProducts(openItem, items)}
        />
      </section>
    );
  }

  return (
    <section aria-labelledby="katalog-lista" className="bd-catalog-browser bd-container">
      <div className="bd-catalog-toolbar">          <label className="bd-catalog-search">
            <span className="sr-only">
              {t("Szukaj")}
            </span>
            <Search
              aria-hidden="true"
              className="absolute bottom-3.5 left-3.5 size-4 text-stone-400"
            />
            <input
              className="mt-2 min-h-11 w-full rounded-lg border border-[#cdd7c6] bg-white py-2.5 pl-10 pr-3 text-sm font-semibold text-[#173d35] outline-none transition placeholder:text-stone-400 focus:border-[#547b59] focus:ring-2 focus:ring-[#245c4d]/10"
              onChange={(event) => {
                setQuery(event.target.value);
                if (isMedicineSearch) {
                  setBrand("ALL");
                  setMedicinePage(1);
                  setMedicineSearchStatus("LOADING");
                }
              }}
              id="katalog-search"
              placeholder={
                isMedicineSearch
                  ? t("Nazwa leku lub substancja…")
                  : t("Produkt lub marka…")
              }
              type="search"
              value={query}
            />
          </label>

<button className="bd-filter-toggle bd-button bd-button-outline" type="button" aria-controls="katalog-filtry" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(value => !value)}><SlidersHorizontal size={17} aria-hidden="true" />{filtersOpen ? t("Ukryj filtry") : t("Pokaż filtry")}</button><p>{t("Porównaj oferty. Znajdź swój produkt.")}</p></div>
      <div className="bd-catalog-layout">
        <aside
          aria-label={t("Filtry katalogu")}
          id="katalog-filtry"
          data-expanded={filtersOpen}
          className="bd-catalog-filters"
        >
          <div className="flex items-center justify-between gap-3 border-b border-[#e4e9de] pb-4">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[#245c4d]">
              <SlidersHorizontal aria-hidden="true" className="size-4" />
              {t("Filtry")}
            </div>
            {hasFilters ? (
              <button
                className="text-xs font-black text-[#245c4d] transition hover:text-[#173d35]"
                onClick={clearFilters}
                type="button"
              >
                {t("Wyczyść")}
              </button>
            ) : null}
          </div>

          <fieldset className="mt-5">
            <legend className="text-xs font-black uppercase tracking-[0.1em] text-stone-500">
              {t("Rodzaj produktu")}
            </legend>
            <div className="mt-2 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-1">
              {kindFilters.map(({ value, label, Icon }) => (
                <button
                  aria-pressed={kind === value}
                  className={`flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm font-bold transition ${
                    kind === value
                      ? "bg-[#173d35] text-white"
                      : "text-stone-600 hover:bg-[#eef3e8] hover:text-[#173d35]"
                  }`}
                  key={value}
                  onClick={() => selectKind(value)}
                  type="button"
                >
                  <Icon aria-hidden="true" className="size-4 shrink-0" />
                  {t(label)}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="mt-5 space-y-4 border-t border-[#e4e9de] pt-5">
            {isMedicineSearch ? (
              <div className="rounded-xl border border-blue-100 bg-blue-50/70 px-3.5 py-3 text-xs font-semibold leading-5 text-blue-950">
                {t("Wszystkie rekordy są dostępne strona po stronie. Wyszukiwanie jest opcjonalne i obejmuje nazwę leku, substancję czynną, numer pozwolenia oraz kod ATC.")}
              </div>
            ) : (
              <>
                <BrandDropdown onChange={setBrand} options={brands} value={brand} />
                <TreatmentDropdown
                  onChange={setTreatment}
                  options={treatments}
                  value={treatment}
                />

                <fieldset>
              <legend className="text-xs font-black uppercase tracking-[0.1em] text-stone-500">
                {t("Dostępność ceny")}
              </legend>
              <div className="mt-2 grid grid-cols-3 gap-1 rounded-lg border border-[#cdd7c6] bg-[#eef3e8] p-1">
                {(
                  [
                    ["ALL", t("Wszystkie")],
                    ["WITH_PRICE", t("Z ceną")],
                    ["WITHOUT_PRICE", t("Bez ceny")],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    aria-pressed={priceAvailability === value}
                    className={`min-h-11 rounded-md px-1.5 text-[11px] font-black transition ${
                      priceAvailability === value
                        ? "bg-white text-[#245c4d] shadow-sm"
                        : "text-stone-500 hover:text-[#173d35]"
                    }`}
                    key={value}
                    onClick={() => {
                      setPriceAvailability(value);
                      if (value === "WITHOUT_PRICE") {
                        setMinimumPrice("");
                        setMaximumPrice("");
                      }
                    }}
                    type="button"
                  >
                    {t(label)}
                  </button>
                ))}
              </div>
                </fieldset>

                <fieldset disabled={priceAvailability === "WITHOUT_PRICE"}>
              <legend className="text-xs font-black uppercase tracking-[0.1em] text-stone-500">
                {t("Cena produktu")}
              </legend>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="relative">
                  <span className="sr-only">{t("Cena minimalna")}</span>
                  <input
                    className="min-h-11 w-full rounded-lg border border-[#cdd7c6] bg-white px-3 pr-8 text-sm font-bold text-[#173d35] outline-none transition placeholder:text-stone-400 focus:border-[#547b59] focus:ring-2 focus:ring-[#245c4d]/10 disabled:cursor-not-allowed disabled:opacity-45"
                    min="0"
                    onChange={(event) => setMinimumPrice(event.target.value)}
                    placeholder={t("Od")}
                    step="10"
                    type="number"
                    value={minimumPrice}
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-400">
                    {t("zł")}
                  </span>
                </label>
                <label className="relative">
                  <span className="sr-only">{t("Cena maksymalna")}</span>
                  <input
                    className="min-h-11 w-full rounded-lg border border-[#cdd7c6] bg-white px-3 pr-8 text-sm font-bold text-[#173d35] outline-none transition placeholder:text-stone-400 focus:border-[#547b59] focus:ring-2 focus:ring-[#245c4d]/10 disabled:cursor-not-allowed disabled:opacity-45"
                    min="0"
                    onChange={(event) => setMaximumPrice(event.target.value)}
                    placeholder={t("Do")}
                    step="10"
                    type="number"
                    value={maximumPrice}
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-400">
                    {t("zł")}
                  </span>
                </label>
              </div>
                </fieldset>
              </>
            )}
          </div>
        </aside>

        <div className="mt-5 min-w-0 lg:mt-0">
          <div className="flex flex-col gap-3 border-y border-[#dce3d5] py-3 sm:flex-row sm:items-center sm:justify-between">
            <p aria-live="polite" className="text-sm font-bold text-stone-500">
              {isMedicineSearch && medicineSearchStatus !== "READY" ? (
                t("Ładujemy Rejestr Produktów Leczniczych…")
              ) : isMedicineSearch ? (
                <>
                  {t("Pokazujemy")}{" "}
                  <strong className="text-[#173d35]">{visibleItems.length}</strong>
                  {" z "}
                  <strong className="text-[#173d35]">
                    {medicineTotal.toLocaleString(activeIntlLocale())}
                  </strong>{" "}
                  {t(recordCountLabel(medicineTotal))}
                </>
              ) : (
                <>
                  {t("Pokazujemy")}{" "}
                  <strong className="text-[#173d35]">{visibleItems.length}</strong>{" "}
                  {t(productCountLabel(visibleItems.length))}
                </>
              )}
            </p>
            {!isMedicineSearch ? (
              <SortDropdown onChange={setSortMode} value={sortMode} />
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs font-black text-blue-800">
                <Check aria-hidden="true" className="size-4" />{" "}{t("Oficjalny rejestr CeZ")}
              </span>
            )}
          </div>

          <h2 className="sr-only" id="katalog-lista">
            {t("Produkty w katalogu BeautyDocs")}
          </h2>
          {isMedicineSearch ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/75 px-4 py-3 text-xs font-semibold leading-5 text-amber-950">
              {medicalNotice}{" "}{t("Wyniki pochodzą z lokalnej kopii oficjalnego Rejestru Produktów Leczniczych CeZ. Leki nie mają tutaj cen ani ofert zakupu.")}
            </div>
          ) : null}
          {isMedicineSearch && medicineSearchStatus !== "READY" && medicineSearchStatus !== "ERROR" ? (
            <div className="mt-5 flex min-h-56 items-center justify-center rounded-2xl border border-[#dce3d5] bg-white">
              <span className="inline-flex items-center gap-3 text-sm font-bold text-stone-600">
                <LoaderCircle aria-hidden="true" className="size-5 animate-spin text-[#245c4d]" />
                {t("Ładujemy produkty lecznicze…")}
              </span>
            </div>
          ) : isMedicineSearch && medicineSearchStatus === "ERROR" ? (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-6 py-10 text-center">
              <p className="font-serif text-2xl text-red-950">{t("Wyszukiwanie leków jest chwilowo niedostępne")}</p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-red-800">
                {t("Spróbuj ponownie za chwilę. Nie pokazujemy niezweryfikowanych zamienników danych RPL.")}
              </p>
            </div>
          ) : visibleItems.length > 0 ? (
            <div className="bd-catalog-grid">
              {visibleItems.map((item) =>
                item.source === "RPL" ? (
                  <PublicMedicineCard
                    action={renderItemAction?.(item)}
                    item={item}
                    key={item.externalId}
                  />
                ) : (
                  <PublicProductCard
                    action={renderItemAction?.(item)}
                    item={item}
                    key={item.externalId}
                    onOpenDetails={stayInPanel ? () => setOpenItem(item) : undefined}
                  />
                ),
              )}
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-dashed border-[#cdd7c6] bg-white px-6 py-14 text-center">
              <p className="font-serif text-2xl text-[#173d35]">{t("Brak pasujących produktów")}</p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-stone-500">
                {t("Zmień markę, obszar zabiegowy albo wpisz krótszą frazę.")}
              </p>
              <button
                className="mt-5 rounded-full bg-[#173d35] px-5 py-3 text-sm font-black text-white"
                onClick={clearFilters}
                type="button"
              >
                {t("Pokaż cały katalog")}
              </button>
            </div>
          )}
          {isMedicineSearch &&
          medicineSearchStatus === "READY" &&
          medicineTotalPages > 1 ? (
            <MedicinePagination
              currentPage={medicinePage}
              onPageChange={(nextPage) => {
                setMedicinePage(nextPage);
                setMedicineSearchStatus("LOADING");
              }}
              totalPages={medicineTotalPages}
            />
          ) : null}
        </div>
      </div>
    </section>
  );
}

function PublicMedicineCard({
  action,
  item,
}: {
  readonly action?: ReactNode;
  readonly item: BeautyDocsCatalogItem;
}) {
  const t = useT();
  const activeSubstance = catalogDetailText(item.details, "activeSubstance");
  const pharmaceuticalForm = catalogDetailText(
    item.details,
    "pharmaceuticalForm",
  );
  const strength = catalogDetailText(item.details, "strength");
  const registryNumber = catalogDetailText(item.details, "registryNumber");
  const characteristicUrl = catalogDetailText(item.details, "characteristicUrl");
  const leafletUrl = catalogDetailText(item.details, "leafletUrl");

  return (
    <article className="flex h-full flex-col rounded-[28px] border border-blue-100 bg-white p-5 shadow-[0_14px_40px_rgba(42,61,56,0.055)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_22px_55px_rgba(42,61,56,0.1)]">
      <div className="flex items-start justify-between gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-800">
          <Pill aria-hidden="true" className="size-5" />
        </span>
        <span className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.1em] text-blue-800">
          {t("RPL · CeZ")}
        </span>
      </div>
      <p className="mt-5 text-[10px] font-black uppercase tracking-[0.14em] text-blue-800">
        {item.brand ?? t("Podmiot odpowiedzialny niepodany")}
      </p>
      <h3 className="mt-2 text-xl font-black leading-6 tracking-[-0.025em] text-[#173d35]">
        {item.name}
      </h3>
      {item.summary ? (
        <p className="mt-3 text-sm leading-6 text-stone-600">{t(item.summary)}</p>
      ) : null}

      <dl className="mt-4 grid gap-3 border-t border-[#e4e9de] pt-4 text-xs sm:grid-cols-2">
        {activeSubstance ? (
          <MedicineFact label={t("Substancja czynna")} value={activeSubstance} />
        ) : null}
        {strength ? <MedicineFact label={t("Moc")} value={strength} /> : null}
        {pharmaceuticalForm ? (
          <MedicineFact label={t("Postać")} value={pharmaceuticalForm} />
        ) : null}
        {registryNumber ? (
          <MedicineFact label={t("Nr pozwolenia")} value={registryNumber} />
        ) : null}
      </dl>

      <BeautyDocsCatalogSafety compact item={item} />

      <div className="mt-auto flex flex-wrap gap-2 border-t border-[#e4e9de] pt-4">
        {characteristicUrl ? (
          <a
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#173d35] px-3 text-xs font-black text-white transition hover:bg-[#245c4d]"
            href={characteristicUrl}
            rel="noreferrer"
            target="_blank"
          >
            <FileText aria-hidden="true" className="size-4" />{" "}{t("ChPL")}
          </a>
        ) : null}
        {leafletUrl ? (
          <a
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-[#cdd7c6] px-3 text-xs font-black text-[#245c4d] transition hover:bg-[#eef3e8]"
            href={leafletUrl}
            rel="noreferrer"
            target="_blank"
          >
            {t("Ulotka")}{" "}<ExternalLink aria-hidden="true" className="size-3.5" />
          </a>
        ) : null}
      </div>
      {action ? <div className="mt-3">{action}</div> : null}
    </article>
  );
}

function MedicineFact({ label, value }: { readonly label: string; readonly value: string }) {
  const t = useT();
  return (
    <div>
      <dt className="font-black text-stone-400">{t(label)}</dt>
      <dd className="mt-1 font-bold leading-5 text-[#173d35]">{value}</dd>
    </div>
  );
}

function MedicinePagination({
  currentPage,
  onPageChange,
  totalPages,
}: {
  readonly currentPage: number;
  readonly onPageChange: (page: number) => void;
  readonly totalPages: number;
}) {
  const t = useT();
  return (
    <nav
      aria-label={t("Strony katalogu leków")}
      className="mt-6 flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-[#dce3d5] bg-white px-4 py-4"
    >
      <button
        className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[#cdd7c6] px-3 text-xs font-black text-[#245c4d] transition hover:bg-[#eef3e8] disabled:cursor-not-allowed disabled:opacity-40"
        disabled={currentPage <= 1}
        onClick={() => onPageChange(currentPage - 1)}
        type="button"
      >
        <ChevronLeft aria-hidden="true" className="size-4" />{" "}{t("Poprzednia")}
      </button>
      <p className="min-w-36 text-center text-xs font-bold text-stone-500">
        {t("Strona")}{" "}<strong className="text-[#173d35]">{currentPage}</strong>{" "}{t("z")}{" "}
        <strong className="text-[#173d35]">
          {totalPages.toLocaleString(activeIntlLocale())}
        </strong>
      </p>
      <button
        className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-[#173d35] px-3 text-xs font-black text-white transition hover:bg-[#245c4d] disabled:cursor-not-allowed disabled:opacity-40"
        disabled={currentPage >= totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        type="button"
      >
        {t("Następna")}{" "}<ChevronRight aria-hidden="true" className="size-4" />
      </button>
    </nav>
  );
}

function PublicProductCard({
  action,
  item,
  onOpenDetails,
}: {
  readonly action?: ReactNode;
  readonly item: BeautyDocsCatalogItem;
  readonly onOpenDetails?: () => void;
}) {
  const t = useT();
  const path = catalogProductPath(item);
  if (!path) return null;
  const presentation =
    catalogDetailText(item.details, "presentation") ?? t("Sprawdź opakowanie");
  const family =
    catalogDetailText(item.details, "productFamily") ?? t("Produkt profesjonalny");
  const imagePath = catalogDetailText(item.details, "imagePath");
  const imageAlt = catalogDetailText(item.details, "imageAlt") ?? item.name;
  const imageFit =
    catalogDetailText(item.details, "imageDisplay") === "COVER"
      ? "cover"
      : "contain";
  const treatmentCategories = catalogDetailList(
    item.details,
    "treatmentCategories",
  );
  const offers = catalogPriceOffers(item.details);
  const lowestPrice = catalogLowestPrice(item.details);
  const officialReferencePrice = catalogOfficialReferencePrice(item.details);
  const comparisonMeta = catalogPriceComparisonMeta(item.details);

  const imageVisual = (
    <ProductPackVisual
      brand={item.brand ?? "BeautyDocs"}
      compact
      family={family}
      imageAlt={imageAlt}
      imageFit={imageFit}
      imagePath={imagePath}
      kind={item.kind}
      minimal
      name={item.name}
      presentation={presentation}
    />
  );

  return (
    <article className="bd-catalog-card group">
      {onOpenDetails ? (
        <button
          aria-label={t("Zobacz {name}", { name: item.name })}
          className="bd-catalog-card-image"
          onClick={onOpenDetails}
          type="button"
        >
          {imageVisual}
        </button>
      ) : (
        <Link
          aria-label={t("Zobacz {name}", { name: item.name })}
          className="bd-catalog-card-image"
          href={path}
        >
          {imageVisual}
        </Link>
      )}
      <div className="bd-catalog-card-body">
        <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#547b59]">
          {item.brand ?? "BeautyDocs"}
        </p>
        <h3 className="mt-1.5 text-[17px] font-black leading-[1.3] tracking-[-0.02em] text-[#173d35]">
          {onOpenDetails ? (
            <button
              className="text-left transition hover:text-[#245c4d]"
              onClick={onOpenDetails}
              type="button"
            >
              {item.name}
            </button>
          ) : (
            <Link className="transition hover:text-[#245c4d]" href={path}>
              {item.name}
            </Link>
          )}
        </h3>
        <p className="mt-2 line-clamp-2 text-[13px] leading-5 text-stone-500">
          {t(item.summary)}
        </p>
        {lowestPrice !== null ? (
          <div className="mt-auto flex items-end justify-between gap-3 pt-4">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.12em] text-stone-400">
                {t("Cena od")}
              </p>
              <p className="mt-0.5 text-lg font-black text-[#173d35]">
                {formatPricePln(lowestPrice)}
              </p>
            </div>
            <span className="text-[10px] font-bold text-stone-500">
              {offers.length} {offers.length === 1 ? "oferta" : "oferty"}
            </span>
          </div>
        ) : officialReferencePrice !== null ? (
          <div className="mt-auto flex items-end justify-between gap-3 pt-4">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.12em] text-stone-400">
                {t("Cena oficjalna")}
              </p>
              <p className="mt-0.5 text-lg font-black text-[#173d35]">
                {formatCatalogMoney(
                  officialReferencePrice.amount,
                  officialReferencePrice.currency,
                )}
              </p>
            </div>
            <span className="text-right text-[10px] font-bold leading-4 text-stone-500">
              {officialReferencePrice.seller}
              <br />
              {t("bez przeliczenia")}
            </span>
          </div>
        ) : comparisonMeta?.status === "INFORMATION_ONLY" ? (
          <p className="mt-auto pt-4 text-xs font-bold text-amber-800">
            {t("Pozycja informacyjna — bez ofert zakupu")}
          </p>
        ) : comparisonMeta?.status === "REQUEST_QUOTE" ? (
          <div className="mt-auto pt-4">
            <p className="text-[9px] font-black uppercase tracking-[0.12em] text-stone-400">
              {item.kind === "DEVICE" ? t("Cena urządzenia") : t("Cena produktu")}
            </p>
            <p className="mt-1 text-sm font-black text-[#245c4d]">
              {t("Wycena indywidualna")}
            </p>
          </div>
        ) : null}
        {treatmentCategories.length > 0 ? (
          <p className="mt-3 line-clamp-1 text-[10px] font-bold text-stone-400">
            {treatmentCategories.slice(0, 2).join(" · ")}
          </p>
        ) : null}
        {onOpenDetails ? (
          <button
            className="mt-4 inline-flex items-center justify-between gap-3 text-xs font-black text-[#245c4d]"
            onClick={onOpenDetails}
            type="button"
          >
            {t("Zobacz produkt")}
            <ArrowRight
              aria-hidden="true"
              className="size-4 transition-transform group-hover:translate-x-1"
            />
          </button>
        ) : (
          <Link
            className="mt-4 inline-flex items-center justify-between gap-3 text-xs font-black text-[#245c4d]"
            href={path}
          >
            {t("Zobacz produkt")}
            <ArrowRight
              aria-hidden="true"
              className="size-4 transition-transform group-hover:translate-x-1"
            />
          </Link>
        )}
        {action ? <div className="mt-3">{action}</div> : null}
      </div>
    </article>
  );
}

function SortDropdown({
  onChange,
  value,
}: {
  readonly onChange: (value: SortMode) => void;
  readonly value: SortMode;
}) {
  const t = useT();
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const selected =
    sortOptions.find((option) => option.value === value) ?? sortOptions[0];

  function selectSortMode(nextValue: SortMode) {
    onChange(nextValue);
    detailsRef.current?.removeAttribute("open");
  }

  return (
    <div className="flex items-center gap-3">
      <span className="hidden text-xs font-black uppercase tracking-[0.1em] text-stone-500 sm:inline">
        {t("Sortuj po")}
      </span>
      <details className="group relative" ref={detailsRef}>
        <summary
          aria-label={t("Sortuj produkty: {label}", { label: selected.label })}
          className="flex min-h-11 min-w-52 cursor-pointer list-none items-center justify-between gap-3 rounded-xl border border-[#cdd7c6] bg-[#f7f8f4] px-3.5 text-sm font-bold text-[#173d35] outline-none transition hover:border-[#c4cbbb] hover:bg-white focus-visible:border-[#547b59] focus-visible:ring-4 focus-visible:ring-[#245c4d]/10 [&::-webkit-details-marker]:hidden"
        >
          <span className="truncate">{t(selected.label)}</span>
          <ChevronDown
            aria-hidden="true"
            className="size-4 shrink-0 text-stone-400 transition group-open:rotate-180"
          />
        </summary>
        <div className="absolute right-0 z-30 mt-2 w-64 rounded-xl border border-[#cdd7c6] bg-white p-2 shadow-[0_18px_45px_rgba(42,61,56,0.16)]">
          {sortOptions.map((option) => (
            <button
              aria-pressed={value === option.value}
              className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-3 text-left text-sm font-bold transition ${
                value === option.value
                  ? "bg-[#eef3e8] text-[#245c4d]"
                  : "text-[#173d35] hover:bg-[#eef3e8]"
              }`}
              key={option.value}
              onClick={() => selectSortMode(option.value)}
              type="button"
            >
              <span>{t(option.label)}</span>
              {value === option.value ? (
                <Check aria-hidden="true" className="size-4 shrink-0 text-[#245c4d]" />
              ) : null}
            </button>
          ))}
        </div>
      </details>
    </div>
  );
}

function TreatmentDropdown({
  onChange,
  options,
  value,
}: {
  readonly onChange: (value: string) => void;
  readonly options: readonly string[];
  readonly value: string;
}) {
  const t = useT();
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [query, setQuery] = useState("");
  const filteredOptions = options.filter((option) =>
    normalizeSearch(option).includes(normalizeSearch(query)),
  );

  function selectTreatment(nextValue: string) {
    onChange(nextValue);
    setQuery("");
    detailsRef.current?.removeAttribute("open");
  }

  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.1em] text-stone-500">
        {t("Zabieg lub obszar")}
      </p>
      <details className="group mt-2" ref={detailsRef}>
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-lg border border-[#cdd7c6] bg-white px-3.5 text-sm font-bold text-[#173d35] outline-none transition hover:border-[#c3c9ba] focus-visible:border-[#547b59] focus-visible:ring-2 focus-visible:ring-[#245c4d]/10 [&::-webkit-details-marker]:hidden">
          <span className="truncate">
            {value === "ALL" ? t("Wszystkie zabiegi i obszary") : value}
          </span>
          <ChevronDown
            aria-hidden="true"
            className="size-4 shrink-0 text-stone-400 transition group-open:rotate-180"
          />
        </summary>
        <div className="mt-2 rounded-lg border border-[#cdd7c6] bg-white p-2 shadow-[0_12px_30px_rgba(42,61,56,0.1)]">
          <label className="relative block">
            <span className="sr-only">{t("Wyszukaj zabieg lub obszar")}</span>
            <Search
              aria-hidden="true"
              className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400"
            />
            <input
              className="min-h-11 w-full rounded-lg border border-[#dce3d5] bg-[#f7f8f4] pl-9 pr-3 text-sm font-semibold text-[#173d35] outline-none focus:border-[#547b59]"
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("Wyszukaj zabieg…")}
              type="search"
              value={query}
            />
          </label>
          <div className="mt-1 max-h-52 overflow-y-auto">
            <button
              className="flex min-h-11 w-full items-center justify-between rounded-lg px-2.5 text-left text-sm font-bold text-[#173d35] transition hover:bg-[#eef3e8]"
              onClick={() => selectTreatment("ALL")}
              type="button"
            >
              {t("Wszystkie zabiegi i obszary")}
              {value === "ALL" ? (
                <Check aria-hidden="true" className="size-4 text-[#245c4d]" />
              ) : null}
            </button>
            {filteredOptions.map((option) => (
              <button
                className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-2.5 text-left text-sm font-bold text-[#173d35] transition hover:bg-[#eef3e8]"
                key={option}
                onClick={() => selectTreatment(option)}
                type="button"
              >
                <span>{option}</span>
                {value === option ? (
                  <Check aria-hidden="true" className="size-4 shrink-0 text-[#245c4d]" />
                ) : null}
              </button>
            ))}
            {filteredOptions.length === 0 ? (
              <p className="px-2.5 py-3 text-xs font-semibold text-stone-500">
                {t("Brak pasującego zabiegu.")}
              </p>
            ) : null}
          </div>
        </div>
      </details>
    </div>
  );
}

function BrandDropdown({
  onChange,
  options,
  value,
}: {
  readonly onChange: (value: string) => void;
  readonly options: readonly BrandOption[];
  readonly value: string;
}) {
  const t = useT();
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [query, setQuery] = useState("");
  const selected = options.find((option) => option.name === value) ?? null;
  const filteredOptions = options.filter((option) =>
    normalizeSearch(option.name).includes(normalizeSearch(query)),
  );

  function selectBrand(nextValue: string) {
    onChange(nextValue);
    setQuery("");
    detailsRef.current?.removeAttribute("open");
  }

  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.1em] text-stone-500">
        {t("Marka")}
      </p>
      <details className="group mt-2" ref={detailsRef}>
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-lg border border-[#cdd7c6] bg-white px-3.5 text-sm font-bold normal-case tracking-normal text-[#173d35] outline-none transition hover:border-[#c3c9ba] focus-visible:border-[#547b59] focus-visible:ring-2 focus-visible:ring-[#245c4d]/10 [&::-webkit-details-marker]:hidden">
          <span className="flex min-w-0 items-center gap-2.5">
            {selected?.logoPath ? (
              <Image
                alt=""
                className="h-5 w-auto max-w-24 object-contain"
                height={28}
                src={selected.logoPath}
                width={100}
              />
            ) : null}
            <span className="truncate">{selected?.name ?? t("Wszystkie marki")}</span>
          </span>
          <ChevronDown
            aria-hidden="true"
            className="size-4 shrink-0 text-stone-400 transition group-open:rotate-180"
          />
        </summary>
        <div className="mt-2 rounded-lg border border-[#cdd7c6] bg-white p-2 shadow-[0_12px_30px_rgba(42,61,56,0.1)]">
          <label className="relative block">
            <span className="sr-only">{t("Wyszukaj markę")}</span>
            <Search
              aria-hidden="true"
              className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400"
            />
            <input
              className="min-h-11 w-full rounded-lg border border-[#dce3d5] bg-[#f7f8f4] pl-9 pr-3 text-sm font-semibold text-[#173d35] outline-none focus:border-[#547b59]"
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("Wyszukaj markę…")}
              type="search"
              value={query}
            />
          </label>
          <div className="mt-1 max-h-56 overflow-y-auto">
            <button
              className="flex min-h-11 w-full items-center justify-between rounded-lg px-2.5 text-left text-sm font-bold text-[#173d35] transition hover:bg-[#eef3e8]"
              onClick={() => selectBrand("ALL")}
              type="button"
            >
              {t("Wszystkie marki")}
              {value === "ALL" ? (
                <Check aria-hidden="true" className="size-4 text-[#245c4d]" />
              ) : null}
            </button>
            {filteredOptions.map((option) => (
              <button
                className="flex min-h-12 w-full items-center justify-between gap-3 rounded-lg px-2.5 text-left text-sm font-bold text-[#173d35] transition hover:bg-[#eef3e8]"
                key={option.name}
                onClick={() => selectBrand(option.name)}
                type="button"
              >
                <span className="flex min-w-0 items-center gap-3">
                  {option.logoPath ? (
                    <span className="flex h-8 w-20 shrink-0 items-center justify-center rounded-lg border border-[#e8ece2] bg-white px-2">
                      <Image
                        alt={`${option.name} — logo`}
                        className="h-5 w-auto max-w-16 object-contain"
                        height={28}
                        src={option.logoPath}
                        width={76}
                      />
                    </span>
                  ) : (
                    <span className="flex h-8 w-20 shrink-0 items-center rounded-lg bg-[#eef3e8] px-2 text-[9px] font-black uppercase tracking-[0.06em] text-stone-500">
                      {option.name}
                    </span>
                  )}
                  <span className="truncate">{option.name}</span>
                </span>
                {value === option.name ? (
                  <Check aria-hidden="true" className="size-4 shrink-0 text-[#245c4d]" />
                ) : null}
              </button>
            ))}
            {filteredOptions.length === 0 ? (
              <p className="px-2.5 py-3 text-xs font-semibold text-stone-500">
                {t("Brak pasującej marki.")}
              </p>
            ) : null}
          </div>
        </div>
      </details>
    </div>
  );
}

function normalizeSearch(value: string): string {
  return value
    .toLocaleLowerCase("pl")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/ł/g, "l")
    .trim();
}

function parsePriceFilter(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function catalogPopularityScore(
  item: BeautyDocsCatalogItem,
  items: readonly BeautyDocsCatalogItem[],
): number {
  const explicitScore = item.details.popularityScore;
  if (typeof explicitScore === "number" && Number.isFinite(explicitScore)) {
    return explicitScore;
  }
  const originalPosition = items.findIndex(
    (candidate) => candidate.externalId === item.externalId,
  );
  const editorialPriority =
    originalPosition < 0 ? 0 : (items.length - originalPosition) / items.length;
  return catalogPriceOffers(item.details).length * 10 + editorialPriority;
}

function productCountLabel(count: number): string {
  if (count === 1) return "produkt";
  if (count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14)) {
    return "produkty";
  }
  return "produktów";
}

function recordCountLabel(count: number): string {
  if (count === 1) return "rekordu";
  return "rekordów";
}
