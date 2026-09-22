import { NextRequest } from "next/server";
import { completeConsumerRegistration } from "@/lib/beautydocs-consumer-api";
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
  let registrationToken: string;
  let fullName: string;
  let password: string;
  try {
    const body = await readSmallJsonBody(request);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    const record = body as Record<string, unknown>;
    registrationToken = String(record.registrationToken ?? "").trim();
    fullName = String(record.fullName ?? "").trim();
    password = String(record.password ?? "");
    if (
      registrationToken.length < 16 ||
      registrationToken.length > 128 ||
      fullName.length < 2 ||
      fullName.length > 200 ||
      password.length < 8 ||
      password.length > 1024
    ) {
      throw new Error();
    }
  } catch {
    return beautyDocsBffError("invalid_request", 400);
  }

  const result = await completeConsumerRegistration(
    { registrationToken, fullName, password },
    origin,
  );
  if (result.status === "ok") {
    // Account created and the client is logged in — pass the session cookie on.
    return beautyDocsBffJson(result.data, { setCookie: result.setCookie });
  }
  if (result.status === "conflict") return beautyDocsBffError("email_taken", 409);
  if (result.status === "invalid") return beautyDocsBffError("invalid_registration", 400);
  return beautyDocsBffError("unavailable", 503);
}
