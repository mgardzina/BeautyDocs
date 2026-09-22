import { NextRequest } from "next/server";
import {
  fetchConsumerMedicalCatalog,
  updateConsumerMedicalProfile,
} from "@/lib/beautydocs-consumer-api";
import {
  beautyDocsBffError,
  beautyDocsBffJson,
  getValidatedBrowserOrigin,
} from "@/lib/beautydocs-bff-route";

export const runtime = "nodejs";

const MAX_MEDICAL_PROFILE_BODY = 300_000;

export async function GET(request: NextRequest) {
  const result = await fetchConsumerMedicalCatalog(request.headers.get("cookie"));
  if (result.status === "ok") return beautyDocsBffJson(result.data);
  if (result.status === "unauthorized") {
    return beautyDocsBffError("authentication_required", 401);
  }
  return beautyDocsBffError("unavailable", 503);
}

export async function PUT(request: NextRequest) {
  const origin = getValidatedBrowserOrigin(request);
  if (!origin) return beautyDocsBffError("forbidden", 403);
  let payload: Record<string, unknown>;
  try {
    const declaredLength = Number(request.headers.get("content-length"));
    if (
      Number.isFinite(declaredLength) &&
      declaredLength > MAX_MEDICAL_PROFILE_BODY
    ) {
      throw new Error("too large");
    }
    const text = await request.text();
    if (text.length > MAX_MEDICAL_PROFILE_BODY) throw new Error("too large");
    const body = JSON.parse(text) as unknown;
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    payload = body as Record<string, unknown>;
  } catch {
    return beautyDocsBffError("invalid_request", 400);
  }
  const result = await updateConsumerMedicalProfile(
    payload,
    request.headers.get("cookie"),
    origin,
  );
  if (result.status === "ok") return beautyDocsBffJson(result.data);
  if (result.status === "unauthorized") {
    return beautyDocsBffError("authentication_required", 401);
  }
  if (result.status === "invalid") return beautyDocsBffError("invalid_request", 422);
  return beautyDocsBffError("unavailable", 503);
}
