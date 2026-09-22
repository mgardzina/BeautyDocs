import { NextRequest } from "next/server";
import { searchBeautyDocsCatalog } from "@/lib/beautydocs-catalog-api";
import { beautyDocsBffError, beautyDocsBffJson } from "@/lib/beautydocs-bff-route";
import type { BeautyDocsCatalogKind } from "@/types/beautydocs-catalog";

export const runtime = "nodejs";

const kinds = new Set<BeautyDocsCatalogKind>([
  "MEDICINE",
  "TREATMENT_SUBSTANCE",
  "DEVICE",
  "COSMETIC",
]);

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") ?? "";
  const rawKind = request.nextUrl.searchParams.get("kind");
  if (query.length > 100 || (rawKind !== null && !kinds.has(rawKind as BeautyDocsCatalogKind))) {
    return beautyDocsBffError("invalid_request", 400);
  }
  const result = await searchBeautyDocsCatalog(
    query,
    rawKind as BeautyDocsCatalogKind | null,
  );
  if (result.status === "ok") return beautyDocsBffJson(result.data);
  if (result.status === "invalid") return beautyDocsBffError("invalid_request", 400);
  return beautyDocsBffError("unavailable", 503);
}
