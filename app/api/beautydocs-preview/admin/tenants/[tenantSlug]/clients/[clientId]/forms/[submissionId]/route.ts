import { NextRequest } from "next/server";
import { fetchBeautyDocsAdminClientFormDetail } from "@/lib/beautydocs-admin-api";
import {
  isBeautyDocsClientId,
  isBeautyDocsSubmissionId,
} from "@/lib/beautydocs-admin-contract";
import {
  beautyDocsBffError,
  beautyDocsBffJson,
} from "@/lib/beautydocs-bff-route";
import { isValidTenantSlug } from "@/lib/tenant-host";

export const runtime = "nodejs";

interface TenantClientFormRouteContext {
  readonly params: Promise<{
    tenantSlug: string;
    clientId: string;
    submissionId: string;
  }>;
}

export async function GET(
  request: NextRequest,
  context: TenantClientFormRouteContext,
) {
  const { tenantSlug, clientId, submissionId } = await context.params;
  if (
    !isValidTenantSlug(tenantSlug) ||
    !isBeautyDocsClientId(clientId) ||
    !isBeautyDocsSubmissionId(submissionId)
  ) {
    return beautyDocsBffError("not_found", 404);
  }

  const result = await fetchBeautyDocsAdminClientFormDetail(
    tenantSlug,
    clientId,
    submissionId,
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
