import { NextRequest } from "next/server";
import {
  assignBeautyDocsAdminChatPractitioner,
  fetchBeautyDocsAdminChat,
} from "@/lib/beautydocs-admin-api";
import {
  beautyDocsBffError,
  beautyDocsBffJson,
  getValidatedBrowserOrigin,
  readSmallJsonBody,
} from "@/lib/beautydocs-bff-route";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: { readonly params: Promise<{ readonly tenantSlug: string; readonly conversationId: string }> },
) {
  const { tenantSlug, conversationId } = await context.params;
  const result = await fetchBeautyDocsAdminChat(
    tenantSlug,
    conversationId,
    request.headers.get("cookie"),
  );
  if (result.status === "ok") return beautyDocsBffJson(result.data);
  if (result.status === "unauthorized") return beautyDocsBffError("authentication_required", 401);
  if (result.status === "forbidden") return beautyDocsBffError("forbidden", 403);
  if (result.status === "not-found") return beautyDocsBffError("not_found", 404);
  return beautyDocsBffError("unavailable", 503);
}

export async function PATCH(
  request: NextRequest,
  context: { readonly params: Promise<{ readonly tenantSlug: string; readonly conversationId: string }> },
) {
  const { tenantSlug, conversationId } = await context.params;
  const origin = getValidatedBrowserOrigin(request);
  if (origin === null) return beautyDocsBffError("forbidden", 403);
  try {
    const body = (await readSmallJsonBody(request)) as Record<string, unknown>;
    if (
      !("assignedTeamMemberId" in body) ||
      (body.assignedTeamMemberId !== null && typeof body.assignedTeamMemberId !== "string")
    ) {
      throw new Error("invalid practitioner assignment");
    }
    const result = await assignBeautyDocsAdminChatPractitioner(
      tenantSlug,
      conversationId,
      body.assignedTeamMemberId as string | null,
      request.headers.get("cookie"),
      origin,
    );
    if (result.status === "ok") return beautyDocsBffJson(result.data);
    if (result.status === "unauthorized") return beautyDocsBffError("authentication_required", 401);
    if (result.status === "forbidden") return beautyDocsBffError("forbidden", 403);
    if (result.status === "not-found") return beautyDocsBffError("not_found", 404);
    if (result.status === "invalid-request") return beautyDocsBffError("invalid_request", 422);
    return beautyDocsBffError("unavailable", 503);
  } catch {
    return beautyDocsBffError("invalid_request", 422);
  }
}
