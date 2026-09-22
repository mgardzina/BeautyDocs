import { NextRequest } from "next/server";
import { registerBeautyDocsAccount } from "../../../../../lib/beautydocs-admin-api";
import {
  beautyDocsBffError,
  beautyDocsBffJson,
  getValidatedBrowserOrigin,
  readSmallJsonBody,
} from "../../../../../lib/beautydocs-bff-route";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const origin = getValidatedBrowserOrigin(request);
  if (origin === null) {
    return beautyDocsBffError("forbidden", 403);
  }

  let email: string;
  try {
    const raw = (await readSmallJsonBody(request)) as Record<string, unknown>;
    const value = raw.email;
    // The e-mail-first flow only captures the address here; the salon, name,
    // password and company data are collected after the e-mail is verified.
    if (
      typeof value !== "string" ||
      value.length === 0 ||
      value.length > 320 ||
      !value.includes("@")
    ) {
      return beautyDocsBffError("invalid_request", 400);
    }
    email = value;
  } catch {
    return beautyDocsBffError("invalid_request", 400);
  }

  const result = await registerBeautyDocsAccount({ email }, origin);
  switch (result.status) {
    case "ok":
      return beautyDocsBffJson(result.data);
    case "email-taken":
      return beautyDocsBffError("email_taken", 409);
    case "invalid-request":
      return beautyDocsBffError("invalid_request", 400);
    default:
      return beautyDocsBffError("unavailable", 503);
  }
}
