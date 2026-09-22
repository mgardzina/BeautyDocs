import { NextRequest } from "next/server";
import { searchConsumerSalons } from "@/lib/beautydocs-consumer-api";
import { beautyDocsBffError, beautyDocsBffJson } from "@/lib/beautydocs-bff-route";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("query") ?? "";
  const slug = request.nextUrl.searchParams.get("slug") ?? "";
  if (query.length > 100 || slug.length > 63) {
    return beautyDocsBffError("invalid_request", 400);
  }
  const result = await searchConsumerSalons(
    query,
    request.headers.get("cookie"),
    slug || undefined,
  );
  if (result.status === "ok") return beautyDocsBffJson(result.data);
  if (result.status === "unauthorized") {
    return beautyDocsBffError("authentication_required", 401);
  }
  if (result.status === "invalid") {
    return beautyDocsBffError("invalid_request", 400);
  }
  return beautyDocsBffError("unavailable", 503);
}
