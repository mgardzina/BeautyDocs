import { NextRequest } from "next/server";
import {
  addBeautyDocsSalonCatalogItem,
  fetchBeautyDocsSalonCatalog,
} from "@/lib/beautydocs-catalog-api";
import {
  beautyDocsBffError,
  beautyDocsBffJson,
  getValidatedBrowserOrigin,
  readSmallJsonBody,
} from "@/lib/beautydocs-bff-route";
import { isValidTenantSlug } from "@/lib/tenant-host";
import type { BeautyDocsSalonCatalogCreate } from "@/types/beautydocs-catalog";

export const runtime = "nodejs";

// A catalog item carries the platform's full editorial "details" blob
// (images, offers, safety notes, source documents) — comfortably larger
// than the generic small-body cap other admin routes use.
const MAX_CATALOG_CREATE_BODY_CHARACTERS = 64_000;

interface Context {
  readonly params: Promise<{ readonly tenantSlug: string }>;
}

export async function GET(request: NextRequest, context: Context) {
  const { tenantSlug } = await context.params;
  if (!isValidTenantSlug(tenantSlug)) return beautyDocsBffError("not_found", 404);
  return toResponse(
    await fetchBeautyDocsSalonCatalog(tenantSlug, request.headers.get("cookie")),
  );
}

export async function POST(request: NextRequest, context: Context) {
  const { tenantSlug } = await context.params;
  if (!isValidTenantSlug(tenantSlug)) return beautyDocsBffError("not_found", 404);
  const origin = getValidatedBrowserOrigin(request);
  if (origin === null) return beautyDocsBffError("forbidden", 403);
  try {
    const body = (await readSmallJsonBody(
      request,
      MAX_CATALOG_CREATE_BODY_CHARACTERS,
    )) as BeautyDocsSalonCatalogCreate;
    return toResponse(
      await addBeautyDocsSalonCatalogItem(
        tenantSlug,
        body,
        request.headers.get("cookie"),
        origin,
      ),
      201,
    );
  } catch {
    return beautyDocsBffError("invalid_request", 400);
  }
}

function toResponse(
  result: Awaited<
    ReturnType<
      typeof fetchBeautyDocsSalonCatalog | typeof addBeautyDocsSalonCatalogItem
    >
  >,
  status = 200,
) {
  if (result.status === "ok") return beautyDocsBffJson(result.data, { status });
  if (result.status === "unauthorized") {
    return beautyDocsBffError("authentication_required", 401);
  }
  if (result.status === "forbidden") return beautyDocsBffError("forbidden", 403);
  if (result.status === "not-found") return beautyDocsBffError("not_found", 404);
  if (result.status === "invalid") return beautyDocsBffError("invalid_request", 422);
  if (result.status === "conflict") return beautyDocsBffError("conflict", 409);
  return beautyDocsBffError("unavailable", 503);
}
