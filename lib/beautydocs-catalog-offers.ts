export type CatalogOfferAvailability =
  | "IN_STOCK"
  | "OUT_OF_STOCK"
  | "PREORDER"
  | "UNKNOWN";

export interface CatalogPriceOffer {
  readonly availability: CatalogOfferAvailability;
  readonly pricePln: number;
  readonly seller: string;
  readonly shippingPricePln: number | null;
  readonly sourceType: "STORE" | "COMPARATOR" | "MARKETPLACE";
  readonly updatedAt: string;
  readonly url: string;
}

export interface CatalogPriceComparisonMeta {
  readonly currency: "PLN";
  readonly notice: string;
  readonly quoteUrl: string | null;
  readonly status:
    | "ACTIVE"
    | "REGULATORY_CHECK"
    | "INFORMATION_ONLY"
    | "REQUEST_QUOTE";
  readonly updatedAt: string;
}

export interface CatalogOfficialReferencePrice {
  readonly amount: number;
  readonly availability: string;
  readonly currency: string;
  readonly originalAmount: number | null;
  readonly seller: string;
  readonly updatedAt: string;
  readonly url: string;
}

const allowedAvailability = new Set<CatalogOfferAvailability>([
  "IN_STOCK",
  "OUT_OF_STOCK",
  "PREORDER",
  "UNKNOWN",
]);
const allowedSources = new Set<CatalogPriceOffer["sourceType"]>([
  "STORE",
  "COMPARATOR",
  "MARKETPLACE",
]);

export function catalogPriceOffers(
  details: Readonly<Record<string, unknown>>,
): CatalogPriceOffer[] {
  if (!Array.isArray(details.offers)) return [];

  return details.offers
    .flatMap((entry): CatalogPriceOffer[] => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
      const offer = entry as Readonly<Record<string, unknown>>;
      const pricePln = finiteNonNegative(offer.pricePln);
      const shippingPricePln =
        offer.shippingPricePln === null
          ? null
          : finiteNonNegative(offer.shippingPricePln);
      if (
        typeof offer.seller !== "string" ||
        offer.seller.trim().length === 0 ||
        pricePln === null ||
        typeof offer.url !== "string" ||
        !offer.url.startsWith("https://") ||
        typeof offer.updatedAt !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(offer.updatedAt) ||
        typeof offer.availability !== "string" ||
        !allowedAvailability.has(offer.availability as CatalogOfferAvailability) ||
        typeof offer.sourceType !== "string" ||
        !allowedSources.has(offer.sourceType as CatalogPriceOffer["sourceType"]) ||
        (offer.shippingPricePln !== null && shippingPricePln === null)
      ) {
        return [];
      }
      return [
        {
          seller: offer.seller.trim(),
          pricePln,
          shippingPricePln,
          availability: offer.availability as CatalogOfferAvailability,
          sourceType: offer.sourceType as CatalogPriceOffer["sourceType"],
          updatedAt: offer.updatedAt,
          url: offer.url,
        },
      ];
    })
    .sort((left, right) => {
      if (left.availability === "OUT_OF_STOCK" && right.availability !== "OUT_OF_STOCK") {
        return 1;
      }
      if (right.availability === "OUT_OF_STOCK" && left.availability !== "OUT_OF_STOCK") {
        return -1;
      }
      return left.pricePln - right.pricePln;
    });
}

export function catalogPriceComparisonMeta(
  details: Readonly<Record<string, unknown>>,
): CatalogPriceComparisonMeta | null {
  const raw = details.priceComparison;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const meta = raw as Readonly<Record<string, unknown>>;
  if (
    meta.currency !== "PLN" ||
    (meta.status !== "ACTIVE" &&
      meta.status !== "REGULATORY_CHECK" &&
      meta.status !== "INFORMATION_ONLY" &&
      meta.status !== "REQUEST_QUOTE") ||
    typeof meta.updatedAt !== "string" ||
    typeof meta.notice !== "string"
  ) {
    return null;
  }
  const quoteUrl =
    typeof meta.quoteUrl === "string" && meta.quoteUrl.startsWith("https://")
      ? meta.quoteUrl
      : null;
  if (meta.status === "REQUEST_QUOTE" && quoteUrl === null) return null;
  return {
    currency: "PLN",
    status: meta.status,
    updatedAt: meta.updatedAt,
    notice: meta.notice,
    quoteUrl,
  };
}

export function catalogLowestPrice(
  details: Readonly<Record<string, unknown>>,
): number | null {
  const offer = catalogPriceOffers(details).find(
    (candidate) => candidate.availability !== "OUT_OF_STOCK",
  );
  return offer?.pricePln ?? null;
}

export function catalogOfferTotal(offer: CatalogPriceOffer): number | null {
  return offer.shippingPricePln === null
    ? null
    : Math.round((offer.pricePln + offer.shippingPricePln) * 100) / 100;
}

export function catalogOfficialReferencePrice(
  details: Readonly<Record<string, unknown>>,
): CatalogOfficialReferencePrice | null {
  const raw = details.officialReferencePrice;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const reference = raw as Readonly<Record<string, unknown>>;
  const amount = finiteNonNegative(reference.amount);
  const originalAmount =
    reference.originalAmount === null
      ? null
      : finiteNonNegative(reference.originalAmount);
  if (
    amount === null ||
    (reference.originalAmount !== null && originalAmount === null) ||
    typeof reference.currency !== "string" ||
    !/^[A-Z]{3}$/.test(reference.currency) ||
    typeof reference.seller !== "string" ||
    reference.seller.trim().length === 0 ||
    typeof reference.availability !== "string" ||
    typeof reference.url !== "string" ||
    !reference.url.startsWith("https://") ||
    typeof reference.updatedAt !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(reference.updatedAt)
  ) {
    return null;
  }
  return {
    amount,
    originalAmount,
    currency: reference.currency,
    seller: reference.seller.trim(),
    availability: reference.availability,
    url: reference.url,
    updatedAt: reference.updatedAt,
  };
}

export function formatPricePln(value: number): string {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatCatalogMoney(value: number, currency: string): string {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function finiteNonNegative(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}
