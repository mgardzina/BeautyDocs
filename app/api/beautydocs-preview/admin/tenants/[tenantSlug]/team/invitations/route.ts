import { NextRequest } from "next/server";
import { createBeautyDocsStaffInvitation } from "@/lib/beautydocs-admin-api";
import {
  beautyDocsBffError,
  beautyDocsBffJson,
  getValidatedBrowserOrigin,
  readSmallJsonBody,
} from "@/lib/beautydocs-bff-route";
import { parseBeautyDocsStaffInvitationPayload } from "@/lib/beautydocs-team-request";
import { isValidTenantSlug } from "@/lib/tenant-host";

export const runtime = "nodejs";

interface RouteContext {
  readonly params: Promise<{ tenantSlug: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { tenantSlug } = await context.params;
  if (!isValidTenantSlug(tenantSlug)) {
    return beautyDocsBffError("not_found", 404);
  }
  const origin = getValidatedBrowserOrigin(request);
  if (origin === null) return beautyDocsBffError("forbidden", 403);

  try {
    const payload = parseBeautyDocsStaffInvitationPayload(
      await readSmallJsonBody(request),
    );
    if (payload === null) throw new Error("invalid body");
    const result = await createBeautyDocsStaffInvitation(
      tenantSlug,
      payload,
      request.headers.get("cookie"),
      origin,
    );
    switch (result.status) {
      case "ok":
        return beautyDocsBffJson(result.data, { status: 201 });
      case "unauthorized":
        return beautyDocsBffError("authentication_required", 401);
      case "forbidden":
        return beautyDocsBffError("forbidden", 403);
      case "not-found":
        return beautyDocsBffError("not_found", 404);
      case "conflict":
        return beautyDocsBffError("conflict", 409);
      case "invalid-request":
        return beautyDocsBffError("invalid_request", 422);
      default:
        return beautyDocsBffError("unavailable", 503);
    }
  } catch {
    return beautyDocsBffError("invalid_request", 400);
  }
}
