import { NextRequest } from "next/server";
import {
  createConsumerAppointment,
  fetchConsumerAppointments,
} from "@/lib/beautydocs-consumer-api";
import {
  beautyDocsBffError,
  beautyDocsBffJson,
  getValidatedBrowserOrigin,
  readSmallJsonBody,
} from "@/lib/beautydocs-bff-route";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const result = await fetchConsumerAppointments(request.headers.get("cookie"));
  if (result.status === "ok") return beautyDocsBffJson(result.data);
  if (result.status === "unauthorized") {
    return beautyDocsBffError("authentication_required", 401);
  }
  return beautyDocsBffError("unavailable", 503);
}

export async function POST(request: NextRequest) {
  const origin = getValidatedBrowserOrigin(request);
  if (origin === null) return beautyDocsBffError("forbidden", 403);
  let payload: { tenantSlug: string; formCode: string; startsAt: string };
  try {
    const raw = (await readSmallJsonBody(request)) as Record<string, unknown>;
    if (
      typeof raw.tenantSlug !== "string" ||
      typeof raw.formCode !== "string" ||
      typeof raw.startsAt !== "string"
    ) {
      throw new Error("invalid appointment");
    }
    payload = {
      tenantSlug: raw.tenantSlug,
      formCode: raw.formCode,
      startsAt: raw.startsAt,
    };
  } catch {
    return beautyDocsBffError("invalid_request", 400);
  }
  const result = await createConsumerAppointment(
    payload,
    request.headers.get("cookie"),
    origin,
  );
  if (result.status === "ok") {
    return beautyDocsBffJson(result.data, { status: 201 });
  }
  if (result.status === "unauthorized") {
    return beautyDocsBffError("authentication_required", 401);
  }
  if (result.status === "not-found") return beautyDocsBffError("not_found", 404);
  if (result.status === "invalid") return beautyDocsBffError("invalid_request", 422);
  if (result.status === "conflict") return beautyDocsBffError("conflict", 409);
  return beautyDocsBffError("unavailable", 503);
}
