import { NextRequest, NextResponse } from "next/server";
import {
  fetchBeautyDocsAdminClientFormPractitionerSignature,
  signBeautyDocsPractitionerSubmission,
} from "@/lib/beautydocs-admin-api";
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

interface RouteContext {
  readonly params: Promise<{
    tenantSlug: string;
    clientId: string;
    submissionId: string;
  }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { tenantSlug, clientId, submissionId } = await context.params;
  if (
    !isValidTenantSlug(tenantSlug) ||
    !isBeautyDocsClientId(clientId) ||
    !isBeautyDocsSubmissionId(submissionId)
  ) {
    return beautyDocsBffError("not_found", 404);
  }
  const result = await fetchBeautyDocsAdminClientFormPractitionerSignature(
    tenantSlug,
    clientId,
    submissionId,
    request.headers.get("cookie"),
  );
  if (result.status === "ok") {
    return new NextResponse(result.data, {
      status: 200,
      headers: {
        "cache-control": "private, no-store",
        "content-disposition":
          'inline; filename="practitioner-signature.png"',
        "content-security-policy": "default-src 'none'; sandbox",
        "content-type": "image/png",
        "x-content-type-options": "nosniff",
      },
    });
  }
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

export async function POST(request: NextRequest, context: RouteContext) {
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
  try {
    const bodyText = await request.text();
    if (bodyText.length > 700_000) throw new Error("body too large");
    const value = JSON.parse(bodyText) as Record<string, unknown>;
    if (
      typeof value.verificationId !== "string" ||
      typeof value.signature !== "string"
    ) {
      throw new Error("invalid body");
    }
    const result = await signBeautyDocsPractitionerSubmission(
      tenantSlug,
      clientId,
      submissionId,
      {
        verificationId: value.verificationId,
        signature: value.signature,
      },
      request.headers.get("cookie"),
      origin,
      request.headers.get("user-agent"),
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
  } catch {
    return beautyDocsBffError("invalid_request", 400);
  }
}
