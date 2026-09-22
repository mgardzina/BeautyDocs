import { NextRequest } from "next/server";
import { submitPublicTenantForm } from "@/lib/beautydocs-api";
import { isValidFormSlug } from "@/lib/beautydocs-form-path";
import {
  beautyDocsBffError,
  beautyDocsBffJson,
  getValidatedBrowserOrigin,
} from "@/lib/beautydocs-bff-route";
import { isValidTenantSlug } from "@/lib/tenant-host";

export const runtime = "nodejs";

// Signatures are base64 PNGs, so allow a larger body than the admin BFF.
const MAX_SUBMISSION_BODY = 3 * 1024 * 1024;

interface PublicFormSubmitRouteContext {
  readonly params: Promise<{ tenantSlug: string; code: string }>;
}

export async function POST(
  request: NextRequest,
  context: PublicFormSubmitRouteContext,
) {
  const { tenantSlug, code } = await context.params;
  if (!isValidTenantSlug(tenantSlug) || !isValidFormSlug(code)) {
    return beautyDocsBffError("not_found", 404);
  }

  const origin = getValidatedBrowserOrigin(request);
  if (origin === null) {
    return beautyDocsBffError("forbidden", 403);
  }

  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) {
    return beautyDocsBffError("invalid_request", 400);
  }
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_SUBMISSION_BODY) {
    return beautyDocsBffError("invalid_request", 413);
  }

  let bodyText: string;
  try {
    bodyText = await request.text();
    if (bodyText.length > MAX_SUBMISSION_BODY) {
      return beautyDocsBffError("invalid_request", 413);
    }
    const parsed = JSON.parse(bodyText) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error("invalid body");
    }
  } catch {
    return beautyDocsBffError("invalid_request", 400);
  }

  const result = await submitPublicTenantForm(tenantSlug, code, bodyText, origin);
  switch (result.status) {
    case "ok":
      return beautyDocsBffJson(result.data, { status: 201 });
    case "invalid":
      return beautyDocsBffError("invalid_request", 422);
    case "forbidden":
      return beautyDocsBffError("forbidden", 403);
    case "not-found":
      return beautyDocsBffError("not_found", 404);
    default:
      return beautyDocsBffError("unavailable", 503);
  }
}
