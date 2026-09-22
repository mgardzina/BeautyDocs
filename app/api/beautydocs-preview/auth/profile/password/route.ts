import { NextRequest } from "next/server";
import { changeBeautyDocsUserPassword } from "@/lib/beautydocs-admin-api";
import {
  beautyDocsBffError,
  beautyDocsBffJson,
  getValidatedBrowserOrigin,
  readSmallJsonBody,
} from "@/lib/beautydocs-bff-route";

export const runtime = "nodejs";

export async function PUT(request: NextRequest) {
  const origin = getValidatedBrowserOrigin(request);
  if (origin === null) return beautyDocsBffError("forbidden", 403);

  let payload: { newPassword: string };
  try {
    const raw = (await readSmallJsonBody(request)) as Record<string, unknown>;
    if (
      Object.keys(raw).some(
        (key) =>
          key !== "newPassword" && key !== "confirmPassword",
      ) ||
      typeof raw.newPassword !== "string" ||
      raw.newPassword.length < 8 ||
      raw.newPassword.length > 1024 ||
      raw.confirmPassword !== raw.newPassword
    ) {
      throw new Error("invalid password payload");
    }
    payload = { newPassword: raw.newPassword };
  } catch {
    return beautyDocsBffError("invalid_request", 422);
  }

  const result = await changeBeautyDocsUserPassword(
    payload,
    request.headers.get("cookie"),
    origin,
  );
  if (result.status === "ok") return beautyDocsBffJson({ ok: true });
  if (result.status === "unauthorized") {
    return beautyDocsBffError("authentication_required", 401);
  }
  if (result.status === "invalid-request") {
    return beautyDocsBffError("invalid_request", 422);
  }
  if (result.status === "conflict") {
    return beautyDocsBffError("conflict", 409);
  }
  return beautyDocsBffError("unavailable", 503);
}
