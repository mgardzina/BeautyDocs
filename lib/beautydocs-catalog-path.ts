import type {
  BeautyDocsCatalogItem,
  BeautyDocsSalonCatalogItem,
} from "../types/beautydocs-catalog";

const PRODUCT_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,158}[a-z0-9])?$/;
const PROFESSIONAL_PRODUCT_PREFIXES = [
  "professional-product:",
  "professional-device:",
  "professional-cosmetic:",
  "professional-medicine:",
] as const;

type CatalogProductCandidate = Pick<
  BeautyDocsCatalogItem | BeautyDocsSalonCatalogItem,
  "details" | "externalId" | "source"
>;

export function isCatalogProductSlug(value: string): boolean {
  return PRODUCT_SLUG_PATTERN.test(value);
}

export function catalogProductSlug(item: CatalogProductCandidate): string | null {
  if (
    item.source !== "BEAUTYDOCS" ||
    item.details.catalogProfile !== "PROFESSIONAL_PRODUCT" ||
    typeof item.externalId !== "string"
  ) {
    return null;
  }
  const prefix = PROFESSIONAL_PRODUCT_PREFIXES.find((candidate) =>
    item.externalId?.startsWith(candidate),
  );
  if (!prefix) return null;
  const slug = item.externalId.slice(prefix.length);
  return isCatalogProductSlug(slug) ? slug : null;
}

export function catalogProductPath(item: CatalogProductCandidate): string | null {
  const slug = catalogProductSlug(item);
  return slug ? `/katalog/${slug}` : null;
}

export function catalogDetailText(
  details: Readonly<Record<string, unknown>>,
  key: string,
): string | null {
  const value = details[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function catalogDetailList(
  details: Readonly<Record<string, unknown>>,
  key: string,
): string[] {
  const value = details[key];
  return Array.isArray(value)
    ? value.filter(
        (entry): entry is string =>
          typeof entry === "string" && entry.trim().length > 0,
      )
    : [];
}
