import { NextRequest } from "next/server";
import { uploadConsumerChatAttachment } from "@/lib/beautydocs-consumer-api";
import {
  beautyDocsBffError,
  beautyDocsBffJson,
  getValidatedBrowserOrigin,
} from "@/lib/beautydocs-bff-route";

export const runtime = "nodejs";
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const origin = getValidatedBrowserOrigin(request);
  if (origin === null) return beautyDocsBffError("forbidden", 403);
  const tenantSlug = request.headers.get("x-beautydocs-tenant-slug") ?? "";
  const fileName = decodeHeader(request.headers.get("x-beautydocs-file-name"));
  const caption = decodeHeader(request.headers.get("x-beautydocs-message-body"));
  const contentType = request.headers.get("content-type") ?? "application/octet-stream";
  const body = await readAttachment(request);
  if (body === null || !/^[a-z0-9-]{1,63}$/.test(tenantSlug)) {
    return beautyDocsBffError("invalid_request", 422);
  }
  const result = await uploadConsumerChatAttachment(
    null,
    { tenantSlug, fileName, caption, contentType, body },
    request.headers.get("cookie"),
    origin,
  );
  if (result.status === "ok") return beautyDocsBffJson(result.data, { status: 201 });
  if (result.status === "unauthorized") return beautyDocsBffError("authentication_required", 401);
  if (result.status === "forbidden") return beautyDocsBffError("forbidden", 403);
  if (result.status === "not-found") return beautyDocsBffError("not_found", 404);
  if (result.status === "invalid") return beautyDocsBffError("invalid_request", 422);
  return beautyDocsBffError("unavailable", 503);
}

function decodeHeader(value: string | null): string {
  try {
    return decodeURIComponent(value ?? "");
  } catch {
    return "";
  }
}

async function readAttachment(request: NextRequest): Promise<ArrayBuffer | null> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_ATTACHMENT_BYTES) return null;
  const body = await request.arrayBuffer();
  return body.byteLength > 0 && body.byteLength <= MAX_ATTACHMENT_BYTES ? body : null;
}
