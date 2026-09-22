import { NextRequest } from "next/server";
import {
  acceptBeautyDocsStaffInvitation,
  fetchBeautyDocsStaffInvitation,
} from "@/lib/beautydocs-admin-api";
import {
  beautyDocsBffError,
  beautyDocsBffJson,
  getValidatedBrowserOrigin,
  readSmallJsonBody,
} from "@/lib/beautydocs-bff-route";

export const runtime = "nodejs";

interface RouteContext {
  readonly params: Promise<{ token: string }>;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const { token } = await context.params;
  const result = await fetchBeautyDocsStaffInvitation(token);
  if (result.status === "ok") return beautyDocsBffJson(result.data);
  if (result.status === "invalid-request" || result.status === "not-found") {
    return beautyDocsBffError("not_found", 404);
  }
  return beautyDocsBffError("unavailable", 503);
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { token } = await context.params;
  const origin = getValidatedBrowserOrigin(request);
  if (origin === null) return beautyDocsBffError("forbidden", 403);
  try {
    const raw = await readSmallJsonBody(request);
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
      throw new Error("invalid body");
    }
    const body = raw as Record<string, unknown>;
    if (
      Object.keys(body).sort().join(",") !== ["fullName", "password"].sort().join(",") ||
      typeof body.fullName !== "string" ||
      body.fullName.trim().length < 2 ||
      body.fullName.length > 200 ||
      typeof body.password !== "string" ||
      body.password.length < 8 ||
      body.password.length > 1024
    ) {
      throw new Error("invalid body");
    }
    const result = await acceptBeautyDocsStaffInvitation(
      token,
      { fullName: body.fullName.trim(), password: body.password },
      origin,
    );
    if (result.status === "ok") {
      return beautyDocsBffJson(result.data, { setCookie: result.setCookie });
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
