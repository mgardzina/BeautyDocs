import { NextRequest } from "next/server";
import { finalizePublicTenantFormClientSignature } from "@/lib/beautydocs-api";
import { isBeautyDocsSubmissionId } from "@/lib/beautydocs-admin-contract";
import { isValidFormSlug } from "@/lib/beautydocs-form-path";
import {
  beautyDocsBffError,
  beautyDocsBffJson,
  getValidatedBrowserOrigin,
} from "@/lib/beautydocs-bff-route";
import { isValidTenantSlug } from "@/lib/tenant-host";

export const runtime = "nodejs";
const MAX_SIGNATURE_BODY = 3 * 1024 * 1024;

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
    body = await request.text();
    if (body.length > MAX_SIGNATURE_BODY) throw new Error("body too large");
    const value = JSON.parse(body) as unknown;
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("invalid body");
    }
  } catch {
    return beautyDocsBffError("invalid_request", 400);
  }
  const result = await finalizePublicTenantFormClientSignature(
    tenantSlug,
    code,
    submissionId,
    body,
    origin,
    request.headers.get("user-agent"),
  );
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
