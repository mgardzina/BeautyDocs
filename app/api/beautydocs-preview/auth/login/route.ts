import { NextRequest } from "next/server";
import { loginToBeautyDocs } from "../../../../../lib/beautydocs-admin-api";
import { parseBeautyDocsLoginCredentials } from "../../../../../lib/beautydocs-admin-contract";
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

  let credentials;
  try {
    credentials = parseBeautyDocsLoginCredentials(await readSmallJsonBody(request));
  } catch {
    return beautyDocsBffError("invalid_request", 400);
  }

  const result = await loginToBeautyDocs(credentials, origin);
  switch (result.status) {
    case "ok":
      return beautyDocsBffJson(result.data, {
        setCookie: result.setCookie,
      });
    case "mfa-required":
      return beautyDocsBffJson(result.data);
    case "unauthorized":
      return beautyDocsBffError("invalid_credentials", 401);
    default:
      return beautyDocsBffError("unavailable", 503);
  }
}
