import { NextRequest } from "next/server";
import { updateBeautyDocsAdminNotification } from "@/lib/beautydocs-admin-api";
import { isBeautyDocsNotificationId } from "@/lib/beautydocs-admin-contract";
import {
  beautyDocsBffError,
  beautyDocsBffJson,
  getValidatedBrowserOrigin,
  readSmallJsonBody,
} from "@/lib/beautydocs-bff-route";
import { isValidTenantSlug } from "@/lib/tenant-host";

export const runtime = "nodejs";

interface Context {
  readonly params: Promise<{ tenantSlug: string; notificationId: string }>;
}

export async function PATCH(request: NextRequest, context: Context) {
  const { tenantSlug, notificationId } = await context.params;
  if (
    !isValidTenantSlug(tenantSlug) ||
    !isBeautyDocsNotificationId(notificationId)
  ) {
    return beautyDocsBffError("not_found", 404);
  }
  const origin = getValidatedBrowserOrigin(request);
  if (origin === null) return beautyDocsBffError("forbidden", 403);

  let update: { read?: boolean; archived?: boolean };
  try {
    const raw = (await readSmallJsonBody(request)) as Record<string, unknown>;
    const keys = Object.keys(raw);
    if (
      keys.length === 0 ||
      keys.some((key) => key !== "read" && key !== "archived") ||
      (raw.read !== undefined && typeof raw.read !== "boolean") ||
      (raw.archived !== undefined && typeof raw.archived !== "boolean")
    ) {
      throw new Error("invalid notification update");
    }
    update = {
      ...(typeof raw.read === "boolean" ? { read: raw.read } : {}),
      ...(typeof raw.archived === "boolean"
        ? { archived: raw.archived }
        : {}),
    };
  } catch {
    return beautyDocsBffError("invalid_request", 400);
  }

  const result = await updateBeautyDocsAdminNotification(
    tenantSlug,
    notificationId,
    update,
    request.headers.get("cookie"),
    origin,
  );
  if (result.status === "ok") return beautyDocsBffJson(result.data);
  if (result.status === "unauthorized") {
    return beautyDocsBffError("authentication_required", 401);
  }
  if (result.status === "forbidden") {
    return beautyDocsBffError("forbidden", 403);
  }
  if (result.status === "not-found") {
    return beautyDocsBffError("not_found", 404);
  }
  if (result.status === "invalid-request") {
    return beautyDocsBffError("invalid_request", 422);
  }
  return beautyDocsBffError("unavailable", 503);
}
