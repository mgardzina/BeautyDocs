import { NextRequest } from "next/server";
import { fetchConsumerChat } from "@/lib/beautydocs-consumer-api";
import { beautyDocsBffError, beautyDocsBffJson } from "@/lib/beautydocs-bff-route";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: { readonly params: Promise<{ readonly conversationId: string }> },
) {
  const { conversationId } = await context.params;
  const result = await fetchConsumerChat(conversationId, request.headers.get("cookie"));
  if (result.status === "ok") return beautyDocsBffJson(result.data);
  if (result.status === "unauthorized") return beautyDocsBffError("authentication_required", 401);
  if (result.status === "not-found") return beautyDocsBffError("not_found", 404);
  return beautyDocsBffError("unavailable", 503);
}
