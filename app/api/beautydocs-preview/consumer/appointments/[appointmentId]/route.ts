import { NextRequest } from "next/server";
import { cancelConsumerAppointment } from "@/lib/beautydocs-consumer-api";
import {
  beautyDocsBffError,
  beautyDocsBffJson,
  getValidatedBrowserOrigin,
} from "@/lib/beautydocs-bff-route";

export const runtime = "nodejs";

export async function DELETE(
  request: NextRequest,
  context: { readonly params: Promise<{ readonly appointmentId: string }> },
) {
  const origin = getValidatedBrowserOrigin(request);
  if (origin === null) return beautyDocsBffError("forbidden", 403);
  const { appointmentId } = await context.params;
  const result = await cancelConsumerAppointment(
    appointmentId,
    request.headers.get("cookie"),
    origin,
  );
  if (result.status === "ok") return beautyDocsBffJson({ ok: true });
  if (result.status === "unauthorized") {
    return beautyDocsBffError("authentication_required", 401);
  }
  if (result.status === "not-found") return beautyDocsBffError("not_found", 404);
  if (result.status === "conflict") return beautyDocsBffError("conflict", 409);
  return beautyDocsBffError("unavailable", 503);
}
