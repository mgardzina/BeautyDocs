import { NextRequest } from "next/server";
import { updateConsumerProfile } from "@/lib/beautydocs-consumer-api";
import {
  beautyDocsBffError,
  beautyDocsBffJson,
  getValidatedBrowserOrigin,
  readSmallJsonBody,
} from "@/lib/beautydocs-bff-route";

export const runtime = "nodejs";

export async function PUT(request: NextRequest) {
  const origin = getValidatedBrowserOrigin(request);
  if (!origin) return beautyDocsBffError("forbidden", 403);
  let payload: Record<string, unknown>;
  try {
    const body = await readSmallJsonBody(request);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    payload = body as Record<string, unknown>;
  } catch {
    return beautyDocsBffError("invalid_request", 400);
  }
  const result = await updateConsumerProfile(
    payload,
    request.headers.get("cookie"),
    origin,
  );
  if (result.status === "ok") return beautyDocsBffJson(result.data);
  if (result.status === "unauthorized") {
    return beautyDocsBffError("authentication_required", 401);
  }
  if (result.status === "invalid") return beautyDocsBffError("invalid_request", 422);
  return beautyDocsBffError("unavailable", 503);
}
