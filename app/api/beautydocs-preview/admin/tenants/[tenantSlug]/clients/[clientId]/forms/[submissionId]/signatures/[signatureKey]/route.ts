import { NextRequest, NextResponse } from "next/server";
import { fetchBeautyDocsAdminClientFormSignature } from "@/lib/beautydocs-admin-api";
import {
  isBeautyDocsClientId,
  isBeautyDocsSignatureKey,
  isBeautyDocsSubmissionId,
} from "@/lib/beautydocs-admin-contract";
import { beautyDocsBffError } from "@/lib/beautydocs-bff-route";
import { isValidTenantSlug } from "@/lib/tenant-host";

export const runtime = "nodejs";

interface TenantClientFormSignatureRouteContext {
  readonly params: Promise<{
    tenantSlug: string;
    clientId: string;
    submissionId: string;
    signatureKey: string;
  }>;
}

export async function GET(
  request: NextRequest,
  context: TenantClientFormSignatureRouteContext,
) {
  const { tenantSlug, clientId, submissionId, signatureKey } =
    await context.params;
  if (
    !isValidTenantSlug(tenantSlug) ||
    !isBeautyDocsClientId(clientId) ||
    !isBeautyDocsSubmissionId(submissionId) ||
    !isBeautyDocsSignatureKey(signatureKey)
  ) {
    return beautyDocsBffError("not_found", 404);
  }

  const result = await fetchBeautyDocsAdminClientFormSignature(
    tenantSlug,
    clientId,
    submissionId,
    signatureKey,
    request.headers.get("cookie"),
  );

  switch (result.status) {
    case "ok":
      return new NextResponse(result.data, {
        status: 200,
        headers: {
          "cache-control": "private, no-store",
          "content-disposition": 'inline; filename="signature.png"',
          "content-security-policy": "default-src 'none'; sandbox",
          "content-type": "image/png",
          "x-content-type-options": "nosniff",
        },
      });
    case "unauthorized":
      return beautyDocsBffError("authentication_required", 401);
    case "forbidden":
      return beautyDocsBffError("forbidden", 403);
    case "not-found":
      return beautyDocsBffError("not_found", 404);
    default:
      return beautyDocsBffError("unavailable", 503);
  }
}
