import { NextRequest } from "next/server";
import { beautyDocsBffError, beautyDocsBffJson } from "@/lib/beautydocs-bff-route";
import { fetchBeautyDocsMedicineCatalog } from "@/lib/beautydocs-catalog-api";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") ?? "";
  const page = Number(request.nextUrl.searchParams.get("page") ?? "1");
  const pageSize = Number(request.nextUrl.searchParams.get("pageSize") ?? "30");
  const result = await fetchBeautyDocsMedicineCatalog(query, page, pageSize);

  if (result.status === "ok") return beautyDocsBffJson(result.data);
  if (result.status === "invalid") {
    return beautyDocsBffError("invalid_request", 400);
  }
  return beautyDocsBffError("unavailable", 503);
}
