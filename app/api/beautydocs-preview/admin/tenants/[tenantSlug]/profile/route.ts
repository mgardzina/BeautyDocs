import { NextRequest } from "next/server";
import { requestSalonProfile } from "@/lib/beautydocs-admin-api";
import { beautyDocsBffError, beautyDocsBffJson, getValidatedBrowserOrigin } from "@/lib/beautydocs-bff-route";

type Context = { params: Promise<{ tenantSlug: string }> };
async function handle(request: NextRequest, context: Context, method: "GET" | "PUT") {
  const { tenantSlug } = await context.params;
  const origin = method === "PUT" ? getValidatedBrowserOrigin(request) : undefined;
  if (origin === null) return beautyDocsBffError("forbidden", 403);
  let body: string | undefined;
  if (method === "PUT") {
    if (Number(request.headers.get("content-length")) > 2_000_000) return beautyDocsBffError("invalid_request", 413);
    // Bound streamed requests as well as Content-Length.
    const reader = request.body?.getReader();
    if (!reader) return beautyDocsBffError("invalid_request", 400);
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > 2_000_000) { await reader.cancel(); return beautyDocsBffError("invalid_request", 413); }
      chunks.push(value);
    }
    body = Buffer.concat(chunks).toString("utf8");
    try { JSON.parse(body); } catch { return beautyDocsBffError("invalid_request", 400); }
  }
  const result = await requestSalonProfile(tenantSlug, method, request.headers.get("cookie"), origin, body);
  if (result.status === "ok") return beautyDocsBffJson(result.data);
  const status = result.status === "unauthorized" ? 401 : result.status === "forbidden" ? 403 : result.status === "not-found" ? 404 : result.status === "invalid-request" ? 422 : 503;
  return beautyDocsBffError(status === 401 ? "authentication_required" : status === 403 ? "forbidden" : status === 404 ? "not_found" : status === 422 ? "invalid_request" : "unavailable", status);
}
export const GET = (request: NextRequest, context: Context) => handle(request, context, "GET");
export const PUT = (request: NextRequest, context: Context) => handle(request, context, "PUT");
