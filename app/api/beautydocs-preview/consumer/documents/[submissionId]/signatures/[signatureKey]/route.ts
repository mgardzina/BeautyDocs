import { NextRequest, NextResponse } from "next/server";
import { fetchConsumerDocumentSignature } from "@/lib/beautydocs-consumer-api";
import { beautyDocsBffError } from "@/lib/beautydocs-bff-route";

export const runtime = "nodejs";

interface Context {
  readonly params: Promise<{
    submissionId: string;
    signatureKey: string;
  }>;
}

export async function GET(request: NextRequest, context: Context) {
  const { submissionId, signatureKey } = await context.params;
  const result = await fetchConsumerDocumentSignature(
    submissionId,
    signatureKey,
    request.headers.get("cookie"),
  );
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
  if (result.status === "not-found") {
    return beautyDocsBffError("not_found", 404);
  }
  return beautyDocsBffError("unavailable", 503);
}
