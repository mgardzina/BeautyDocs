import { NextRequest } from "next/server";
import { loginConsumerWithPassword } from "@/lib/beautydocs-consumer-api";
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
  let password: string;
  try {
    const body = await readSmallJsonBody(request);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    const record = body as Record<string, unknown>;
    email = String(record.email ?? "").trim();
    password = String(record.password ?? "");
    if (
      email.length < 3 ||
      email.length > 320 ||
      !email.includes("@") ||
      password.length < 1 ||
      password.length > 1024
    ) {
      throw new Error();
    }
  } catch {
    return beautyDocsBffError("invalid_request", 400);
  }
  const result = await loginConsumerWithPassword({ email, password }, origin);
  if (result.status === "ok") {
    return beautyDocsBffJson(result.data, { setCookie: result.setCookie });
  }
  if (result.status === "unauthorized") {
    return beautyDocsBffError("invalid_credentials", 401);
  }
  if (result.status === "forbidden") {
    return beautyDocsBffError("email_unverified", 403);
  }
  if (result.status === "invalid") return beautyDocsBffError("invalid_request", 422);
  return beautyDocsBffError("unavailable", 503);
}
