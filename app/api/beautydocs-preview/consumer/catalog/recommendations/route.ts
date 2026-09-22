import { NextRequest } from "next/server";
import { fetchConsumerAftercare } from "@/lib/beautydocs-catalog-api";
import { beautyDocsBffError, beautyDocsBffJson } from "@/lib/beautydocs-bff-route";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const tenantSlug = request.nextUrl.searchParams.get("tenantSlug") ?? "";
  const treatmentCode = request.nextUrl.searchParams.get("treatmentCode") ?? "";
  const result = await fetchConsumerAftercare(
    tenantSlug,
    treatmentCode,
    request.headers.get("cookie"),
  );
  if (result.status === "ok") return beautyDocsBffJson(result.data);
  if (result.status === "unauthorized") {
    return beautyDocsBffError("authentication_required", 401);
  }
  if (result.status === "not-found") return beautyDocsBffError("not_found", 404);
  if (result.status === "invalid") return beautyDocsBffError("invalid_request", 400);
  return beautyDocsBffError("unavailable", 503);
}
