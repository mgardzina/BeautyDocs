import "server-only";
import { resolveBeautyDocsInternalApiUrl } from "./beautydocs-internal-api";
import type {
  LegacyAdminUser, LegacyClient, LegacyClientNote, LegacyConsentForm,
  LegacyOtpVerification, LegacyTreatmentHistory,
} from "@/types/legacy-database";

type Query = {
  where?: Record<string, unknown>;
  data?: Record<string, unknown>;
  create?: Record<string, unknown>;
  update?: Record<string, unknown>;
  orderBy?: Record<string, "asc" | "desc">;
  select?: Record<string, boolean>;
  include?: Record<string, unknown>;
  take?: number;
};
type Selected<T, Q> = Q extends { select: infer S } ? Pick<T, Extract<keyof T, keyof S>> : T;
type Row<T, Q> = Selected<T, Q>
  & (Q extends { include: { forms: unknown } } ? { forms: LegacyConsentForm[] } : object)
  & (Q extends { include: { notes: unknown } } ? { notes: LegacyClientNote[] } : object)
  & (Q extends { include: { _count: unknown } } ? { _count: { forms: number; notes: number } } : object);

const DATE_FIELDS = new Set(["createdAt", "updatedAt", "expiresAt", "signatureVerifiedAt", "date"]);

function hydrate(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(hydrate);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, field]) => {
    if (DATE_FIELDS.has(key) && typeof field === "string") return [key, new Date(field)];
    if (key === "forms" || key === "notes") return [key, hydrate(field)];
    // JSON answers and audit evidence must retain their original values.
    return [key, field];
  }));
}

async function request<T>(entity: string, operation: string, query: Query): Promise<T> {
  const url = resolveBeautyDocsInternalApiUrl(`/internal/legacy-data/${entity}/${operation}`);
  const key = process.env.BEAUTYDOCS_LEGACY_SERVICE_KEY;
  if (!url || !key || key.length < 32) {
    throw new Error("Configure BEAUTYDOCS_API_INTERNAL_URL and BEAUTYDOCS_LEGACY_SERVICE_KEY for the admin API");
  }
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify(query),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
    redirect: "error",
  });
  if (!response.ok) throw new Error(`Admin database request failed (${response.status})`);
  return hydrate(await response.json()) as T;
}

function repository<T>(entity: string) {
  return {
    findMany: <Q extends Query>(query: Q) => request<Row<T, Q>[]>(entity, "findMany", query),
    findUnique: <Q extends Query>(query: Q) => request<Row<T, Q> | null>(entity, "findUnique", query),
    findFirst: <Q extends Query>(query: Q) => request<Row<T, Q> | null>(entity, "findFirst", query),
    create: <Q extends Query>(query: Q) => request<Row<T, Q>>(entity, "create", query),
    update: <Q extends Query>(query: Q) => request<Row<T, Q>>(entity, "update", query),
    delete: <Q extends Query>(query: Q) => request<Row<T, Q>>(entity, "delete", query),
    upsert: <Q extends Query>(query: Q) => request<Row<T, Q>>(entity, "upsert", query),
  };
}

/** Server-only transport. All persistence and transactions execute in Python. */
export const legacyDatabase = {
  client: repository<LegacyClient>("client"),
  clientNote: repository<LegacyClientNote>("clientNote"),
  consentForm: repository<LegacyConsentForm>("consentForm"),
  otpVerification: repository<LegacyOtpVerification>("otpVerification"),
  adminUser: repository<LegacyAdminUser>("adminUser"),
  treatmentHistory: repository<LegacyTreatmentHistory>("treatmentHistory"),
};
