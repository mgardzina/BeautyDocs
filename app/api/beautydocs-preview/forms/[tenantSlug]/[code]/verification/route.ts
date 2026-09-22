import { NextRequest } from "next/server";
import { startPublicTenantFormClientVerification } from "@/lib/beautydocs-api";
import { isValidFormSlug } from "@/lib/beautydocs-form-path";
import {
  beautyDocsBffError,
  beautyDocsBffJson,
  getValidatedBrowserOrigin,
} from "@/lib/beautydocs-bff-route";
import { isValidTenantSlug } from "@/lib/tenant-host";

export const runtime = "nodejs";
const MAX_DRAFT_BODY = 512 * 1024;

interface Context {
  readonly params: Promise<{ tenantSlug: string; code: string }>;
}

export async function POST(request: NextRequest, context: Context) {
  const { tenantSlug, code } = await context.params;
  if (!isValidTenantSlug(tenantSlug) || !isValidFormSlug(code)) {
    return beautyDocsBffError("not_found", 404);
  }
  const origin = getValidatedBrowserOrigin(request);
  if (origin === null) return beautyDocsBffError("forbidden", 403);

  let body: string;
  try {
    body = await readJsonBody(request, MAX_DRAFT_BODY);
  } catch {
    return beautyDocsBffError("invalid_request", 400);
  }
  const result = await startPublicTenantFormClientVerification(
    tenantSlug,
    code,
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
    case "rate-limited":
      return beautyDocsBffError("invalid_request", 429);
    default:
      return beautyDocsBffError("unavailable", 503);
  }
}

async function readJsonBody(request: NextRequest, max: number): Promise<string> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new Error("invalid content type");
  }
  const body = await request.text();
  if (body.length > max) throw new Error("body too large");
  const value = JSON.parse(body) as unknown;
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("invalid body");
  }
  return body;
}
