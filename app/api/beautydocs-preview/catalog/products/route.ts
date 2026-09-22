import { fetchBeautyDocsCatalogProducts } from "@/lib/beautydocs-catalog-api";
import { beautyDocsBffError, beautyDocsBffJson } from "@/lib/beautydocs-bff-route";

export const runtime = "nodejs";

export async function GET() {
  const result = await fetchBeautyDocsCatalogProducts();
  if (result.status === "ok") return beautyDocsBffJson(result.data);
  return beautyDocsBffError("unavailable", 503);
}
