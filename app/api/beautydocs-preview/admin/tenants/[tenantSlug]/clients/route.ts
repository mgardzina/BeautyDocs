import { NextRequest } from "next/server";
import { fetchBeautyDocsAdminClients } from "@/lib/beautydocs-admin-api";
import {
  BeautyDocsAdminContractError,
  parseBeautyDocsClientListQuery,
} from "@/lib/beautydocs-admin-contract";
import {
  beautyDocsBffError,
  beautyDocsBffJson,
} from "@/lib/beautydocs-bff-route";
import { isValidTenantSlug } from "@/lib/tenant-host";

export const runtime = "nodejs";

const ALLOWED_QUERY_KEYS = new Set(["search", "page", "pageSize"]);

interface TenantClientsRouteContext {
  readonly params: Promise<{ tenantSlug: string }>;
}

export async function GET(
  request: NextRequest,
  context: TenantClientsRouteContext,
) {
  const { tenantSlug } = await context.params;
  if (!isValidTenantSlug(tenantSlug)) {
    return beautyDocsBffError("not_found", 404);
  }

  const searchParams = request.nextUrl.searchParams;
  let hasUnknownKey = false;
  searchParams.forEach((_value, key) => {
    if (!ALLOWED_QUERY_KEYS.has(key)) {
      hasUnknownKey = true;
    }
  });
  if (
    hasUnknownKey ||
    Array.from(ALLOWED_QUERY_KEYS).some(
      (key) => searchParams.getAll(key).length > 1,
    )
  ) {
    return beautyDocsBffError("invalid_request", 422);
  }

  try {
    const query = parseBeautyDocsClientListQuery({
      search: searchParams.get("search"),
      page: searchParams.get("page"),
      pageSize: searchParams.get("pageSize"),
    });
    const result = await fetchBeautyDocsAdminClients(
      tenantSlug,
      query,
      request.headers.get("cookie"),
    );

    switch (result.status) {
      case "ok":
        return beautyDocsBffJson(result.data);
      case "unauthorized":
        return beautyDocsBffError("authentication_required", 401);
      case "forbidden":
        return beautyDocsBffError("forbidden", 403);
      case "not-found":
        return beautyDocsBffError("not_found", 404);
      case "invalid-request":
        return beautyDocsBffError("invalid_request", 422);
      default:
        return beautyDocsBffError("unavailable", 503);
    }
  } catch (error) {
    if (error instanceof BeautyDocsAdminContractError) {
      return beautyDocsBffError("invalid_request", 422);
    }
    return beautyDocsBffError("unavailable", 503);
  }
}
