import { NextRequest } from "next/server";
import { logoutConsumer } from "@/lib/beautydocs-consumer-api";
import {
  beautyDocsBffError,
  beautyDocsBffJson,
  getValidatedBrowserOrigin,
} from "@/lib/beautydocs-bff-route";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const origin = getValidatedBrowserOrigin(request);
  if (!origin) return beautyDocsBffError("forbidden", 403);
  const result = await logoutConsumer(request.headers.get("cookie"), origin);
  if (result.status === "ok") {
    return beautyDocsBffJson(null, { setCookie: result.setCookie });
  }
  return beautyDocsBffError("unavailable", 503);
}
