import { NextRequest, NextResponse } from "next/server";
import { downloadConsumerChatAttachment } from "@/lib/beautydocs-consumer-api";
import { beautyDocsBffError } from "@/lib/beautydocs-bff-route";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: { readonly params: Promise<{ readonly conversationId: string; readonly attachmentId: string }> },
) {
  const { conversationId, attachmentId } = await context.params;
  const result = await downloadConsumerChatAttachment(
    conversationId,
    attachmentId,
    request.headers.get("cookie"),
  );
  if (result.status !== "ok") {
    if (result.status === "unauthorized") return beautyDocsBffError("authentication_required", 401);
    if (result.status === "not-found") return beautyDocsBffError("not_found", 404);
    return beautyDocsBffError("unavailable", 503);
  }
  return new NextResponse(result.data.body, {
    headers: {
      "cache-control": "private, no-store",
      "content-type": result.data.contentType,
      ...(result.data.contentDisposition ? { "content-disposition": result.data.contentDisposition } : {}),
      "content-security-policy": "default-src 'none'; sandbox",
      "x-content-type-options": "nosniff",
    },
  });
}
