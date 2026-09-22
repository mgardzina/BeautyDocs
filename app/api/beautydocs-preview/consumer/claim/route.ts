import { NextRequest } from "next/server";
import { claimConsumerDocument } from "@/lib/beautydocs-consumer-api";
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
  let payload: { submissionId: string; claimToken: string; saveProfile: boolean };
  try {
    const body = await readSmallJsonBody(request);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    const value = body as Record<string, unknown>;
    payload = {
      submissionId: String(value.submissionId ?? ""),
      claimToken: String(value.claimToken ?? ""),
      saveProfile: value.saveProfile !== false,
    };
  } catch {
    return beautyDocsBffError("invalid_request", 400);
  }
  const result = await claimConsumerDocument(
    payload,
    request.headers.get("cookie"),
    origin,
  );
  if (result.status === "ok") {
    return beautyDocsBffJson(result.data, { setCookie: result.setCookie });
  }
  if (result.status === "not-found") return beautyDocsBffError("not_found", 404);
  if (result.status === "conflict") return beautyDocsBffError("conflict", 409);
  if (result.status === "invalid") return beautyDocsBffError("invalid_request", 422);
  return beautyDocsBffError("unavailable", 503);
}
