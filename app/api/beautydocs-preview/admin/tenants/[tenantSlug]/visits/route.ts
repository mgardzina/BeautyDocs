import { NextRequest } from "next/server";
import {
  createBeautyDocsTenantVisit,
  fetchBeautyDocsTenantVisits,
  rescheduleBeautyDocsTenantVisit,
} from "@/lib/beautydocs-admin-api";
import {
  beautyDocsBffError,
  beautyDocsBffJson,
  getValidatedBrowserOrigin,
  readSmallJsonBody,
} from "@/lib/beautydocs-bff-route";
import { isBeautyDocsClientId } from "@/lib/beautydocs-admin-contract";
import { isValidFormSlug } from "@/lib/beautydocs-form-path";
import { isValidTenantSlug } from "@/lib/tenant-host";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: { readonly params: Promise<{ readonly tenantSlug: string }> },
) {
  const { tenantSlug } = await context.params;
  const dateFrom = request.nextUrl.searchParams.get("from") ?? "";
  const dateTo = request.nextUrl.searchParams.get("to") ?? "";
  if (!isValidTenantSlug(tenantSlug)) return beautyDocsBffError("not_found", 404);
  const result = await fetchBeautyDocsTenantVisits(
    tenantSlug,
    dateFrom,
    dateTo,
    request.headers.get("cookie"),
  );
  if (result.status === "ok") return beautyDocsBffJson(result.data);
  if (result.status === "unauthorized") {
    return beautyDocsBffError("authentication_required", 401);
  }
  if (result.status === "forbidden") return beautyDocsBffError("forbidden", 403);
  if (result.status === "not-found") return beautyDocsBffError("not_found", 404);
  if (result.status === "invalid-request") {
    return beautyDocsBffError("invalid_request", 400);
  }
  return beautyDocsBffError("unavailable", 503);
}

export async function POST(
  request: NextRequest,
  context: { readonly params: Promise<{ readonly tenantSlug: string }> },
) {
  const { tenantSlug } = await context.params;
  if (!isValidTenantSlug(tenantSlug)) return beautyDocsBffError("not_found", 404);
  const origin = getValidatedBrowserOrigin(request);
  if (origin === null) return beautyDocsBffError("forbidden", 403);
  try {
    const body = await readSmallJsonBody(request);
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      throw new Error("invalid body");
    }
    const record = body as Record<string, unknown>;
    const newClient = record.newClient;
    const validNewClient =
      newClient === null ||
      (typeof newClient === "object" &&
        !Array.isArray(newClient) &&
        newClient !== null &&
        Object.keys(newClient).sort().join(",") === "email,fullName,phone" &&
        typeof (newClient as Record<string, unknown>).fullName === "string" &&
        ((newClient as Record<string, unknown>).phone === null ||
          typeof (newClient as Record<string, unknown>).phone === "string") &&
        ((newClient as Record<string, unknown>).email === null ||
          typeof (newClient as Record<string, unknown>).email === "string"));
    if (
      Object.keys(record).sort().join(",") !==
        "clientId,formCode,newClient,startsAt" ||
      (record.clientId !== null && typeof record.clientId !== "string") ||
      typeof record.formCode !== "string" ||
      typeof record.startsAt !== "string" ||
      !validNewClient ||
      ((record.clientId === null) === (newClient === null)) ||
      (typeof record.clientId === "string" &&
        !isBeautyDocsClientId(record.clientId)) ||
      !isValidFormSlug(record.formCode) ||
      !Number.isFinite(Date.parse(record.startsAt))
    ) {
      throw new Error("invalid body");
    }
    const result = await createBeautyDocsTenantVisit(
      tenantSlug,
      {
        clientId: typeof record.clientId === "string" ? record.clientId : null,
        newClient:
          newClient !== null && typeof newClient === "object"
            ? {
                fullName: String(
                  (newClient as Record<string, unknown>).fullName,
                ),
                phone:
                  typeof (newClient as Record<string, unknown>).phone ===
                  "string"
                    ? String((newClient as Record<string, unknown>).phone)
                    : null,
                email:
                  typeof (newClient as Record<string, unknown>).email ===
                  "string"
                    ? String((newClient as Record<string, unknown>).email)
                    : null,
              }
            : null,
        formCode: record.formCode,
        startsAt: record.startsAt,
      },
      request.headers.get("cookie"),
      origin,
    );
    if (result.status === "ok") {
      return beautyDocsBffJson(result.data, { status: 201 });
    }
    if (result.status === "unauthorized") {
      return beautyDocsBffError("authentication_required", 401);
    }
    if (result.status === "forbidden") {
      return beautyDocsBffError("forbidden", 403);
    }
    if (result.status === "not-found") {
      return beautyDocsBffError("not_found", 404);
    }
    if (result.status === "conflict") {
      return beautyDocsBffError("conflict", 409);
    }
    if (result.status === "invalid-request") {
      return beautyDocsBffError("invalid_request", 422);
    }
    return beautyDocsBffError("unavailable", 503);
  } catch {
    return beautyDocsBffError("invalid_request", 400);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { readonly params: Promise<{ readonly tenantSlug: string }> },
) {
  const { tenantSlug } = await context.params;
  if (!isValidTenantSlug(tenantSlug)) return beautyDocsBffError("not_found", 404);
  const origin = getValidatedBrowserOrigin(request);
  if (origin === null) return beautyDocsBffError("forbidden", 403);
  try {
    const body = await readSmallJsonBody(request);
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      throw new Error("invalid body");
    }
    const record = body as Record<string, unknown>;
    if (
      Object.keys(record).sort().join(",") !== "startsAt,visitId" ||
      typeof record.visitId !== "string" ||
      typeof record.startsAt !== "string" ||
      !isBeautyDocsClientId(record.visitId) ||
      !Number.isFinite(Date.parse(record.startsAt))
    ) {
      throw new Error("invalid body");
    }
    const result = await rescheduleBeautyDocsTenantVisit(
      tenantSlug,
      record.visitId,
      record.startsAt,
      request.headers.get("cookie"),
      origin,
    );
    if (result.status === "ok") return beautyDocsBffJson(result.data);
    if (result.status === "unauthorized") {
      return beautyDocsBffError("authentication_required", 401);
    }
    if (result.status === "forbidden") {
      return beautyDocsBffError("forbidden", 403);
    }
    if (result.status === "not-found") {
      return beautyDocsBffError("not_found", 404);
    }
    if (result.status === "conflict") {
      return beautyDocsBffError("conflict", 409);
    }
    if (result.status === "invalid-request") {
      return beautyDocsBffError("invalid_request", 422);
    }
    return beautyDocsBffError("unavailable", 503);
  } catch {
    return beautyDocsBffError("invalid_request", 400);
  }
}
