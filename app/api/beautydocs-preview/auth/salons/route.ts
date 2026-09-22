import { NextRequest } from "next/server";
import { createBeautyDocsSalon } from "../../../../../lib/beautydocs-admin-api";
import {
  beautyDocsBffError,
  beautyDocsBffJson,
  getValidatedBrowserOrigin,
  readSmallJsonBody,
} from "../../../../../lib/beautydocs-bff-route";

export const runtime = "nodejs";

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

  let payload;
  try {
    const raw = (await readSmallJsonBody(request)) as Record<string, unknown>;
    const salonName = optionalString(raw.salonName, 200);
    const nip = optionalString(raw.nip, 20);
    const companyName = optionalString(raw.companyName, 250);
    const street = optionalString(raw.street, 250);
    const postalCode = optionalString(raw.postalCode, 20);
    const city = optionalString(raw.city, 120);
    if (
      salonName === null ||
      nip === null ||
      companyName === null ||
      street === null ||
      postalCode === null ||
      city === null
    ) {
      return beautyDocsBffError("invalid_company_data", 422);
    }
    payload = {
      salonName,
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

  const result = await createBeautyDocsSalon(
    payload,
    request.headers.get("cookie"),
    origin,
  );
  switch (result.status) {
    case "ok":
      return beautyDocsBffJson(result.data, { status: 201 });
    case "unauthorized":
      return beautyDocsBffError("authentication_required", 401);
    case "invalid-request":
      return beautyDocsBffError("invalid_company_data", 422);
    default:
      return beautyDocsBffError("unavailable", 503);
  }
}
