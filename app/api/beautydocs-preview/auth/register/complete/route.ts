import { NextRequest } from "next/server";
import { completeBeautyDocsRegistration } from "../../../../../../lib/beautydocs-admin-api";
import {
  beautyDocsBffError,
  beautyDocsBffJson,
  getValidatedBrowserOrigin,
  readSmallJsonBody,
} from "../../../../../../lib/beautydocs-bff-route";

export const runtime = "nodejs";

function requiredString(value: unknown, max: number): string | null {
  return typeof value === "string" && value.length > 0 && value.length <= max
    ? value
    : null;
}

function optionalString(value: unknown, max: number): string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  return typeof value === "string" && value.length <= max ? value : null;
}

export async function POST(request: NextRequest) {
  const origin = getValidatedBrowserOrigin(request);
  if (origin === null) {
    return beautyDocsBffError("forbidden", 403);
  }

  let payload: Parameters<typeof completeBeautyDocsRegistration>[0];
  try {
    const raw = (await readSmallJsonBody(request)) as Record<string, unknown>;
    const registrationToken = requiredString(raw.registrationToken, 128);
    const fullName = requiredString(raw.fullName, 200);
    const salonName = requiredString(raw.salonName, 200);
    const password = requiredString(raw.password, 1024);
    const nip = requiredString(raw.nip, 20);
    const companyName = requiredString(raw.companyName, 250);
    const street = requiredString(raw.street, 250);
    const postalCode = requiredString(raw.postalCode, 20);
    const city = requiredString(raw.city, 120);
    if (
      registrationToken === null ||
      fullName === null ||
      salonName === null ||
      password === null ||
      password.length < 8 ||
      nip === null ||
      companyName === null ||
      street === null ||
      postalCode === null ||
      city === null
    ) {
      return beautyDocsBffError("invalid_request", 400);
    }
    payload = {
      registrationToken,
      fullName,
      salonName,
      password,
      nip,
      regon: optionalString(raw.regon, 14),
      krs: optionalString(raw.krs, 10),
      companyName,
      street,
      postalCode,
      city,
    };
  } catch {
    return beautyDocsBffError("invalid_request", 400);
  }

  const result = await completeBeautyDocsRegistration(payload, origin);
  switch (result.status) {
    case "ok":
      // Account created and the owner is logged in — pass the session cookie on.
      return beautyDocsBffJson(result.data, { setCookie: result.setCookie });
    case "invalid-registration":
      return beautyDocsBffError("invalid_registration", 400);
    case "email-taken":
      return beautyDocsBffError("email_taken", 409);
    case "invalid-request":
      return beautyDocsBffError("invalid_company_data", 422);
    default:
      return beautyDocsBffError("unavailable", 503);
  }
}
