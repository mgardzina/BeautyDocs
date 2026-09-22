import { NextRequest } from "next/server";
import { confirmBeautyDocsMfaLogin } from "@/lib/beautydocs-admin-api";
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
  let challengeId: string;
  let code: string;
  try {
    const raw = (await readSmallJsonBody(request)) as Record<string, unknown>;
    if (
      Object.keys(raw).length !== 2 ||
      typeof raw.challengeId !== "string" ||
      typeof raw.code !== "string" ||
      !/^\d{6}$/.test(raw.code)
    ) {
      throw new Error("invalid login confirmation");
    }
    challengeId = raw.challengeId;
    code = raw.code;
  } catch {
    return beautyDocsBffError("invalid_request", 400);
  }
  const result = await confirmBeautyDocsMfaLogin(challengeId, code, origin);
  if (result.status === "ok") {
    return beautyDocsBffJson(result.data, { setCookie: result.setCookie });
  }
  if (result.status === "invalid-request" || result.status === "unauthorized") {
    return beautyDocsBffError("invalid_code", 400);
  }
  return beautyDocsBffError("unavailable", 503);
}
