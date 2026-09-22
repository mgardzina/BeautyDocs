import { NextRequest } from "next/server";
import { deleteConsumerAccount } from "@/lib/beautydocs-consumer-api";
import {
  beautyDocsBffError,
  beautyDocsBffJson,
  getValidatedBrowserOrigin,
  readSmallJsonBody,
} from "@/lib/beautydocs-bff-route";

export const runtime = "nodejs";

export async function DELETE(request: NextRequest) {
  const origin = getValidatedBrowserOrigin(request);
  if (!origin) return beautyDocsBffError("forbidden", 403);
  try {
    const raw = (await readSmallJsonBody(request)) as Record<string, unknown>;
    if (raw.confirmation !== "USUŃ KONTO") throw new Error();
  } catch {
    return beautyDocsBffError("invalid_request", 400);
  }
  const result = await deleteConsumerAccount(
    request.headers.get("cookie"),
    origin,
  );
  if (result.status === "ok") {
    return beautyDocsBffJson(
      { ok: true },
      { setCookie: result.setCookie },
    );
  }
  if (result.status === "unauthorized") {
    return beautyDocsBffError("authentication_required", 401);
  }
  return beautyDocsBffError("unavailable", 503);
}
