import { NextRequest } from "next/server";
import { requestConsumerPhoneCode } from "@/lib/beautydocs-consumer-api";
import {
  beautyDocsBffError,
  beautyDocsBffJson,
  getValidatedBrowserOrigin,
  readSmallJsonBody,
} from "@/lib/beautydocs-bff-route";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const origin = getValidatedBrowserOrigin(request);
  if (!origin) return beautyDocsBffError("forbidden", 403);
  let phone: string;
  try {
    const body = await readSmallJsonBody(request);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    phone = String((body as Record<string, unknown>).phone ?? "");
  } catch {
    return beautyDocsBffError("invalid_request", 400);
  }
  const result = await requestConsumerPhoneCode(
    phone,
    request.headers.get("cookie"),
    origin,
    request.headers.get("user-agent"),
  );
  if (result.status === "ok") return beautyDocsBffJson(result.data, { status: 201 });
  if (result.status === "unauthorized") {
    return beautyDocsBffError("authentication_required", 401);
  }
  if (result.status === "conflict") return beautyDocsBffError("phone_taken", 409);
  if (result.status === "rate-limited") return beautyDocsBffError("rate_limited", 429);
  if (result.status === "invalid") return beautyDocsBffError("invalid_request", 422);
  return beautyDocsBffError("unavailable", 503);
}
