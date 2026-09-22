import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { validatedSameOrigin } from "./beautydocs-bff-security";

const MAX_BROWSER_REQUEST_CHARACTERS = 4_096;

export function getValidatedBrowserOrigin(request: NextRequest): string | null {
  return validatedSameOrigin({
    origin: request.headers.get("origin"),
    host: request.headers.get("host"),
    requestProtocol: request.nextUrl.protocol,
  });
}

export async function readSmallJsonBody(
  request: NextRequest,
  maxCharacters: number = MAX_BROWSER_REQUEST_CHARACTERS,
): Promise<unknown> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) {
    throw new Error("Unsupported content type");
  }

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxCharacters) {
    throw new Error("Request body is too large");
  }

  const body = await request.text();
  if (body.length > maxCharacters) {
    throw new Error("Request body is too large");
  }

  return JSON.parse(body) as unknown;
}

export function beautyDocsBffJson(
  body: unknown,
  options?: { readonly status?: number; readonly setCookie?: string | null },
): NextResponse {
  const response = NextResponse.json(body, {
    status: options?.status ?? 200,
  });
  response.headers.set("cache-control", "no-store");
  if (options?.setCookie) {
    response.headers.set("set-cookie", options.setCookie);
  }
  return response;
}

export function beautyDocsBffError(
  code:
    | "invalid_request"
    | "invalid_credentials"
    | "email_unverified"
    | "authentication_required"
    | "email_taken"
    | "invalid_code"
    | "invalid_registration"
    | "invalid_nip"
    | "invalid_company_data"
    | "company_not_found"
    | "regon_unavailable"
    | "account_not_found"
    | "rate_limited"
    | "conflict"
    | "phone_taken"
    | "sms_balance_required"
    | "forbidden"
    | "not_found"
    | "unavailable",
  status: number,
): NextResponse {
  return beautyDocsBffJson({ error: { code } }, { status });
}
