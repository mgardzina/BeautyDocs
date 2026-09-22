import { NextRequest } from "next/server";
import { fetchConsumerDocument } from "@/lib/beautydocs-consumer-api";
import { beautyDocsBffError, beautyDocsBffJson } from "@/lib/beautydocs-bff-route";

export const runtime = "nodejs";

interface Context {
  readonly params: Promise<{ submissionId: string }>;
}

export async function GET(request: NextRequest, context: Context) {
  const { submissionId } = await context.params;
  const result = await fetchConsumerDocument(
    submissionId,
    request.headers.get("cookie"),
  );
  if (result.status === "ok") return beautyDocsBffJson(result.data);
  if (result.status === "unauthorized") {
    return beautyDocsBffError("authentication_required", 401);
  }
  if (result.status === "not-found") return beautyDocsBffError("not_found", 404);
  return beautyDocsBffError("unavailable", 503);
}
