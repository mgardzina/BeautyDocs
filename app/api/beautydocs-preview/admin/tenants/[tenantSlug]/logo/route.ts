import { NextRequest } from "next/server";
import { updateBeautyDocsTenantLogo } from "@/lib/beautydocs-admin-api";
import {
  beautyDocsBffError,
  beautyDocsBffJson,
  getValidatedBrowserOrigin,
} from "@/lib/beautydocs-bff-route";
import { isValidTenantSlug } from "@/lib/tenant-host";

export const runtime = "nodejs";

const MAX_LOGO_BODY = 400_000;

interface Context {
  readonly params: Promise<{ tenantSlug: string }>;
}

export async function PUT(request: NextRequest, context: Context) {
  const { tenantSlug } = await context.params;
  if (!isValidTenantSlug(tenantSlug)) return beautyDocsBffError("not_found", 404);
  const origin = getValidatedBrowserOrigin(request);
  if (origin === null) return beautyDocsBffError("forbidden", 403);

  let dataUrl: string | null;
  try {
    const declaredLength = Number(request.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_LOGO_BODY) {
      throw new Error("too large");
    }
    const text = await request.text();
    if (text.length > MAX_LOGO_BODY) throw new Error("too large");
    const body = JSON.parse(text) as unknown;
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      throw new Error("invalid body");
    }
    const raw = (body as Record<string, unknown>).dataUrl;
    if (raw === null || raw === undefined) {
      dataUrl = null;
    } else if (typeof raw === "string" && raw.length <= MAX_LOGO_BODY) {
      dataUrl = raw;
    } else {
      throw new Error("invalid dataUrl");
    }
  } catch {
    return beautyDocsBffError("invalid_request", 400);
  }

  const result = await updateBeautyDocsTenantLogo(
    tenantSlug,
    dataUrl,
    request.headers.get("cookie"),
    origin,
  );
  if (result.status === "ok") return beautyDocsBffJson(result.data);
  if (result.status === "unauthorized") {
    return beautyDocsBffError("authentication_required", 401);
  }
  if (result.status === "forbidden") return beautyDocsBffError("forbidden", 403);
  if (result.status === "not-found") return beautyDocsBffError("not_found", 404);
  if (result.status === "invalid-request") {
    return beautyDocsBffError("invalid_request", 422);
  }
  return beautyDocsBffError("unavailable", 503);
}
