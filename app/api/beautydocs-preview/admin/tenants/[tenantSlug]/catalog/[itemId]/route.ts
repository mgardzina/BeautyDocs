import { NextRequest } from "next/server";
import {
  removeBeautyDocsSalonCatalogItem,
  updateBeautyDocsSalonCatalogItem,
} from "@/lib/beautydocs-catalog-api";
import {
  beautyDocsBffError,
  beautyDocsBffJson,
  getValidatedBrowserOrigin,
  readSmallJsonBody,
} from "@/lib/beautydocs-bff-route";
import { isValidTenantSlug } from "@/lib/tenant-host";
import type { BeautyDocsSalonCatalogUpdate } from "@/types/beautydocs-catalog";

export const runtime = "nodejs";

interface Context {
  readonly params: Promise<{ readonly tenantSlug: string; readonly itemId: string }>;
}

export async function PUT(request: NextRequest, context: Context) {
  const { tenantSlug, itemId } = await context.params;
  if (!isValidTenantSlug(tenantSlug)) return beautyDocsBffError("not_found", 404);
  const origin = getValidatedBrowserOrigin(request);
  if (origin === null) return beautyDocsBffError("forbidden", 403);
  try {
    const body = (await readSmallJsonBody(request)) as BeautyDocsSalonCatalogUpdate;
    return toResponse(
      await updateBeautyDocsSalonCatalogItem(
        tenantSlug,
        itemId,
        body,
        request.headers.get("cookie"),
        origin,
      ),
    );
  } catch {
    return beautyDocsBffError("invalid_request", 400);
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  const { tenantSlug, itemId } = await context.params;
  if (!isValidTenantSlug(tenantSlug)) return beautyDocsBffError("not_found", 404);
  const origin = getValidatedBrowserOrigin(request);
  if (origin === null) return beautyDocsBffError("forbidden", 403);
  const result = await removeBeautyDocsSalonCatalogItem(
    tenantSlug,
    itemId,
    request.headers.get("cookie"),
    origin,
  );
  if (result.status === "ok") return new Response(null, { status: 204 });
  return toResponse(result);
}

function toResponse(
  result: Awaited<
    ReturnType<
      typeof updateBeautyDocsSalonCatalogItem | typeof removeBeautyDocsSalonCatalogItem
    >
  >,
) {
  if (result.status === "ok") return beautyDocsBffJson(result.data);
  if (result.status === "unauthorized") {
    return beautyDocsBffError("authentication_required", 401);
  }
  if (result.status === "forbidden") return beautyDocsBffError("forbidden", 403);
  if (result.status === "not-found") return beautyDocsBffError("not_found", 404);
  if (result.status === "invalid") return beautyDocsBffError("invalid_request", 422);
  return beautyDocsBffError("unavailable", 503);
}
