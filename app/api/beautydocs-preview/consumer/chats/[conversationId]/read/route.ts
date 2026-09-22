import { NextRequest, NextResponse } from "next/server";
import { markConsumerChatRead } from "@/lib/beautydocs-consumer-api";
import { beautyDocsBffError, getValidatedBrowserOrigin } from "@/lib/beautydocs-bff-route";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: { readonly params: Promise<{ readonly conversationId: string }> },
) {
  const { conversationId } = await context.params;
  const origin = getValidatedBrowserOrigin(request);
  if (origin === null) return beautyDocsBffError("forbidden", 403);
  const result = await markConsumerChatRead(
    conversationId,
    request.headers.get("cookie"),
    origin,
  );
  if (result.status === "ok") return new NextResponse(null, { status: 204 });
  if (result.status === "unauthorized") return beautyDocsBffError("authentication_required", 401);
  if (result.status === "not-found") return beautyDocsBffError("not_found", 404);
  return beautyDocsBffError("unavailable", 503);
}
