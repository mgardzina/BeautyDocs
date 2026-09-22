import { NextRequest } from "next/server";
import { setBeautyDocsAdminFormEnabled } from "@/lib/beautydocs-admin-api";
import { isValidFormSlug } from "@/lib/beautydocs-form-path";
import {
  beautyDocsBffError,
  beautyDocsBffJson,
  getValidatedBrowserOrigin,
  readSmallJsonBody,
} from "@/lib/beautydocs-bff-route";
import { isValidTenantSlug } from "@/lib/tenant-host";

export const runtime = "nodejs";

interface TenantFormRouteContext {
  readonly params: Promise<{ tenantSlug: string; code: string }>;
}

export async function PUT(
  request: NextRequest,
  context: TenantFormRouteContext,
) {
  const { tenantSlug, code } = await context.params;
  if (!isValidTenantSlug(tenantSlug) || !isValidFormSlug(code)) {
    return beautyDocsBffError("not_found", 404);
  }

  const origin = getValidatedBrowserOrigin(request);
  if (origin === null) {
    return beautyDocsBffError("forbidden", 403);
  }

  let enabled: boolean;
  let durationMinutes: number | undefined;
  try {
    const body = await readSmallJsonBody(request);
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      throw new Error("invalid body");
    }
    const record = body as Record<string, unknown>;
    const keys = Object.keys(record);
    if (
      keys.some((key) => key !== "enabled" && key !== "durationMinutes") ||
      typeof record.enabled !== "boolean" ||
      (record.durationMinutes !== undefined &&
        (typeof record.durationMinutes !== "number" ||
          !Number.isInteger(record.durationMinutes) ||
          record.durationMinutes < 15 ||
          record.durationMinutes > 480 ||
          record.durationMinutes % 15 !== 0))
    ) {
      throw new Error("invalid body");
    }
    enabled = record.enabled;
    durationMinutes = record.durationMinutes as number | undefined;
  } catch {
    return beautyDocsBffError("invalid_request", 400);
  }

  const result = await setBeautyDocsAdminFormEnabled(
    tenantSlug,
    code,
    enabled,
    durationMinutes,
    request.headers.get("cookie"),
    origin,
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
