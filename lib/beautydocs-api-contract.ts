import { isValidTenantSlug } from "./tenant-host";
import { isBeautyDocsLocale, type BeautyDocsLocale } from "./i18n/config";
import { isValidFormSlug } from "./beautydocs-form-path";
import type {
  FormConsent,
  FormContraindicationItem,
  FormField,
  FormSection,
  PublicFormContent,
  TenantActiveForm,
  TenantLegalDetails,
  TenantPostalAddress,
  TenantPublicConfig,
  TenantPublicContact,
} from "../types/tenant";

const TENANT_CONFIG_KEYS = [
  "slug",
  "displayName",
  "legalName",
  "logoUrl",
  "legal",
  "contact",
  "activeForms",
] as const;
const LEGAL_KEYS = ["nip", "address", "privacyContactEmail"] as const;
const ADDRESS_KEYS = ["street", "postalCode", "city", "countryCode"] as const;
const CONTACT_KEYS = ["phone", "email", "websiteUrl"] as const;
const ACTIVE_FORM_KEYS = ["code", "displayName", "displayOrder"] as const;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type TenantPublicConfigLoadResult =
  | { readonly status: "ok"; readonly config: TenantPublicConfig }
  | { readonly status: "not-found" }
  | {
      readonly status: "unavailable";
      readonly reason: "configuration" | "network" | "api" | "invalid-response";
    };

export class BeautyDocsApiContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BeautyDocsApiContractError";
  }
}

export function publicTenantConfigEndpointPath(
  tenantSlug: string,
  locale?: BeautyDocsLocale,
): string {
  if (!isValidTenantSlug(tenantSlug)) {
    throw contractError("tenant slug is invalid");
  }

  const path = `/api/v1/public/tenants/${encodeURIComponent(tenantSlug)}`;
  return locale && locale !== "pl" ? `${path}?lang=${locale}` : path;
}

/**
 * Strict runtime boundary between FastAPI and Next.js.
 *
 * The parser intentionally rejects snake_case, missing and unknown fields so a
 * cross-language contract drift becomes an unavailable state instead of
 * leaking malformed data into the public interface.
 */
export function parseTenantPublicConfig(value: unknown): TenantPublicConfig {
  const config = expectRecord(value, "tenant");
  expectExactKeys(config, TENANT_CONFIG_KEYS, "tenant");

  const slug = expectString(config.slug, "tenant.slug", 63);
  if (!isValidTenantSlug(slug)) {
    throw contractError("tenant.slug is not a valid salon slug");
  }

  const activeFormsValue = config.activeForms;
  if (!Array.isArray(activeFormsValue) || activeFormsValue.length > 100) {
    throw contractError("tenant.activeForms must be an array of at most 100 items");
  }

  const activeForms = activeFormsValue.map(parseActiveForm);
  const formCodes = new Set(activeForms.map((form) => form.code));
  if (formCodes.size !== activeForms.length) {
    throw contractError("tenant.activeForms contains duplicate form codes");
  }

  return {
    slug,
    displayName: expectString(config.displayName, "tenant.displayName", 200),
    legalName: expectString(config.legalName, "tenant.legalName", 250),
    logoUrl: expectNullableString(config.logoUrl, "tenant.logoUrl", 320_000),
    legal: parseLegalDetails(config.legal),
    contact: parsePublicContact(config.contact),
    activeForms: activeForms.sort(
      (left, right) => left.displayOrder - right.displayOrder,
    ),
  };
}

export function parseTenantPublicConfigResponse(
  status: number,
  responseBody: string,
): TenantPublicConfigLoadResult {
  if (status === 404) {
    return { status: "not-found" };
  }

  if (status !== 200) {
    return { status: "unavailable", reason: "api" };
  }

  try {
    return {
      status: "ok",
      config: parseTenantPublicConfig(JSON.parse(responseBody) as unknown),
    };
  } catch {
    return { status: "unavailable", reason: "invalid-response" };
  }
}

export interface PlatformStats {
  readonly companyCount: number;
  readonly signedFormCount: number;
  readonly availableFormCount: number;
}

export type PlatformStatsLoadResult =
  | { readonly status: "ok"; readonly stats: PlatformStats }
  | { readonly status: "unavailable" };

export function platformStatsEndpointPath(): string {
  return "/api/v1/public/platform-stats";
}

const PLATFORM_STATS_KEYS = [
  "companyCount",
  "signedFormCount",
  "availableFormCount",
] as const;

export function parsePlatformStats(value: unknown): PlatformStats {
  const record = expectRecord(value, "platformStats");
  expectExactKeys(record, PLATFORM_STATS_KEYS, "platformStats");

  return {
    companyCount: expectCount(record.companyCount, "platformStats.companyCount"),
    signedFormCount: expectCount(
      record.signedFormCount,
      "platformStats.signedFormCount",
    ),
    availableFormCount: expectCount(
      record.availableFormCount,
      "platformStats.availableFormCount",
    ),
  };
}

export function parsePlatformStatsResponse(
  status: number,
  responseBody: string,
): PlatformStatsLoadResult {
  if (status !== 200) {
    return { status: "unavailable" };
  }

  try {
    return {
      status: "ok",
      stats: parsePlatformStats(JSON.parse(responseBody) as unknown),
    };
  } catch {
    return { status: "unavailable" };
  }
}

export interface PublicFormSubmissionResult {
  readonly submissionId: string;
  readonly clientId: string;
  readonly status: string;
  readonly claimToken: string;
  readonly claimExpiresInSeconds: number;
}

export interface PublicFormVerificationStart {
  readonly submissionId: string;
  readonly clientId: string;
  readonly submissionToken: string;
  readonly verificationId: string;
  readonly destinationMasked: string;
  readonly expiresInSeconds: number;
  readonly devCode: string | null;
}

export interface PublicFormVerificationConfirmed {
  readonly verificationId: string;
  readonly status: "VERIFIED";
  readonly verifiedAt: string;
}

export type PublicFormVerificationStartOutcome =
  | { readonly status: "ok"; readonly data: PublicFormVerificationStart }
  | { readonly status: "invalid" | "not-found" | "forbidden" | "rate-limited" | "unavailable" };

export type PublicFormVerificationConfirmOutcome =
  | { readonly status: "ok"; readonly data: PublicFormVerificationConfirmed }
  | { readonly status: "invalid-code" | "not-found" | "forbidden" | "unavailable" };

export type PublicFormSubmitOutcome =
  | { readonly status: "ok"; readonly data: PublicFormSubmissionResult }
  | { readonly status: "invalid" }
  | { readonly status: "not-found" }
  | { readonly status: "forbidden" }
  | { readonly status: "unavailable" };

export function publicTenantFormSubmissionEndpointPath(
  tenantSlug: string,
  formCode: string,
): string {
  if (!isValidTenantSlug(tenantSlug)) {
    throw contractError("tenant slug is invalid");
  }
  if (!isValidFormSlug(formCode)) {
    throw contractError("form code is invalid");
  }
  return `/api/v1/public/tenants/${encodeURIComponent(tenantSlug)}/forms/${encodeURIComponent(formCode)}/submissions`;
}

export function publicTenantFormClientVerificationEndpointPath(
  tenantSlug: string,
  formCode: string,
): string {
  return `${publicTenantFormSubmissionEndpointPath(tenantSlug, formCode)}/client-verification`;
}

export function publicTenantFormSubmissionClientVerificationEndpointPath(
  tenantSlug: string,
  formCode: string,
  submissionId: string,
): string {
  if (!UUID_PATTERN.test(submissionId)) {
    throw contractError("submission id is invalid");
  }
  return (
    `${publicTenantFormSubmissionEndpointPath(tenantSlug, formCode)}` +
    `/${encodeURIComponent(submissionId)}/client-verification`
  );
}

export function publicTenantFormSubmissionClientVerificationConfirmEndpointPath(
  tenantSlug: string,
  formCode: string,
  submissionId: string,
): string {
  return (
    publicTenantFormSubmissionClientVerificationEndpointPath(
      tenantSlug,
      formCode,
      submissionId,
    ) + "/confirm"
  );
}

export function publicTenantFormClientSignatureEndpointPath(
  tenantSlug: string,
  formCode: string,
  submissionId: string,
): string {
  if (!UUID_PATTERN.test(submissionId)) {
    throw contractError("submission id is invalid");
  }
  return (
    `${publicTenantFormSubmissionEndpointPath(tenantSlug, formCode)}` +
    `/${encodeURIComponent(submissionId)}/client-signature`
  );
}

export function parsePublicFormVerificationStartResponse(
  status: number,
  body: string,
): PublicFormVerificationStartOutcome {
  if (status === 429) return { status: "rate-limited" };
  if (status === 422) return { status: "invalid" };
  if (status === 403) return { status: "forbidden" };
  if (status === 404) return { status: "not-found" };
  if (status !== 201 && status !== 200) return { status: "unavailable" };
  try {
    const value = expectRecord(JSON.parse(body) as unknown, "verification");
    return {
      status: "ok",
      data: {
        submissionId: expectUuid(value.submissionId, "verification.submissionId"),
        clientId: expectUuid(value.clientId, "verification.clientId"),
        submissionToken: expectString(
          value.submissionToken,
          "verification.submissionToken",
          43,
        ),
        verificationId: expectUuid(
          value.verificationId,
          "verification.verificationId",
        ),
        destinationMasked: expectString(
          value.destinationMasked,
          "verification.destinationMasked",
          64,
        ),
        expiresInSeconds: expectCount(
          value.expiresInSeconds,
          "verification.expiresInSeconds",
        ),
        devCode: expectNullableString(value.devCode, "verification.devCode", 6),
      },
    };
  } catch {
    return { status: "unavailable" };
  }
}

export function parsePublicFormVerificationConfirmResponse(
  status: number,
  body: string,
): PublicFormVerificationConfirmOutcome {
  if (status === 400 || status === 422 || status === 409) {
    return { status: "invalid-code" };
  }
  if (status === 403) return { status: "forbidden" };
  if (status === 404) return { status: "not-found" };
  if (status !== 200) return { status: "unavailable" };
  try {
    const value = expectRecord(JSON.parse(body) as unknown, "verification");
    const verificationStatus = expectString(
      value.status,
      "verification.status",
      16,
    );
    if (verificationStatus !== "VERIFIED") {
      return { status: "unavailable" };
    }
    return {
      status: "ok",
      data: {
        verificationId: expectUuid(
          value.verificationId,
          "verification.verificationId",
        ),
        status: "VERIFIED",
        verifiedAt: expectDateTime(value.verifiedAt, "verification.verifiedAt"),
      },
    };
  } catch {
    return { status: "unavailable" };
  }
}

export function parsePublicFormSubmissionResponse(
  status: number,
  body: string,
): PublicFormSubmitOutcome {
  if (status === 201) {
    try {
      const value = expectRecord(JSON.parse(body) as unknown, "submission");
      return {
        status: "ok",
        data: {
          submissionId: expectString(value.submissionId, "submission.submissionId", 64),
          clientId: expectString(value.clientId, "submission.clientId", 64),
          status: expectString(value.status, "submission.status", 32),
          claimToken: expectString(value.claimToken, "submission.claimToken", 43),
          claimExpiresInSeconds: expectCount(
            value.claimExpiresInSeconds,
            "submission.claimExpiresInSeconds",
          ),
        },
      };
    } catch {
      return { status: "unavailable" };
    }
  }
  if (status === 422) {
    return { status: "invalid" };
  }
  if (status === 403) {
    return { status: "forbidden" };
  }
  if (status === 404) {
    return { status: "not-found" };
  }
  return { status: "unavailable" };
}

export type PublicFormContentLoadResult =
  | { readonly status: "ok"; readonly content: PublicFormContent }
  | { readonly status: "not-found" }
  | {
      readonly status: "unavailable";
      readonly reason: "configuration" | "network" | "api" | "invalid-response";
    };

export function publicTenantFormEndpointPath(
  tenantSlug: string,
  formCode: string,
  locale?: BeautyDocsLocale,
): string {
  if (!isValidTenantSlug(tenantSlug)) {
    throw contractError("tenant slug is invalid");
  }
  if (!isValidFormSlug(formCode)) {
    throw contractError("form code is invalid");
  }

  const path = `/api/v1/public/tenants/${encodeURIComponent(tenantSlug)}/forms/${encodeURIComponent(formCode)}`;
  return locale && locale !== "pl" ? `${path}?lang=${locale}` : path;
}

const FORM_CONTENT_KEYS = [
  "code",
  "displayName",
  "description",
  "version",
  "definition",
  "legal",
  "contentLocale",
  "practitioners",
] as const;
const PUBLIC_PRACTITIONER_KEYS = [
  "id",
  "displayName",
  "jobTitle",
  "smsSigningReady",
] as const;

/**
 * Parse the published content of one enabled salon form. `definition` and
 * `legal` are platform-authored JSON; the parser normalises the two section
 * shapes into a `kind`-tagged union and drops unknown extras so the renderer
 * receives typed, bounded data.
 */
export function parsePublicFormContent(value: unknown): PublicFormContent {
  const content = expectRecord(value, "form");
  expectExactKeys(content, FORM_CONTENT_KEYS, "form");

  const code = expectString(content.code, "form.code", 100);
  if (!isValidFormSlug(code)) {
    throw contractError("form.code must be a lowercase URL-safe form code");
  }

  if (
    typeof content.version !== "number" ||
    !Number.isSafeInteger(content.version) ||
    content.version < 1 ||
    content.version > 100_000
  ) {
    throw contractError("form.version must be a positive integer");
  }

  const definition = expectRecord(content.definition, "form.definition");
  const rawSections = definition.sections;
  if (!Array.isArray(rawSections) || rawSections.length > 50) {
    throw contractError("form.definition.sections must be an array of at most 50 items");
  }
  const legal = expectRecord(content.legal, "form.legal");
  const rawConsents = legal.consents;
  if (!Array.isArray(rawConsents) || rawConsents.length > 30) {
    throw contractError("form.legal.consents must be an array of at most 30 items");
  }
  if (
    !Array.isArray(content.practitioners) ||
    content.practitioners.length > 250
  ) {
    throw contractError(
      "form.practitioners must be an array of at most 250 items",
    );
  }

  return {
    code,
    displayName: expectString(content.displayName, "form.displayName", 250),
    description: expectNullableString(content.description, "form.description", 2_000),
    version: content.version,
    definition: {
      treatment: expectNullableString(definition.treatment ?? null, "form.definition.treatment", 250),
      anatomy: parseFormAnatomy(definition.anatomy),
      sections: rawSections.map(parseFormSection),
    },
    legal: {
      documentForm: expectNullableString(legal.documentForm ?? null, "form.legal.documentForm", 250),
      consents: rawConsents.map(parseFormConsent),
      documents: parseLegalDocuments(legal.documents),
    },
    contentLocale: isBeautyDocsLocale(content.contentLocale)
      ? content.contentLocale
      : (() => {
          throw contractError("form.contentLocale is not a supported language");
        })(),
    practitioners: content.practitioners.map((value, index) => {
      const path = `form.practitioners[${index}]`;
      const practitioner = expectRecord(value, path);
      expectExactKeys(practitioner, PUBLIC_PRACTITIONER_KEYS, path);
      return {
        id: expectUuid(practitioner.id, `${path}.id`),
        displayName: expectString(
          practitioner.displayName,
          `${path}.displayName`,
          200,
        ),
        jobTitle: expectNullableString(
          practitioner.jobTitle,
          `${path}.jobTitle`,
          160,
        ),
        smsSigningReady: expectBoolean(
          practitioner.smsSigningReady,
          `${path}.smsSigningReady`,
        ),
      };
    }),
  };
}

export function parsePublicTenantFormResponse(
  status: number,
  responseBody: string,
): PublicFormContentLoadResult {
  if (status === 404) {
    return { status: "not-found" };
  }
  if (status !== 200) {
    return { status: "unavailable", reason: "api" };
  }
  try {
    return {
      status: "ok",
      content: parsePublicFormContent(JSON.parse(responseBody) as unknown),
    };
  } catch {
    return { status: "unavailable", reason: "invalid-response" };
  }
}

function parseFormAnatomy(value: unknown): PublicFormContent["definition"]["anatomy"] {
  if (value === null || value === undefined) {
    return null;
  }
  const anatomy = expectRecord(value, "form.definition.anatomy");
  const model = anatomy.model;
  if (model !== "face" && model !== "body" && model !== "both") {
    throw contractError("form.definition.anatomy.model is invalid");
  }
  return {
    model,
    faceZoneSet: expectNullableString(
      anatomy.faceZoneSet ?? null,
      "form.definition.anatomy.faceZoneSet",
      40,
    ),
    bodyZoneSet: expectNullableString(
      anatomy.bodyZoneSet ?? null,
      "form.definition.anatomy.bodyZoneSet",
      40,
    ),
  };
}

function parseFormSection(value: unknown, index: number): FormSection {
  const path = `form.definition.sections[${index}]`;
  const section = expectRecord(value, path);
  const key = expectString(section.key, `${path}.key`, 100);
  const title = expectString(section.title, `${path}.title`, 250);

  if (section.type === "contraindications") {
    const rawCategories = Array.isArray(section.categories) ? section.categories : [];
    const rawItems = section.items;
    if (!Array.isArray(rawItems) || rawItems.length > 200) {
      throw contractError(`${path}.items must be an array of at most 200 items`);
    }
    return {
      kind: "contraindications",
      key,
      title,
      categories: rawCategories.map((category, categoryIndex) =>
        expectString(category, `${path}.categories[${categoryIndex}]`, 250),
      ),
      items: rawItems.map((item, itemIndex) => parseContraindicationItem(item, `${path}.items[${itemIndex}]`)),
    };
  }

  const rawFields = section.fields;
  if (!Array.isArray(rawFields) || rawFields.length > 50) {
    throw contractError(`${path}.fields must be an array of at most 50 items`);
  }
  return {
    kind: "fields",
    key,
    title,
    fields: rawFields.map((field, fieldIndex) => parseFormField(field, `${path}.fields[${fieldIndex}]`)),
  };
}

function parseFormField(value: unknown, path: string): FormField {
  const field = expectRecord(value, path);
  return {
    key: expectString(field.key, `${path}.key`, 100),
    label: expectString(field.label, `${path}.label`, 250),
    type: expectString(field.type, `${path}.type`, 40),
    required: field.required === true,
  };
}

function parseContraindicationItem(value: unknown, path: string): FormContraindicationItem {
  const item = expectRecord(value, path);
  return {
    key: expectString(item.key, `${path}.key`, 100),
    question: expectString(item.question, `${path}.question`, 1_000),
    hasFollowUp: item.hasFollowUp === true,
    followUpPlaceholder: expectNullableString(
      item.followUpPlaceholder ?? null,
      `${path}.followUpPlaceholder`,
      250,
    ),
    category: expectNullableString(item.category ?? null, `${path}.category`, 250),
  };
}

function parseLegalDocuments(
  value: unknown,
): PublicFormContent["legal"]["documents"] {
  if (value === null || value === undefined) {
    return [];
  }
  if (!Array.isArray(value) || value.length > 30) {
    throw contractError("form.legal.documents must be an array of at most 30 items");
  }
  return value.map((item, index) => {
    const path = `form.legal.documents[${index}]`;
    const document = expectRecord(item, path);
    return {
      key: expectString(document.key, `${path}.key`, 100),
      title: expectString(document.title, `${path}.title`, 250),
      text: expectString(document.text, `${path}.text`, 8_000),
    };
  });
}

function parseFormConsent(value: unknown, index: number): FormConsent {
  const path = `form.legal.consents[${index}]`;
  const consent = expectRecord(value, path);
  return {
    key: expectString(consent.key, `${path}.key`, 100),
    title: expectNullableString(consent.title ?? null, `${path}.title`, 250),
    required: consent.required === true,
    text: expectString(consent.text, `${path}.text`, 4_000),
  };
}

function parseLegalDetails(value: unknown): TenantLegalDetails {
  const legal = expectRecord(value, "tenant.legal");
  expectExactKeys(legal, LEGAL_KEYS, "tenant.legal");

  return {
    nip: expectNullableString(legal.nip, "tenant.legal.nip", 20),
    address: parsePostalAddress(legal.address),
    privacyContactEmail: expectNullableEmail(
      legal.privacyContactEmail,
      "tenant.legal.privacyContactEmail",
    ),
  };
}

function parsePostalAddress(value: unknown): TenantPostalAddress | null {
  if (value === null) {
    return null;
  }

  const address = expectRecord(value, "tenant.legal.address");
  expectExactKeys(address, ADDRESS_KEYS, "tenant.legal.address");

  const countryCode = expectString(
    address.countryCode,
    "tenant.legal.address.countryCode",
    2,
  );
  if (!/^[A-Z]{2}$/.test(countryCode)) {
    throw contractError("tenant.legal.address.countryCode must be ISO alpha-2");
  }

  return {
    street: expectString(address.street, "tenant.legal.address.street", 501),
    postalCode: expectString(
      address.postalCode,
      "tenant.legal.address.postalCode",
      20,
    ),
    city: expectString(address.city, "tenant.legal.address.city", 120),
    countryCode,
  };
}

function parsePublicContact(value: unknown): TenantPublicContact {
  const contact = expectRecord(value, "tenant.contact");
  expectExactKeys(contact, CONTACT_KEYS, "tenant.contact");

  const websiteUrl = expectNullableString(
    contact.websiteUrl,
    "tenant.contact.websiteUrl",
    2_048,
  );
  if (websiteUrl !== null && !isSafeWebsiteUrl(websiteUrl)) {
    throw contractError("tenant.contact.websiteUrl must use http or https");
  }

  return {
    phone: expectNullableString(contact.phone, "tenant.contact.phone", 32),
    email: expectNullableEmail(contact.email, "tenant.contact.email"),
    websiteUrl,
  };
}

function parseActiveForm(value: unknown, index: number): TenantActiveForm {
  const path = `tenant.activeForms[${index}]`;
  const form = expectRecord(value, path);
  expectExactKeys(form, ACTIVE_FORM_KEYS, path);

  if (
    typeof form.displayOrder !== "number" ||
    !Number.isSafeInteger(form.displayOrder) ||
    form.displayOrder < 0 ||
    form.displayOrder > 100_000
  ) {
    throw contractError(`${path}.displayOrder must be a non-negative integer`);
  }

  const code = expectString(form.code, `${path}.code`, 100);
  if (!isValidFormSlug(code)) {
    throw contractError(`${path}.code must be a lowercase URL-safe form code`);
  }

  return {
    code,
    displayName: expectString(form.displayName, `${path}.displayName`, 250),
    displayOrder: form.displayOrder,
  };
}

function expectRecord(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw contractError(`${path} must be an object`);
  }

  return value as Record<string, unknown>;
}

function expectExactKeys(
  value: Record<string, unknown>,
  expectedKeys: readonly string[],
  path: string,
): void {
  const actualKeys = Object.keys(value);
  if (
    actualKeys.length !== expectedKeys.length ||
    expectedKeys.some((key) => !Object.hasOwn(value, key))
  ) {
    throw contractError(`${path} does not match the BeautyDocs public contract`);
  }
}

function expectString(value: unknown, path: string, maxLength: number): string {
  if (
    typeof value !== "string" ||
    value.trim() === "" ||
    value !== value.trim() ||
    value.length > maxLength
  ) {
    throw contractError(`${path} must be a non-empty string`);
  }

  return value;
}

function expectCount(value: unknown, path: string): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > Number.MAX_SAFE_INTEGER
  ) {
    throw contractError(`${path} must be a non-negative integer`);
  }

  return value;
}

function expectUuid(value: unknown, path: string): string {
  const candidate = expectString(value, path, 64);
  if (!UUID_PATTERN.test(candidate)) {
    throw contractError(`${path} must be a UUID`);
  }
  return candidate;
}

function expectBoolean(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") {
    throw contractError(`${path} must be a boolean`);
  }
  return value;
}

function expectDateTime(value: unknown, path: string): string {
  const candidate = expectString(value, path, 64);
  if (!Number.isFinite(Date.parse(candidate))) {
    throw contractError(`${path} must be an ISO date-time`);
  }
  return candidate;
}

function expectNullableString(
  value: unknown,
  path: string,
  maxLength: number,
): string | null {
  if (value === null) {
    return null;
  }

  return expectString(value, path, maxLength);
}

function expectNullableEmail(value: unknown, path: string): string | null {
  const email = expectNullableString(value, path, 320);
  if (email !== null && (!email.includes("@") || /\s/.test(email))) {
    throw contractError(`${path} must be an email address`);
  }

  return email;
}

function isSafeWebsiteUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.username === "" &&
      url.password === ""
    );
  } catch {
    return false;
  }
}

function contractError(message: string): BeautyDocsApiContractError {
  return new BeautyDocsApiContractError(message);
}
