import { NextRequest } from "next/server";
import { startConsumerMfaDisable } from "@/lib/beautydocs-consumer-api";
import {
  beautyDocsBffError,
  beautyDocsBffJson,
  getValidatedBrowserOrigin,
} from "@/lib/beautydocs-bff-route";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const origin = getValidatedBrowserOrigin(request);
  if (origin === null) return beautyDocsBffError("forbidden", 403);
  const result = await startConsumerMfaDisable(request.headers.get("cookie"), origin);
  if (result.status === "ok") return beautyDocsBffJson(result.data);
  if (result.status === "unauthorized") {
    return beautyDocsBffError("authentication_required", 401);
  }
  if (result.status === "conflict") return beautyDocsBffError("conflict", 409);
  return beautyDocsBffError("unavailable", 503);
}
