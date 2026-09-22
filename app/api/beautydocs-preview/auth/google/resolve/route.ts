import { NextRequest } from "next/server";
import { resolveBeautyDocsGoogleTarget } from "@/lib/beautydocs-admin-api";
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
  try {
    const raw = (await readSmallJsonBody(request)) as Record<string, unknown>;
    if (
      typeof raw.accessToken !== "string" ||
      raw.accessToken.length < 20 ||
      raw.accessToken.length > 8_192
    ) {
      return beautyDocsBffError("invalid_request", 400);
    }
    accessToken = raw.accessToken;
  } catch {
    return beautyDocsBffError("invalid_request", 400);
  }

  const result = await resolveBeautyDocsGoogleTarget(accessToken, origin);
  switch (result.status) {
    case "ok":
      return beautyDocsBffJson(result.data);
    case "unauthorized":
      return beautyDocsBffError("invalid_credentials", 401);
    default:
      return beautyDocsBffError("unavailable", 503);
  }
}
