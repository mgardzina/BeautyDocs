import "server-only";

import {
  filterBeautyDocsConsumerSessionCookie,
  filterBeautyDocsSessionCookie,
} from "./beautydocs-bff-security";
import { resolveBeautyDocsInternalApiUrl } from "./beautydocs-internal-api";
import { isValidTenantSlug } from "./tenant-host";
import type {
  BeautyDocsCatalogKind,
  BeautyDocsCatalogItem,
  BeautyDocsMedicineCatalogPage,
  BeautyDocsCatalogProductList,
  BeautyDocsCatalogSearchResult,
  BeautyDocsConsumerAftercare,
  BeautyDocsSalonCatalog,
  BeautyDocsSalonCatalogCreate,
  BeautyDocsSalonCatalogItem,
  BeautyDocsSalonCatalogUpdate,
} from "../types/beautydocs-catalog";

const APP_HOST = "app.beautydocs.pl";
const REQUEST_TIMEOUT_MS = 8_000;
// The reviewed public catalogue includes detailed local metadata for fewer than
// two thousand products. Keep a strict ceiling, but allow the complete list.
const MAX_RESPONSE_CHARACTERS = 8 * 1_024 * 1_024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type BeautyDocsCatalogApiResult<T> =
  | { readonly status: "ok"; readonly data: T }
  | { readonly status: "unauthorized" }
  | { readonly status: "forbidden" }
  | { readonly status: "not-found" }
  | { readonly status: "invalid" }
  | { readonly status: "conflict" }
  | { readonly status: "unavailable" };

export async function searchBeautyDocsCatalog(
  query: string,
  kind: BeautyDocsCatalogKind | null,
): Promise<BeautyDocsCatalogApiResult<BeautyDocsCatalogSearchResult>> {
  if (query.length > 100 || (kind !== null && !isCatalogKind(kind))) {
    return { status: "invalid" };
  }
  const params = new URLSearchParams({ q: query, limit: "30" });
  if (kind) params.set("kind", kind);
  return jsonRequest(
    `/api/v1/catalog/search?${params.toString()}`,
    { method: "GET" },
    parseCatalogSearch,
  );
}

export async function fetchBeautyDocsMedicineCatalog(
  query: string,
  page: number,
  pageSize = 30,
): Promise<BeautyDocsCatalogApiResult<BeautyDocsMedicineCatalogPage>> {
  if (
    query.length > 100 ||
    !Number.isInteger(page) ||
    page < 1 ||
    !Number.isInteger(pageSize) ||
    pageSize < 1 ||
    pageSize > 50
  ) {
    return { status: "invalid" };
  }
  const params = new URLSearchParams({
    q: query,
    page: String(page),
    pageSize: String(pageSize),
  });
  return jsonRequest(
    `/api/v1/catalog/medicines?${params.toString()}`,
    { method: "GET" },
    parseMedicineCatalogPage,
  );
}

export async function fetchBeautyDocsCatalogProducts(): Promise<
  BeautyDocsCatalogApiResult<BeautyDocsCatalogProductList>
> {
  return jsonRequest(
    "/api/v1/catalog/products",
    { method: "GET" },
    parseCatalogProductList,
  );
}

export async function fetchBeautyDocsCatalogProduct(
  productSlug: string,
): Promise<BeautyDocsCatalogApiResult<BeautyDocsCatalogItem>> {
  if (!/^[a-z0-9](?:[a-z0-9-]{0,158}[a-z0-9])?$/.test(productSlug)) {
    return { status: "invalid" };
  }
  return jsonRequest(
    `/api/v1/catalog/products/${encodeURIComponent(productSlug)}`,
    { method: "GET" },
    parseCatalogItem,
  );
}

export async function fetchBeautyDocsSalonCatalog(
  tenantSlug: string,
  cookie: string | null,
): Promise<BeautyDocsCatalogApiResult<BeautyDocsSalonCatalog>> {
  if (!isValidTenantSlug(tenantSlug)) return { status: "not-found" };
  return jsonRequest(
    `/api/v1/admin/tenants/${encodeURIComponent(tenantSlug)}/catalog`,
    { method: "GET", cookie, auth: "admin" },
    parseSalonCatalog,
  );
}

export async function addBeautyDocsSalonCatalogItem(
  tenantSlug: string,
  payload: BeautyDocsSalonCatalogCreate,
  cookie: string | null,
  origin: string,
): Promise<BeautyDocsCatalogApiResult<BeautyDocsSalonCatalogItem>> {
  if (!isValidTenantSlug(tenantSlug)) return { status: "not-found" };
  return jsonRequest(
    `/api/v1/admin/tenants/${encodeURIComponent(tenantSlug)}/catalog`,
    {
      method: "POST",
      cookie,
      auth: "admin",
      origin,
      body: JSON.stringify(payload),
    },
    parseSalonItem,
  );
}

export async function updateBeautyDocsSalonCatalogItem(
  tenantSlug: string,
  itemId: string,
  payload: BeautyDocsSalonCatalogUpdate,
  cookie: string | null,
  origin: string,
): Promise<BeautyDocsCatalogApiResult<BeautyDocsSalonCatalogItem>> {
  if (!isValidTenantSlug(tenantSlug) || !UUID_PATTERN.test(itemId)) {
    return { status: "not-found" };
  }
  return jsonRequest(
    `/api/v1/admin/tenants/${encodeURIComponent(tenantSlug)}` +
      `/catalog/${encodeURIComponent(itemId)}`,
    {
      method: "PUT",
      cookie,
      auth: "admin",
      origin,
      body: JSON.stringify(payload),
    },
    parseSalonItem,
  );
}

export async function removeBeautyDocsSalonCatalogItem(
  tenantSlug: string,
  itemId: string,
  cookie: string | null,
  origin: string,
): Promise<BeautyDocsCatalogApiResult<null>> {
  if (!isValidTenantSlug(tenantSlug) || !UUID_PATTERN.test(itemId)) {
    return { status: "not-found" };
  }
  const result = await rawRequest(
    `/api/v1/admin/tenants/${encodeURIComponent(tenantSlug)}` +
      `/catalog/${encodeURIComponent(itemId)}`,
    { method: "DELETE", cookie, auth: "admin", origin },
  );
  if (result === null) return { status: "unavailable" };
  if (result.status === 204) return { status: "ok", data: null };
  return statusResult(result.status);
}

export async function fetchConsumerAftercare(
  tenantSlug: string,
  treatmentCode: string,
  cookie: string | null,
): Promise<BeautyDocsCatalogApiResult<BeautyDocsConsumerAftercare>> {
  if (
    !isValidTenantSlug(tenantSlug) ||
    !/^[a-z0-9](?:[a-z0-9-]{0,98}[a-z0-9])?$/.test(treatmentCode)
  ) {
    return { status: "invalid" };
  }
  const params = new URLSearchParams({ tenantSlug, treatmentCode });
  return jsonRequest(
    `/api/v1/consumer/catalog/recommendations?${params.toString()}`,
    { method: "GET", cookie, auth: "consumer" },
    parseAftercare,
  );
}

interface RequestOptions {
  readonly method: "DELETE" | "GET" | "POST" | "PUT";
  readonly auth?: "admin" | "consumer";
  readonly cookie?: string | null;
  readonly origin?: string;
  readonly body?: string;
}

async function jsonRequest<T>(
  path: string,
  options: RequestOptions,
  parser: (value: unknown) => T,
): Promise<BeautyDocsCatalogApiResult<T>> {
  const result = await rawRequest(path, options);
  if (result === null) return { status: "unavailable" };
  if (result.status < 200 || result.status >= 300) return statusResult(result.status);
  try {
    return { status: "ok", data: parser(JSON.parse(result.body) as unknown) };
  } catch {
    return { status: "unavailable" };
  }
}

async function rawRequest(
  path: string,
  options: RequestOptions,
): Promise<{ readonly status: number; readonly body: string } | null> {
  const url = resolveBeautyDocsInternalApiUrl(path);
  if (url === null) return null;
  const headers = new Headers({ accept: "application/json", host: APP_HOST });
  const filteredCookie =
    options.auth === "admin"
      ? filterBeautyDocsSessionCookie(options.cookie ?? null)
      : options.auth === "consumer"
        ? filterBeautyDocsConsumerSessionCookie(options.cookie ?? null)
        : null;
  if (filteredCookie) headers.set("cookie", filteredCookie);
  if (options.origin) headers.set("origin", options.origin);
  if (options.body !== undefined) headers.set("content-type", "application/json");
  try {
    const response = await fetch(url, {
      method: options.method,
      headers,
      body: options.body,
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const body = await response.text();
    if (body.length > MAX_RESPONSE_CHARACTERS) return null;
    return { status: response.status, body };
  } catch {
    return null;
  }
}

function statusResult(status: number): BeautyDocsCatalogApiResult<never> {
  if (status === 400 || status === 422) return { status: "invalid" };
  if (status === 401) return { status: "unauthorized" };
  if (status === 403) return { status: "forbidden" };
  if (status === 404) return { status: "not-found" };
  if (status === 409) return { status: "conflict" };
  return { status: "unavailable" };
}

function parseCatalogSearch(value: unknown): BeautyDocsCatalogSearchResult {
  const record = asRecord(value);
  if (
    !Array.isArray(record.items) ||
    record.items.length > 50 ||
    typeof record.rplAvailable !== "boolean" ||
    typeof record.medicalNotice !== "string"
  ) {
    throw new Error("invalid catalog search");
  }
  return {
    items: record.items.map(parseCatalogItem),
    rplAvailable: record.rplAvailable,
    medicalNotice: record.medicalNotice,
  };
}

function parseCatalogProductList(value: unknown): BeautyDocsCatalogProductList {
  const record = asRecord(value);
  if (!Array.isArray(record.items) || record.items.length > 2_000) {
    throw new Error("invalid catalog product list");
  }
  return { items: record.items.map(parseCatalogItem) };
}

function parseMedicineCatalogPage(value: unknown): BeautyDocsMedicineCatalogPage {
  const record = asRecord(value);
  if (
    !Array.isArray(record.items) ||
    record.items.length > 50 ||
    !Number.isInteger(record.total) ||
    (record.total as number) < 0 ||
    !Number.isInteger(record.page) ||
    (record.page as number) < 1 ||
    !Number.isInteger(record.pageSize) ||
    (record.pageSize as number) < 1 ||
    (record.pageSize as number) > 50 ||
    !Number.isInteger(record.totalPages) ||
    (record.totalPages as number) < 0 ||
    typeof record.rplAvailable !== "boolean" ||
    typeof record.medicalNotice !== "string"
  ) {
    throw new Error("invalid medicine catalog page");
  }
  return {
    items: record.items.map(parseCatalogItem),
    total: record.total as number,
    page: record.page as number,
    pageSize: record.pageSize as number,
    totalPages: record.totalPages as number,
    rplAvailable: record.rplAvailable,
    medicalNotice: record.medicalNotice,
  };
}

function parseCatalogItem(value: unknown): BeautyDocsCatalogItem {
  const item = asRecord(value);
  if (
    typeof item.externalId !== "string" ||
    !isCatalogKind(item.kind) ||
    !isCatalogSource(item.source) ||
    typeof item.name !== "string" ||
    (item.brand !== null && typeof item.brand !== "string") ||
    typeof item.summary !== "string" ||
    typeof item.sourceLabel !== "string" ||
    typeof item.sourceUrl !== "string"
  ) {
    throw new Error("invalid catalog item");
  }
  return {
    externalId: item.externalId,
    kind: item.kind,
    source: item.source,
    name: item.name,
    brand: item.brand,
    summary: item.summary,
    details: asRecord(item.details),
    sourceLabel: item.sourceLabel,
    sourceUrl: item.sourceUrl,
  };
}

function parseSalonCatalog(value: unknown): BeautyDocsSalonCatalog {
  const record = asRecord(value);
  if (
    !Array.isArray(record.items) ||
    record.items.length > 500 ||
    typeof record.canManage !== "boolean"
  ) {
    throw new Error("invalid salon catalog");
  }
  return { items: record.items.map(parseSalonItem), canManage: record.canManage };
}

function parseSalonItem(value: unknown): BeautyDocsSalonCatalogItem {
  const item = asRecord(value);
  if (
    typeof item.id !== "string" ||
    !UUID_PATTERN.test(item.id) ||
    !isCatalogSource(item.source) ||
    !isCatalogKind(item.kind) ||
    typeof item.name !== "string" ||
    !Array.isArray(item.treatmentCodes) ||
    !item.treatmentCodes.every((code) => typeof code === "string") ||
    typeof item.usedInTreatments !== "boolean" ||
    typeof item.recommendedAftercare !== "boolean" ||
    typeof item.isSponsored !== "boolean" ||
    typeof item.isActive !== "boolean"
  ) {
    throw new Error("invalid salon catalog item");
  }
  return {
    id: item.id,
    source: item.source,
    externalId: nullableString(item.externalId),
    kind: item.kind,
    name: item.name,
    brand: nullableString(item.brand),
    summary: nullableString(item.summary),
    details: asRecord(item.details),
    sourceLabel: nullableString(item.sourceLabel),
    sourceUrl: nullableString(item.sourceUrl),
    usedInTreatments: item.usedInTreatments,
    recommendedAftercare: item.recommendedAftercare,
    treatmentCodes: item.treatmentCodes,
    recommendationNote: nullableString(item.recommendationNote),
    isSponsored: item.isSponsored,
    sponsorName: nullableString(item.sponsorName),
    isActive: item.isActive,
  };
}

function parseAftercare(value: unknown): BeautyDocsConsumerAftercare {
  const record = asRecord(value);
  if (
    typeof record.salonName !== "string" ||
    typeof record.treatmentCode !== "string" ||
    typeof record.notice !== "string" ||
    !Array.isArray(record.items) ||
    record.items.length > 100
  ) {
    throw new Error("invalid aftercare response");
  }
  return {
    salonName: record.salonName,
    treatmentCode: record.treatmentCode,
    notice: record.notice,
    items: record.items.map(parseSalonItem),
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("expected object");
  }
  return value as Record<string, unknown>;
}

function nullableString(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string") throw new Error("expected nullable string");
  return value;
}

function isCatalogKind(value: unknown): value is BeautyDocsCatalogKind {
  return ["MEDICINE", "TREATMENT_SUBSTANCE", "DEVICE", "COSMETIC"].includes(
    String(value),
  );
}

function isCatalogSource(value: unknown): value is "RPL" | "BEAUTYDOCS" | "SALON" {
  return ["RPL", "BEAUTYDOCS", "SALON"].includes(String(value));
}
