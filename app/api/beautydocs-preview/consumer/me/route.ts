import { NextRequest } from "next/server";
import { fetchConsumerState } from "@/lib/beautydocs-consumer-api";
import { beautyDocsBffError, beautyDocsBffJson } from "@/lib/beautydocs-bff-route";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const result = await fetchConsumerState(request.headers.get("cookie"));
  if (result.status === "ok") return beautyDocsBffJson(result.data);
  if (result.status === "unauthorized") {
    return beautyDocsBffError("authentication_required", 401);
  }
  return beautyDocsBffError("unavailable", 503);
}
