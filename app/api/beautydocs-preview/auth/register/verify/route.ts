import { NextRequest } from "next/server";
import { verifyBeautyDocsRegistration } from "../../../../../../lib/beautydocs-admin-api";
import {
  beautyDocsBffError,
  beautyDocsBffJson,
  getValidatedBrowserOrigin,
  readSmallJsonBody,
} from "../../../../../../lib/beautydocs-bff-route";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const origin = getValidatedBrowserOrigin(request);
  if (origin === null) {
    return beautyDocsBffError("forbidden", 403);
  }

  let payload;
  try {
    const raw = (await readSmallJsonBody(request)) as Record<string, unknown>;
    const email = raw.email;
    const code = raw.code;
    if (
      typeof email !== "string" ||
      email.length === 0 ||
      email.length > 320 ||
      typeof code !== "string" ||
      !/^\d{6}$/.test(code)
    ) {
      return beautyDocsBffError("invalid_request", 400);
    }
    payload = { email, code };
  } catch {
    return beautyDocsBffError("invalid_request", 400);
  }

  const result = await verifyBeautyDocsRegistration(payload, origin);
  switch (result.status) {
    case "ok":
      // No session cookie yet — the account is created on the finalize step.
      return beautyDocsBffJson(result.data);
    case "invalid-code":
      return beautyDocsBffError("invalid_code", 400);
    default:
      return beautyDocsBffError("unavailable", 503);
  }
}
