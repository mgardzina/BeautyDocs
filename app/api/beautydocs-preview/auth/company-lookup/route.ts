import { NextRequest } from "next/server";
import { lookupBeautyDocsCompany } from "../../../../../lib/beautydocs-admin-api";
import {
  beautyDocsBffError,
  beautyDocsBffJson,
  getValidatedBrowserOrigin,
  readSmallJsonBody,
} from "../../../../../lib/beautydocs-bff-route";
import { isValidPolishNip, normalizePolishNip } from "../../../../../lib/polish-nip";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const origin = getValidatedBrowserOrigin(request);
  if (origin === null) return beautyDocsBffError("forbidden", 403);

  let nip: string;
  try {
    const raw = (await readSmallJsonBody(request)) as Record<string, unknown>;
    if (typeof raw.nip !== "string" || !isValidPolishNip(raw.nip)) {
      return beautyDocsBffError("invalid_nip", 422);
    }
    nip = normalizePolishNip(raw.nip);
  } catch {
    return beautyDocsBffError("invalid_request", 400);
  }

  const result = await lookupBeautyDocsCompany(
    nip,
    request.headers.get("cookie"),
    origin,
  );
  switch (result.status) {
    case "ok":
      return beautyDocsBffJson(result.data);
    case "unauthorized":
      return beautyDocsBffError("authentication_required", 401);
    case "not-found":
      return beautyDocsBffError("company_not_found", 404);
    case "invalid-request":
      return beautyDocsBffError("invalid_nip", 422);
    default:
      return beautyDocsBffError("regon_unavailable", 503);
  }
}
