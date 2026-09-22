import { NextRequest } from "next/server";
import {
  createBeautyDocsAdminTeamMember,
  fetchBeautyDocsAdminTeam,
} from "@/lib/beautydocs-admin-api";
import {
  beautyDocsBffError,
  beautyDocsBffJson,
  getValidatedBrowserOrigin,
  readSmallJsonBody,
} from "@/lib/beautydocs-bff-route";
import { parseBeautyDocsTeamMemberCreatePayload } from "@/lib/beautydocs-team-request";
import { isValidTenantSlug } from "@/lib/tenant-host";

export const runtime = "nodejs";

interface TeamRouteContext {
  readonly params: Promise<{ tenantSlug: string }>;
}

export async function GET(request: NextRequest, context: TeamRouteContext) {
  const { tenantSlug } = await context.params;
  if (!isValidTenantSlug(tenantSlug)) {
    return beautyDocsBffError("not_found", 404);
  }
  return toJsonResponse(
    await fetchBeautyDocsAdminTeam(
      tenantSlug,
      request.headers.get("cookie"),
    ),
  );
}

export async function POST(request: NextRequest, context: TeamRouteContext) {
  const { tenantSlug } = await context.params;
  if (!isValidTenantSlug(tenantSlug)) {
    return beautyDocsBffError("not_found", 404);
  }
  const origin = getValidatedBrowserOrigin(request);
  if (origin === null) {
    return beautyDocsBffError("forbidden", 403);
  }
  try {
    const body = await readSmallJsonBody(request);
    const payload = parseBeautyDocsTeamMemberCreatePayload(body);
    if (payload === null) throw new Error("invalid body");
    const result = await createBeautyDocsAdminTeamMember(
      tenantSlug,
      payload,
      request.headers.get("cookie"),
      origin,
    );
    return toJsonResponse(result, 201);
  } catch {
    return beautyDocsBffError("invalid_request", 400);
  }
}

function toJsonResponse(
  result: Awaited<
    ReturnType<
      typeof fetchBeautyDocsAdminTeam | typeof createBeautyDocsAdminTeamMember
    >
  >,
  successStatus = 200,
) {
  switch (result.status) {
    case "ok":
      return beautyDocsBffJson(result.data, { status: successStatus });
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
