import { NextRequest, NextResponse } from "next/server";
import {
  fetchBeautyDocsAdminTeamMemberSignature,
  setBeautyDocsAdminTeamMemberSignature,
} from "@/lib/beautydocs-admin-api";
import { isBeautyDocsTeamMemberId } from "@/lib/beautydocs-admin-contract";
import {
  beautyDocsBffError,
  beautyDocsBffJson,
  getValidatedBrowserOrigin,
} from "@/lib/beautydocs-bff-route";
import { isValidTenantSlug } from "@/lib/tenant-host";

export const runtime = "nodejs";
const MAX_SIGNATURE_BODY = 650_000;

interface TeamMemberSignatureRouteContext {
  readonly params: Promise<{ tenantSlug: string; memberId: string }>;
}

export async function GET(
  request: NextRequest,
  context: TeamMemberSignatureRouteContext,
) {
  const ids = await validatedIds(context);
  if (ids === null) return beautyDocsBffError("not_found", 404);
  const result = await fetchBeautyDocsAdminTeamMemberSignature(
    ids.tenantSlug,
    ids.memberId,
    request.headers.get("cookie"),
  );
  if (result.status === "ok") {
    return pngResponse(result.data);
  }
  return imageError(result.status);
}

export async function PUT(
  request: NextRequest,
  context: TeamMemberSignatureRouteContext,
) {
  const ids = await validatedIds(context);
  if (ids === null) return beautyDocsBffError("not_found", 404);
  const origin = getValidatedBrowserOrigin(request);
  if (origin === null) return beautyDocsBffError("forbidden", 403);
  try {
    const declaredLength = Number(request.headers.get("content-length"));
    if (
      Number.isFinite(declaredLength) &&
      declaredLength > MAX_SIGNATURE_BODY
    ) {
      throw new Error("too large");
    }
    const text = await request.text();
    if (text.length > MAX_SIGNATURE_BODY) throw new Error("too large");
    const body = JSON.parse(text) as unknown;
    if (
      typeof body !== "object" ||
      body === null ||
      Array.isArray(body) ||
      Object.keys(body).length !== 1 ||
      typeof (body as Record<string, unknown>).signature !== "string"
    ) {
      throw new Error("invalid body");
    }
    const result = await setBeautyDocsAdminTeamMemberSignature(
      ids.tenantSlug,
      ids.memberId,
      (body as { signature: string }).signature,
      request.headers.get("cookie"),
      origin,
    );
    switch (result.status) {
      case "ok":
        return beautyDocsBffJson(result.data);
      case "unauthorized":
        return beautyDocsBffError("authentication_required", 401);
      case "forbidden":
        return beautyDocsBffError("forbidden", 403);
      case "not-found":
        return beautyDocsBffError("not_found", 404);
      case "invalid-request":
        return beautyDocsBffError("invalid_request", 422);
      default:
        return beautyDocsBffError("unavailable", 503);
    }
  } catch {
    return beautyDocsBffError("invalid_request", 400);
  }
}

async function validatedIds(context: TeamMemberSignatureRouteContext) {
  const { tenantSlug, memberId } = await context.params;
  return isValidTenantSlug(tenantSlug) &&
    isBeautyDocsTeamMemberId(memberId)
    ? { tenantSlug, memberId }
    : null;
}

function pngResponse(body: ArrayBuffer) {
  return new NextResponse(body, {
    status: 200,
    headers: {
      "cache-control": "private, no-store",
      "content-disposition": 'inline; filename="signature.png"',
      "content-security-policy": "default-src 'none'; sandbox",
      "content-type": "image/png",
      "x-content-type-options": "nosniff",
    },
  });
}

function imageError(status: string) {
  if (status === "unauthorized") {
    return beautyDocsBffError("authentication_required", 401);
  }
  if (status === "forbidden") return beautyDocsBffError("forbidden", 403);
  if (status === "not-found") return beautyDocsBffError("not_found", 404);
  return beautyDocsBffError("unavailable", 503);
}
