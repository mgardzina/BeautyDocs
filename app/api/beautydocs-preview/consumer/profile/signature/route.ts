import { NextRequest, NextResponse } from "next/server";
import {
  deleteConsumerSignature,
  fetchConsumerSignature,
  updateConsumerSignature,
} from "@/lib/beautydocs-consumer-api";
import {
  beautyDocsBffError,
  beautyDocsBffJson,
  getValidatedBrowserOrigin,
} from "@/lib/beautydocs-bff-route";

export const runtime = "nodejs";

const MAX_SIGNATURE_BODY = 650_000;

export async function GET(request: NextRequest) {
  const result = await fetchConsumerSignature(request.headers.get("cookie"));
  if (result.status === "ok") {
    return new NextResponse(result.data, {
      status: 200,
      headers: {
        "cache-control": "private, no-store",
        "content-disposition": 'inline; filename="signature.png"',
        "content-security-policy": "default-src 'none'; sandbox",
        "content-type": "image/png",
        "x-content-type-options": "nosniff",
      },
    });
  }
  if (result.status === "unauthorized") {
    return beautyDocsBffError("authentication_required", 401);
  }
  if (result.status === "not-found") return beautyDocsBffError("not_found", 404);
  return beautyDocsBffError("unavailable", 503);
}

export async function PUT(request: NextRequest) {
  const origin = getValidatedBrowserOrigin(request);
  if (!origin) return beautyDocsBffError("forbidden", 403);
  let signature: string;
  try {
    const declaredLength = Number(request.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_SIGNATURE_BODY) {
      throw new Error("too large");
    }
    const text = await request.text();
    if (text.length > MAX_SIGNATURE_BODY) throw new Error("too large");
    const body = JSON.parse(text) as unknown;
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      typeof (body as Record<string, unknown>).signature !== "string"
    ) {
      throw new Error("invalid");
    }
    signature = (body as { signature: string }).signature;
  } catch {
    return beautyDocsBffError("invalid_request", 400);
  }
  const result = await updateConsumerSignature(
    signature,
    request.headers.get("cookie"),
    origin,
  );
  if (result.status === "ok") return beautyDocsBffJson({ ok: true });
  if (result.status === "unauthorized") {
    return beautyDocsBffError("authentication_required", 401);
  }
  if (result.status === "invalid") return beautyDocsBffError("invalid_request", 422);
  return beautyDocsBffError("unavailable", 503);
}

export async function DELETE(request: NextRequest) {
  const origin = getValidatedBrowserOrigin(request);
  if (!origin) return beautyDocsBffError("forbidden", 403);
  const result = await deleteConsumerSignature(
    request.headers.get("cookie"),
    origin,
  );
  if (result.status === "ok") return beautyDocsBffJson({ ok: true });
  if (result.status === "unauthorized") {
    return beautyDocsBffError("authentication_required", 401);
  }
  return beautyDocsBffError("unavailable", 503);
}
