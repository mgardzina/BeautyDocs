import { NextRequest } from "next/server";
import { startBeautyDocsMfaEnrollment } from "@/lib/beautydocs-admin-api";
import {
  beautyDocsBffError,
  beautyDocsBffJson,
  getValidatedBrowserOrigin,
  readSmallJsonBody,
} from "@/lib/beautydocs-bff-route";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const origin = getValidatedBrowserOrigin(request);
  if (origin === null) return beautyDocsBffError("forbidden", 403);
  let payload: {
    method: "SMS" | "TOTP";
    phone?: string;
    changeChallengeId?: string;
  };
  try {
    const raw = (await readSmallJsonBody(request)) as Record<string, unknown>;
    const keys = Object.keys(raw);
    if (
      (raw.method !== "SMS" && raw.method !== "TOTP") ||
      keys.some(
        (key) =>
          key !== "method" && key !== "phone" && key !== "changeChallengeId",
      ) ||
      (raw.phone !== undefined &&
        (typeof raw.phone !== "string" || raw.phone.length > 32)) ||
      (raw.changeChallengeId !== undefined &&
        typeof raw.changeChallengeId !== "string")
    ) {
      throw new Error("invalid MFA enrollment");
    }
    payload = {
      method: raw.method,
      ...(typeof raw.phone === "string" ? { phone: raw.phone } : {}),
      ...(typeof raw.changeChallengeId === "string"
        ? { changeChallengeId: raw.changeChallengeId }
        : {}),
    };
  } catch {
    return beautyDocsBffError("invalid_request", 400);
  }
  const result = await startBeautyDocsMfaEnrollment(
    payload,
    request.headers.get("cookie"),
    origin,
  );
  if (result.status === "ok") return beautyDocsBffJson(result.data);
  if (result.status === "unauthorized") {
    return beautyDocsBffError("authentication_required", 401);
  }
  if (result.status === "conflict") return beautyDocsBffError("conflict", 409);
  if (result.status === "payment-required") {
    return beautyDocsBffError("sms_balance_required", 402);
  }
  if (result.status === "rate-limited") {
    return beautyDocsBffError("rate_limited", 429);
  }
  if (result.status === "invalid-request") {
    return beautyDocsBffError("invalid_request", 422);
  }
  return beautyDocsBffError("unavailable", 503);
}
