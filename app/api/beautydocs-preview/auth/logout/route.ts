import { NextRequest, NextResponse } from "next/server";
import { logoutFromBeautyDocs } from "../../../../../lib/beautydocs-admin-api";
import {
  beautyDocsBffError,
  getValidatedBrowserOrigin,
} from "../../../../../lib/beautydocs-bff-route";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const origin = getValidatedBrowserOrigin(request);
  if (origin === null) {
    return beautyDocsBffError("forbidden", 403);
  }

  const result = await logoutFromBeautyDocs(
    request.headers.get("cookie"),
    origin,
  );

  if (result.status === "ok") {
    const response = new NextResponse(null, { status: 204 });
    response.headers.set("cache-control", "no-store");
    if (result.setCookie) {
      response.headers.set("set-cookie", result.setCookie);
    }
    return response;
  }

  if (result.status === "unauthorized") {
    return beautyDocsBffError("authentication_required", 401);
  }

  return beautyDocsBffError("unavailable", 503);
}
