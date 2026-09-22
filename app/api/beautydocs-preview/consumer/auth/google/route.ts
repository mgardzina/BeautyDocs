import { NextRequest } from "next/server";
import { loginConsumerWithGoogle } from "@/lib/beautydocs-consumer-api";
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
  let proof: { credential?: string; accessToken?: string };
  try {
    const body = await readSmallJsonBody(request);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    const raw = body as Record<string, unknown>;
    const credential =
      typeof raw.credential === "string" ? raw.credential : undefined;
    const accessToken =
      typeof raw.accessToken === "string" ? raw.accessToken : undefined;
    const chosen = accessToken ?? credential ?? "";
    if (chosen.length < 20 || chosen.length > 8_192) throw new Error();
    proof = accessToken ? { accessToken } : { credential };
  } catch {
    return beautyDocsBffError("invalid_request", 400);
  }
  const result = await loginConsumerWithGoogle(
    proof,
    request.headers.get("cookie"),
    origin,
  );
  if (result.status === "ok") {
    return beautyDocsBffJson(result.data, { setCookie: result.setCookie });
  }
  if (result.status === "unauthorized") {
    return beautyDocsBffError("invalid_credentials", 401);
  }
  if (result.status === "conflict") {
    return beautyDocsBffError("conflict", 409);
  }
  return beautyDocsBffError("unavailable", 503);
}
