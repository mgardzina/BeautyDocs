import { NextRequest } from "next/server";
import { fetchBeautyDocsAdminChats } from "@/lib/beautydocs-admin-api";
import { beautyDocsBffError, beautyDocsBffJson } from "@/lib/beautydocs-bff-route";
import { isValidTenantSlug } from "@/lib/tenant-host";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: { readonly params: Promise<{ readonly tenantSlug: string }> },
) {
  const { tenantSlug } = await context.params;
  if (!isValidTenantSlug(tenantSlug)) return beautyDocsBffError("not_found", 404);
  const result = await fetchBeautyDocsAdminChats(tenantSlug, request.headers.get("cookie"));
  if (result.status === "ok") return beautyDocsBffJson(result.data);
  if (result.status === "unauthorized") return beautyDocsBffError("authentication_required", 401);
  if (result.status === "forbidden") return beautyDocsBffError("forbidden", 403);
  return beautyDocsBffError("unavailable", 503);
}
