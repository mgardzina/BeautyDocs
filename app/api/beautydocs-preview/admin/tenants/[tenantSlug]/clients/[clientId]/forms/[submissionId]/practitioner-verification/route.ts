import { NextRequest } from "next/server";
import { startBeautyDocsPractitionerVerification } from "@/lib/beautydocs-admin-api";
import {
  isBeautyDocsClientId,
  isBeautyDocsSubmissionId,
} from "@/lib/beautydocs-admin-contract";
import {
  beautyDocsBffError,
  beautyDocsBffJson,
  getValidatedBrowserOrigin,
} from "@/lib/beautydocs-bff-route";
import { isValidTenantSlug } from "@/lib/tenant-host";

export const runtime = "nodejs";

interface Context {
  readonly params: Promise<{
    tenantSlug: string;
    clientId: string;
    submissionId: string;
  }>;
}

export async function POST(request: NextRequest, context: Context) {
  const { tenantSlug, clientId, submissionId } = await context.params;
  if (
    !isValidTenantSlug(tenantSlug) ||
    !isBeautyDocsClientId(clientId) ||
    !isBeautyDocsSubmissionId(submissionId)
  ) {
    return beautyDocsBffError("not_found", 404);
  }
  const origin = getValidatedBrowserOrigin(request);
  if (origin === null) return beautyDocsBffError("forbidden", 403);
  const result = await startBeautyDocsPractitionerVerification(
    tenantSlug,
    clientId,
    submissionId,
    request.headers.get("cookie"),
    origin,
    request.headers.get("user-agent"),
  );
  return signingResponse(result);
}

function signingResponse(
  result: Awaited<ReturnType<typeof startBeautyDocsPractitionerVerification>>,
) {
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
