import { NextRequest } from "next/server";
import { fetchBeautyDocsAdminClientProfile } from "@/lib/beautydocs-admin-api";
import { isBeautyDocsClientId } from "@/lib/beautydocs-admin-contract";
import {
  beautyDocsBffError,
  beautyDocsBffJson,
} from "@/lib/beautydocs-bff-route";
import { isValidTenantSlug } from "@/lib/tenant-host";

export const runtime = "nodejs";

interface TenantClientRouteContext {
  readonly params: Promise<{ tenantSlug: string; clientId: string }>;
}

export async function GET(
  request: NextRequest,
  context: TenantClientRouteContext,
) {
  const { tenantSlug, clientId } = await context.params;
  if (!isValidTenantSlug(tenantSlug) || !isBeautyDocsClientId(clientId)) {
    return beautyDocsBffError("not_found", 404);
  }

  const result = await fetchBeautyDocsAdminClientProfile(
    tenantSlug,
    clientId,
    request.headers.get("cookie"),
  );

  switch (result.status) {
    case "ok":
      return beautyDocsBffJson(result.data);
    case "unauthorized":
      return beautyDocsBffError("authentication_required", 401);
    case "forbidden":
      return beautyDocsBffError("forbidden", 403);
    case "not-found":
      return beautyDocsBffError("not_found", 404);
    case "invalid-request":
      return beautyDocsBffError("invalid_request", 422);
    default:
      return beautyDocsBffError("unavailable", 503);
  }
}
