import { NextRequest } from "next/server";
import { updateBeautyDocsAdminTeamMember } from "@/lib/beautydocs-admin-api";
import { isBeautyDocsTeamMemberId } from "@/lib/beautydocs-admin-contract";
import {
  beautyDocsBffError,
  beautyDocsBffJson,
  getValidatedBrowserOrigin,
  readSmallJsonBody,
} from "@/lib/beautydocs-bff-route";
import { parseBeautyDocsTeamMemberUpdatePayload } from "@/lib/beautydocs-team-request";
import { isValidTenantSlug } from "@/lib/tenant-host";

export const runtime = "nodejs";

interface TeamMemberRouteContext {
  readonly params: Promise<{ tenantSlug: string; memberId: string }>;
}

export async function PUT(
  request: NextRequest,
  context: TeamMemberRouteContext,
) {
  const { tenantSlug, memberId } = await context.params;
  if (
    !isValidTenantSlug(tenantSlug) ||
    !isBeautyDocsTeamMemberId(memberId)
  ) {
    return beautyDocsBffError("not_found", 404);
  }
  const origin = getValidatedBrowserOrigin(request);
  if (origin === null) {
    return beautyDocsBffError("forbidden", 403);
  }
  try {
    const body = await readSmallJsonBody(request);
    const payload = parseBeautyDocsTeamMemberUpdatePayload(body);
    if (payload === null) throw new Error("invalid body");
    const result = await updateBeautyDocsAdminTeamMember(
      tenantSlug,
      memberId,
      payload,
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
  } catch {
    return beautyDocsBffError("invalid_request", 400);
  }
}
