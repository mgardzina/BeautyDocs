import type { BeautyDocsCatalogItem } from "@/types/beautydocs-catalog";

/**
 * Plain data helper (no "use client") so both the server-rendered public
 * product page and client-rendered in-panel product view can call it.
 */
export function relatedCatalogProducts(
  item: BeautyDocsCatalogItem,
  allItems: readonly BeautyDocsCatalogItem[],
): BeautyDocsCatalogItem[] {
  return allItems
    .filter((candidate) => candidate.externalId !== item.externalId)
    .sort((left, right) => {
      const leftScore = Number(left.brand === item.brand) * 2 + Number(left.kind === item.kind);
      const rightScore =
        Number(right.brand === item.brand) * 2 + Number(right.kind === item.kind);
      return rightScore - leftScore || left.name.localeCompare(right.name, "pl");
    })
    .slice(0, 3);
}
