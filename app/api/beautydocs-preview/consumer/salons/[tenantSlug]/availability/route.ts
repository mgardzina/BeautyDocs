import { NextRequest } from "next/server";
import {
  fetchConsumerAppointmentAvailability,
  fetchConsumerAppointmentMonthAvailability,
} from "@/lib/beautydocs-consumer-api";
import { beautyDocsBffError, beautyDocsBffJson } from "@/lib/beautydocs-bff-route";
import { isValidFormSlug } from "@/lib/beautydocs-form-path";
import { isValidTenantSlug } from "@/lib/tenant-host";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: { readonly params: Promise<{ readonly tenantSlug: string }> },
) {
  const { tenantSlug } = await context.params;
  const formCode = request.nextUrl.searchParams.get("formCode") ?? "";
  const date = request.nextUrl.searchParams.get("date") ?? "";
  const month = request.nextUrl.searchParams.get("month") ?? "";
  if (
    !isValidTenantSlug(tenantSlug) ||
    !isValidFormSlug(formCode) ||
    (!/^\d{4}-\d{2}-\d{2}$/.test(date) && !/^\d{4}-\d{2}$/.test(month))
  ) {
    return beautyDocsBffError("invalid_request", 400);
  }
  const result = month
    ? await fetchConsumerAppointmentMonthAvailability(
        tenantSlug,
        formCode,
        month,
        request.headers.get("cookie"),
      )
    : await fetchConsumerAppointmentAvailability(
        tenantSlug,
        formCode,
        date,
        request.headers.get("cookie"),
      );
  if (result.status === "ok") return beautyDocsBffJson(result.data);
  if (result.status === "unauthorized") {
    return beautyDocsBffError("authentication_required", 401);
  }
  if (result.status === "not-found") return beautyDocsBffError("not_found", 404);
  if (result.status === "invalid") return beautyDocsBffError("invalid_request", 422);
  return beautyDocsBffError("unavailable", 503);
}
