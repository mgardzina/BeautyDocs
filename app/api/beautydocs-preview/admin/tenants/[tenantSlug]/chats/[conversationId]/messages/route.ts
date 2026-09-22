import { NextRequest } from "next/server";
import { sendBeautyDocsAdminChatMessage } from "@/lib/beautydocs-admin-api";
import {
  beautyDocsBffError,
  beautyDocsBffJson,
  getValidatedBrowserOrigin,
  readSmallJsonBody,
} from "@/lib/beautydocs-bff-route";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: { readonly params: Promise<{ readonly tenantSlug: string; readonly conversationId: string }> },
) {
  const { tenantSlug, conversationId } = await context.params;
  const origin = getValidatedBrowserOrigin(request);
  if (origin === null) return beautyDocsBffError("forbidden", 403);
  try {
    const value = (await readSmallJsonBody(request)) as Record<string, unknown>;
    if (typeof value.body !== "string") throw new Error("invalid chat message");
    const result = await sendBeautyDocsAdminChatMessage(
      tenantSlug,
      conversationId,
      value.body,
      request.headers.get("cookie"),
      origin,
    );
    if (result.status === "ok") return beautyDocsBffJson(result.data, { status: 201 });
    if (result.status === "unauthorized") return beautyDocsBffError("authentication_required", 401);
    if (result.status === "forbidden") return beautyDocsBffError("forbidden", 403);
    if (result.status === "not-found") return beautyDocsBffError("not_found", 404);
    if (result.status === "invalid-request") return beautyDocsBffError("invalid_request", 422);
    return beautyDocsBffError("unavailable", 503);
  } catch {
    return beautyDocsBffError("invalid_request", 422);
  }
}
