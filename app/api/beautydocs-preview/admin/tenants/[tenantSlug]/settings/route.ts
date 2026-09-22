import { NextRequest } from "next/server";
import {
  deleteBeautyDocsTenant,
  fetchBeautyDocsTenantSettings,
  updateBeautyDocsTenantSettings,
} from "@/lib/beautydocs-admin-api";
import type { BeautyDocsTenantSettings } from "@/types/beautydocs-admin";
import { parseBeautyDocsBookingSchedule } from "@/lib/beautydocs-admin-contract";
import {
  beautyDocsBffError,
  beautyDocsBffJson,
  getValidatedBrowserOrigin,
  readSmallJsonBody,
} from "@/lib/beautydocs-bff-route";
import { isValidTenantSlug } from "@/lib/tenant-host";

export const runtime = "nodejs";

interface Context {
  readonly params: Promise<{ tenantSlug: string }>;
}

export async function GET(request: NextRequest, context: Context) {
  const tenantSlug = await validSlug(context);
  if (tenantSlug === null) return beautyDocsBffError("not_found", 404);
  return respond(
    await fetchBeautyDocsTenantSettings(
      tenantSlug,
      request.headers.get("cookie"),
    ),
  );
}

export async function PUT(request: NextRequest, context: Context) {
  const tenantSlug = await validSlug(context);
  if (tenantSlug === null) return beautyDocsBffError("not_found", 404);
  const origin = getValidatedBrowserOrigin(request);
  if (origin === null) return beautyDocsBffError("forbidden", 403);
  let payload: Omit<
    BeautyDocsTenantSettings,
    "slug" | "countryCode" | "role" | "canEdit" | "canDelete" | "logoImage"
  >;
  try {
    const raw = (await readSmallJsonBody(request)) as Record<string, unknown>;
    payload = {
      displayName: required(raw.displayName, 200),
      legalName: required(raw.legalName, 250),
      nip: optional(raw.nip, 20),
      regon: optional(raw.regon, 14),
      krs: optional(raw.krs, 10),
      email: requiredEmail(raw.email),
      privacyContactEmail: requiredEmail(raw.privacyContactEmail),
      phone: optional(raw.phone, 32),
      websiteUrl: optional(raw.websiteUrl, 2048),
      addressLine1: optional(raw.addressLine1, 250),
      addressLine2: optional(raw.addressLine2, 250),
      postalCode: optional(raw.postalCode, 20),
      city: optional(raw.city, 120),
      directoryVisible: requiredBoolean(raw.directoryVisible),
      bookingSchedule: parseBeautyDocsBookingSchedule(raw.bookingSchedule),
    };
  } catch {
    return beautyDocsBffError("invalid_request", 400);
  }
  return respond(
    await updateBeautyDocsTenantSettings(
      tenantSlug,
      payload,
      request.headers.get("cookie"),
      origin,
    ),
  );
}

export async function DELETE(request: NextRequest, context: Context) {
  const tenantSlug = await validSlug(context);
  if (tenantSlug === null) return beautyDocsBffError("not_found", 404);
  const origin = getValidatedBrowserOrigin(request);
  if (origin === null) return beautyDocsBffError("forbidden", 403);
  try {
    const raw = (await readSmallJsonBody(request)) as Record<string, unknown>;
    if (raw.confirmation !== "USUŃ SALON") {
      throw new Error("invalid confirmation");
    }
  } catch {
    return beautyDocsBffError("invalid_request", 400);
  }
  const result = await deleteBeautyDocsTenant(
    tenantSlug,
    request.headers.get("cookie"),
    origin,
  );
  if (result.status === "ok") return beautyDocsBffJson({ ok: true });
  if (result.status === "unauthorized") {
    return beautyDocsBffError("authentication_required", 401);
  }
  if (result.status === "forbidden") {
    return beautyDocsBffError("forbidden", 403);
  }
  if (result.status === "not-found") {
    return beautyDocsBffError("not_found", 404);
  }
  return beautyDocsBffError("unavailable", 503);
}

async function validSlug(context: Context): Promise<string | null> {
  const { tenantSlug } = await context.params;
  return isValidTenantSlug(tenantSlug) ? tenantSlug : null;
}

function required(value: unknown, max: number): string {
  if (typeof value !== "string" || value.trim().length < 2 || value.length > max) {
    throw new Error("invalid field");
  }
  return value.trim();
}

function requiredEmail(value: unknown): string {
  const email = required(value, 320);
  if (!email.includes("@")) throw new Error("invalid email");
  return email;
}

function optional(value: unknown, max: number): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || value.length > max) {
    throw new Error("invalid optional field");
  }
  return value.trim() || null;
}

function requiredBoolean(value: unknown): boolean {
  if (typeof value !== "boolean") throw new Error("invalid field");
  return value;
}

function respond(
  result: Awaited<ReturnType<typeof fetchBeautyDocsTenantSettings>>,
) {
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
  if (result.status === "invalid-request") {
    return beautyDocsBffError("invalid_request", 422);
  }
  return beautyDocsBffError("unavailable", 503);
}
