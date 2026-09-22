import type { TenantActiveForm } from "../types/tenant";
import { isValidTenantSlug } from "./tenant-host";

const FORM_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,98}[a-z0-9])?$/;

/** Canonical form codes are lowercase URL-safe path segments. */
export function isValidFormSlug(value: string): boolean {
  return FORM_SLUG_PATTERN.test(value);
}

export function findActiveFormBySlug(
  forms: readonly TenantActiveForm[],
  formSlug: string,
): TenantActiveForm | null {
  if (!isValidFormSlug(formSlug)) {
    return null;
  }

  return forms.find((form) => form.code === formSlug) ?? null;
}

export function beautyDocsFormPreviewPath(
  tenantSlug: string,
  formSlug: string,
): string {
  if (!isValidTenantSlug(tenantSlug) || !isValidFormSlug(formSlug)) {
    throw new TypeError("BeautyDocs form path contains an invalid slug");
  }

  return `/f/${encodeURIComponent(tenantSlug)}/${encodeURIComponent(formSlug)}`;
}
