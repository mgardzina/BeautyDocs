import { NextRequest } from "next/server";
import { confirmBeautyDocsMfaEnrollment } from "@/lib/beautydocs-admin-api";
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
  const parsed = await readConfirmation(request);
  if (parsed === null) return beautyDocsBffError("invalid_request", 400);
  const result = await confirmBeautyDocsMfaEnrollment(
    parsed.challengeId,
    parsed.code,
    request.headers.get("cookie"),
    origin,
  );
  if (result.status === "ok") return beautyDocsBffJson(result.data);
  if (result.status === "unauthorized") {
    return beautyDocsBffError("authentication_required", 401);
  }
  if (result.status === "invalid-request") {
    return beautyDocsBffError("invalid_code", 400);
  }
  return beautyDocsBffError("unavailable", 503);
}

async function readConfirmation(request: NextRequest) {
  try {
    const raw = (await readSmallJsonBody(request)) as Record<string, unknown>;
    if (
      Object.keys(raw).length !== 2 ||
      typeof raw.challengeId !== "string" ||
      typeof raw.code !== "string" ||
      !/^\d{6}$/.test(raw.code)
    ) {
      return null;
    }
    return { challengeId: raw.challengeId, code: raw.code };
  } catch {
    return null;
  }
}
