import { NextRequest } from "next/server";
import { verifyConsumerPhoneCode } from "@/lib/beautydocs-consumer-api";
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
  let payload: { phone: string; challengeId: string; code: string };
  try {
    const body = await readSmallJsonBody(request);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    const value = body as Record<string, unknown>;
    payload = {
      phone: String(value.phone ?? ""),
      challengeId: String(value.challengeId ?? ""),
      code: String(value.code ?? ""),
    };
  } catch {
    return beautyDocsBffError("invalid_request", 400);
  }
  const result = await verifyConsumerPhoneCode(
    payload,
    request.headers.get("cookie"),
    origin,
    request.headers.get("user-agent"),
  );
  if (result.status === "ok") {
    return beautyDocsBffJson(result.data, { setCookie: result.setCookie });
  }
  if (result.status === "unauthorized") {
    return beautyDocsBffError("authentication_required", 401);
  }
  if (result.status === "conflict") return beautyDocsBffError("phone_taken", 409);
  if (result.status === "invalid") return beautyDocsBffError("invalid_code", 400);
  if (result.status === "not-found") return beautyDocsBffError("account_not_found", 404);
  return beautyDocsBffError("unavailable", 503);
}
