import { NextRequest } from "next/server";
import { confirmBeautyDocsPractitionerVerification } from "@/lib/beautydocs-admin-api";
import {
  isBeautyDocsClientId,
  isBeautyDocsSubmissionId,
} from "@/lib/beautydocs-admin-contract";
import {
  beautyDocsBffError,
  beautyDocsBffJson,
  getValidatedBrowserOrigin,
  readSmallJsonBody,
} from "@/lib/beautydocs-bff-route";
import { isValidTenantSlug } from "@/lib/tenant-host";

export const runtime = "nodejs";

interface Context {
  readonly params: Promise<{
    tenantSlug: string;
    clientId: string;
    submissionId: string;
  }>;
}

export async function POST(request: NextRequest, context: Context) {
  const { tenantSlug, clientId, submissionId } = await context.params;
  if (
    !isValidTenantSlug(tenantSlug) ||
    !isBeautyDocsClientId(clientId) ||
    !isBeautyDocsSubmissionId(submissionId)
  ) {
    return beautyDocsBffError("not_found", 404);
  }
  const origin = getValidatedBrowserOrigin(request);
  if (origin === null) return beautyDocsBffError("forbidden", 403);
  try {
    const value = await readSmallJsonBody(request);
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("invalid body");
    }
    const body = value as Record<string, unknown>;
    if (
      typeof body.verificationId !== "string" ||
      typeof body.code !== "string" ||
      !/^\d{6}$/.test(body.code)
    ) {
      throw new Error("invalid body");
    }
    const result = await confirmBeautyDocsPractitionerVerification(
      tenantSlug,
      clientId,
      submissionId,
      { verificationId: body.verificationId, code: body.code },
      request.headers.get("cookie"),
      origin,
      request.headers.get("user-agent"),
    );
    switch (result.status) {
      case "ok":
        return beautyDocsBffJson({ status: "VERIFIED" });
      case "unauthorized":
        return beautyDocsBffError("authentication_required", 401);
      case "forbidden":
        return beautyDocsBffError("forbidden", 403);
      case "not-found":
        return beautyDocsBffError("not_found", 404);
      case "invalid-request":
        return beautyDocsBffError("invalid_code", 400);
      default:
        return beautyDocsBffError("unavailable", 503);
    }
  } catch {
    return beautyDocsBffError("invalid_request", 400);
  }
}
