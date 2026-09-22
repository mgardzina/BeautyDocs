import { NextRequest } from "next/server";
import { fetchBeautyDocsAdminFormPreview } from "@/lib/beautydocs-admin-api";
import {
  beautyDocsBffError,
  beautyDocsBffJson,
} from "@/lib/beautydocs-bff-route";
import { isValidFormSlug } from "@/lib/beautydocs-form-path";
import { isValidTenantSlug } from "@/lib/tenant-host";

export const runtime = "nodejs";

interface TenantFormPreviewRouteContext {
  readonly params: Promise<{ tenantSlug: string; code: string }>;
}

export async function GET(
  request: NextRequest,
  context: TenantFormPreviewRouteContext,
) {
  const { tenantSlug, code } = await context.params;
  if (!isValidTenantSlug(tenantSlug) || !isValidFormSlug(code)) {
    return beautyDocsBffError("not_found", 404);
  }

  const result = await fetchBeautyDocsAdminFormPreview(
    tenantSlug,
    code,
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
