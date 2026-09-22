import { NextRequest } from "next/server";
import { verifyConsumerEmailRegistration } from "@/lib/beautydocs-consumer-api";
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
  let email: string;
  let code: string;
  try {
    const body = await readSmallJsonBody(request);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    const record = body as Record<string, unknown>;
    email = String(record.email ?? "").trim();
    code = String(record.code ?? "").trim();
    if (
      email.length < 3 ||
      email.length > 320 ||
      !email.includes("@") ||
      !/^\d{6}$/.test(code)
    ) {
      throw new Error();
    }
  } catch {
    return beautyDocsBffError("invalid_request", 400);
  }

  const result = await verifyConsumerEmailRegistration({ email, code }, origin);
  if (result.status === "ok") {
    // No session cookie yet — the account is created on the finalize step.
    return beautyDocsBffJson(result.data);
  }
  if (result.status === "invalid") return beautyDocsBffError("invalid_code", 400);
  return beautyDocsBffError("unavailable", 503);
}
