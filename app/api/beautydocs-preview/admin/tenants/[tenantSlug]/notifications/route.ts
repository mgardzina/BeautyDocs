import { NextRequest } from "next/server";
import { fetchBeautyDocsAdminNotifications } from "@/lib/beautydocs-admin-api";
import { beautyDocsBffError, beautyDocsBffJson } from "@/lib/beautydocs-bff-route";
import { isValidTenantSlug } from "@/lib/tenant-host";

export const runtime = "nodejs";

interface Context {
  readonly params: Promise<{ tenantSlug: string }>;
}

export async function GET(request: NextRequest, context: Context) {
  const { tenantSlug } = await context.params;
  if (!isValidTenantSlug(tenantSlug)) {
    return beautyDocsBffError("not_found", 404);
  }
  const result = await fetchBeautyDocsAdminNotifications(
    tenantSlug,
    request.headers.get("cookie"),
  );
  if (result.status === "ok") return beautyDocsBffJson(result.data);
  if (result.status === "unauthorized") {
    return beautyDocsBffError("authentication_required", 401);
  }
  if (result.status === "forbidden") {
    return beautyDocsBffError("forbidden", 403);
  }
  if (result.status === "not-found") {
    return beautyDocsBffError("not_found", 404);
  }
  return beautyDocsBffError("unavailable", 503);
}
