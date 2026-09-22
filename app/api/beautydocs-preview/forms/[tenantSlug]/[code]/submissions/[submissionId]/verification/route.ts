import { NextRequest } from "next/server";
import {
  confirmPublicTenantFormClientVerification,
  resendPublicTenantFormClientVerification,
} from "@/lib/beautydocs-api";
import {
  isBeautyDocsSubmissionId,
} from "@/lib/beautydocs-admin-contract";
import { isValidFormSlug } from "@/lib/beautydocs-form-path";
import {
  beautyDocsBffError,
  beautyDocsBffJson,
  getValidatedBrowserOrigin,
  readSmallJsonBody,
} from "@/lib/beautydocs-bff-route";
import { isValidTenantSlug } from "@/lib/tenant-host";

export const runtime = "nodejs";

interface Context {
  readonly params: Promise<{
    tenantSlug: string;
    code: string;
    submissionId: string;
  }>;
}

export async function POST(request: NextRequest, context: Context) {
  const { tenantSlug, code, submissionId } = await context.params;
  if (
    !isValidTenantSlug(tenantSlug) ||
    !isValidFormSlug(code) ||
    !isBeautyDocsSubmissionId(submissionId)
  ) {
    return beautyDocsBffError("not_found", 404);
  }
  const origin = getValidatedBrowserOrigin(request);
  if (origin === null) return beautyDocsBffError("forbidden", 403);

  let body: string;
  try {
    const value = await readSmallJsonBody(request);
    body = JSON.stringify(value);
  } catch {
    return beautyDocsBffError("invalid_request", 400);
  }
  const result = await confirmPublicTenantFormClientVerification(
    tenantSlug,
    code,
    submissionId,
    body,
    origin,
    request.headers.get("user-agent"),
  );
  switch (result.status) {
    case "ok":
      return beautyDocsBffJson(result.data);
    case "invalid-code":
      return beautyDocsBffError("invalid_code", 400);
    case "forbidden":
      return beautyDocsBffError("forbidden", 403);
    case "not-found":
      return beautyDocsBffError("not_found", 404);
    default:
      return beautyDocsBffError("unavailable", 503);
  }
}

export async function PUT(request: NextRequest, context: Context) {
  const { tenantSlug, code, submissionId } = await context.params;
  if (
    !isValidTenantSlug(tenantSlug) ||
    !isValidFormSlug(code) ||
    !isBeautyDocsSubmissionId(submissionId)
  ) {
    return beautyDocsBffError("not_found", 404);
  }
  const origin = getValidatedBrowserOrigin(request);
  if (origin === null) return beautyDocsBffError("forbidden", 403);

  let body: string;
  try {
    const value = await readSmallJsonBody(request);
    body = JSON.stringify(value);
  } catch {
    return beautyDocsBffError("invalid_request", 400);
  }
  const result = await resendPublicTenantFormClientVerification(
    tenantSlug,
    code,
    submissionId,
    body,
    origin,
    request.headers.get("user-agent"),
  );
  switch (result.status) {
    case "ok":
      return beautyDocsBffJson(result.data);
    case "invalid":
      return beautyDocsBffError("invalid_request", 422);
    case "rate-limited":
      return beautyDocsBffError("invalid_request", 429);
    case "forbidden":
      return beautyDocsBffError("forbidden", 403);
    case "not-found":
      return beautyDocsBffError("not_found", 404);
    default:
      return beautyDocsBffError("unavailable", 503);
  }
}
