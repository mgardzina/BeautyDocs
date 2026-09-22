import { NextRequest } from "next/server";
import { registerBeautyDocsOwnerWithGoogle } from "@/lib/beautydocs-admin-api";
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

  let accessToken: string;
  let salonName: string;
  let fullName: string | null;
  try {
    const raw = (await readSmallJsonBody(request)) as Record<string, unknown>;
    if (
      typeof raw.accessToken !== "string" ||
      raw.accessToken.length < 20 ||
      raw.accessToken.length > 8_192
    ) {
      return beautyDocsBffError("invalid_request", 400);
    }
    if (
      typeof raw.salonName !== "string" ||
      raw.salonName.trim().length < 1 ||
      raw.salonName.length > 200
    ) {
      return beautyDocsBffError("invalid_request", 400);
    }
    if (
      raw.fullName !== undefined &&
      raw.fullName !== null &&
      (typeof raw.fullName !== "string" || raw.fullName.length > 200)
    ) {
      return beautyDocsBffError("invalid_request", 400);
    }
    accessToken = raw.accessToken;
    salonName = raw.salonName.trim();
    fullName = typeof raw.fullName === "string" ? raw.fullName : null;
  } catch {
    return beautyDocsBffError("invalid_request", 400);
  }

  const result = await registerBeautyDocsOwnerWithGoogle(
    accessToken,
    salonName,
    fullName,
    origin,
  );
  switch (result.status) {
    case "ok":
      return beautyDocsBffJson(result.data, { setCookie: result.setCookie });
    case "unauthorized":
      return beautyDocsBffError("invalid_credentials", 401);
    case "conflict":
      return beautyDocsBffError("conflict", 409);
    case "invalid-request":
      return beautyDocsBffError("invalid_request", 400);
    default:
      return beautyDocsBffError("unavailable", 503);
  }
}
