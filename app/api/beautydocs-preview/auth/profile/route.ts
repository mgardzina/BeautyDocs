import { NextRequest } from "next/server";
import {
  deleteBeautyDocsUserAccount,
  fetchBeautyDocsUserProfile,
  updateBeautyDocsUserProfile,
} from "@/lib/beautydocs-admin-api";
import {
  beautyDocsBffError,
  beautyDocsBffJson,
  getValidatedBrowserOrigin,
  readSmallJsonBody,
} from "@/lib/beautydocs-bff-route";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const result = await fetchBeautyDocsUserProfile(
    request.headers.get("cookie"),
  );
  if (result.status === "ok") return beautyDocsBffJson(result.data);
  if (result.status === "unauthorized") {
    return beautyDocsBffError("authentication_required", 401);
  }
  return beautyDocsBffError("unavailable", 503);
}

export async function PUT(request: NextRequest) {
  const origin = getValidatedBrowserOrigin(request);
  if (origin === null) return beautyDocsBffError("forbidden", 403);
  let payload: { displayName: string; phone: string | null };
  try {
    const raw = (await readSmallJsonBody(request)) as Record<string, unknown>;
    if (
      Object.keys(raw).some((key) => key !== "displayName" && key !== "phone") ||
      typeof raw.displayName !== "string" ||
      raw.displayName.trim().length < 2 ||
      raw.displayName.length > 200 ||
      (raw.phone !== null &&
        (typeof raw.phone !== "string" || raw.phone.length > 32))
    ) {
      throw new Error("invalid display name");
    }
    payload = {
      displayName: raw.displayName.trim(),
      phone: typeof raw.phone === "string" && raw.phone.trim() ? raw.phone.trim() : null,
    };
  } catch {
    return beautyDocsBffError("invalid_request", 400);
  }
  const result = await updateBeautyDocsUserProfile(
    payload,
    request.headers.get("cookie"),
    origin,
  );
  if (result.status === "ok") return beautyDocsBffJson(result.data);
  if (result.status === "unauthorized") {
    return beautyDocsBffError("authentication_required", 401);
  }
  if (result.status === "invalid-request") {
    return beautyDocsBffError("invalid_request", 422);
  }
  return beautyDocsBffError("unavailable", 503);
}

export async function DELETE(request: NextRequest) {
  const origin = getValidatedBrowserOrigin(request);
  if (origin === null) return beautyDocsBffError("forbidden", 403);
  try {
    const raw = (await readSmallJsonBody(request)) as Record<string, unknown>;
    if (raw.confirmation !== "USUŃ KONTO") {
      throw new Error("invalid confirmation");
    }
  } catch {
    return beautyDocsBffError("invalid_request", 400);
  }
  const result = await deleteBeautyDocsUserAccount(
    request.headers.get("cookie"),
    origin,
  );
  if (result.status === "ok") {
    return beautyDocsBffJson(
      { ok: true },
      { setCookie: result.setCookie },
    );
  }
  if (result.status === "unauthorized") {
    return beautyDocsBffError("authentication_required", 401);
  }
  if (result.status === "invalid-request") {
    return beautyDocsBffError("conflict", 409);
  }
  return beautyDocsBffError("unavailable", 503);
}
