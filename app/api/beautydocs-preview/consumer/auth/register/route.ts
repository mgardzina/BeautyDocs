import { NextRequest } from "next/server";
import { registerConsumer } from "@/lib/beautydocs-consumer-api";
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
  try {
    const body = await readSmallJsonBody(request);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    const record = body as Record<string, unknown>;
    // E-mail-first: only the address is captured here; name and password come
    // after e-mail verification.
    email = String(record.email ?? "").trim();
    if (email.length < 3 || email.length > 320 || !email.includes("@")) {
      throw new Error();
    }
  } catch {
    return beautyDocsBffError("invalid_request", 400);
  }
  const result = await registerConsumer({ email }, origin);
  if (result.status === "ok") {
    return beautyDocsBffJson(result.data, { status: 201 });
  }
  if (result.status === "conflict") return beautyDocsBffError("email_taken", 409);
  if (result.status === "invalid") return beautyDocsBffError("invalid_request", 422);
  return beautyDocsBffError("unavailable", 503);
}
