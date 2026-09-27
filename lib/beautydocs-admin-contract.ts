import { isValidTenantSlug } from "./tenant-host";
import type {
  BeautyDocsAdminClient,
  BeautyDocsAdminClientCollection,
  BeautyDocsAdminClientForm,
  BeautyDocsAdminClientFormDetail,
  BeautyDocsAdminClientList,
  BeautyDocsAdminClientListItem,
  BeautyDocsAdminClientListQuery,
  BeautyDocsAdminClientNote,
  BeautyDocsAdminClientProfile,
  BeautyDocsAdminClientVisit,
  BeautyDocsAdminFormAnswer,
  BeautyDocsAdminFormAnswerKind,
  BeautyDocsAdminForm,
  BeautyDocsAdminFormList,
  BeautyDocsAdminFormPreview,
  BeautyDocsFormDefinition,
  BeautyDocsFormSection,
  BeautyDocsAdminMembership,
  BeautyDocsAdminNotification,
  BeautyDocsAdminNotificationKind,
  BeautyDocsAdminNotificationList,
  BeautyDocsAdminNotificationSeverity,
  BeautyDocsAdminSession,
  BeautyDocsAdminTeam,
  BeautyDocsAdminTeamMember,
  BeautyDocsBookingSchedule,
  BeautyDocsClientNoteCategory,
  BeautyDocsMembershipRole,
  BeautyDocsMfaChallenge,
  BeautyDocsMfaChallengePurpose,
  BeautyDocsMfaLoginChallenge,
  BeautyDocsMfaMethod,
  BeautyDocsMfaState,
  BeautyDocsSubmissionStatus,
  BeautyDocsTenantOverview,
  BeautyDocsVisitStatus,
} from "../types/beautydocs-admin";

const SESSION_KEYS = ["user", "memberships"] as const;
const MFA_STATE_KEYS = ["enabled", "method", "destinationMasked", "enabledAt"] as const;
const MFA_LOGIN_CHALLENGE_KEYS = [
  "mfaRequired",
  "challengeId",
  "method",
  "destinationMasked",
  "expiresInSeconds",
  "devCode",
] as const;
const MFA_CHALLENGE_KEYS = [
  "challengeId",
  "purpose",
  "method",
  "destinationMasked",
  "expiresInSeconds",
  "devCode",
  "secret",
  "qrCodeDataUrl",
] as const;
const MFA_METHODS = new Set<BeautyDocsMfaMethod>(["SMS", "TOTP"]);
const MFA_PURPOSES = new Set<BeautyDocsMfaChallengePurpose>([
  "ENROLLMENT",
  "LOGIN",
  "DISABLE",
  "CHANGE",
]);
const USER_KEYS = ["email", "displayName"] as const;
const MEMBERSHIP_KEYS = [
  "tenantSlug",
  "tenantDisplayName",
  "role",
] as const;
const OVERVIEW_KEYS = [
  "tenant",
  "membership",
  "capabilities",
  "stats",
] as const;
const OVERVIEW_TENANT_KEYS = ["slug", "displayName", "legalName"] as const;
const OVERVIEW_MEMBERSHIP_KEYS = ["role"] as const;
const CAPABILITY_KEYS = [
  "canViewClients",
  "canManageClients",
  "canManageForms",
  "canManageMembers",
] as const;
const STATS_KEYS = [
  "clientsCount",
  "activeFormsCount",
  "formSubmissionsCount",
  "signedFormSubmissionsCount",
] as const;
const LOGIN_KEYS = ["email", "password"] as const;
const MEMBERSHIP_ROLES = new Set<BeautyDocsMembershipRole>([
  "OWNER",
  "ADMIN",
  "STAFF",
  "READ_ONLY",
]);
const CLIENT_LIST_KEYS = [
  "items",
  "total",
  "page",
  "pageSize",
  "totalPages",
] as const;
const CLIENT_LIST_ITEM_KEYS = [
  "id",
  "firstName",
  "lastName",
  "phone",
  "email",
  "archivedAt",
  "createdAt",
  "updatedAt",
] as const;
const CLIENT_PROFILE_KEYS = ["client", "visits", "notes", "forms"] as const;
const CLIENT_KEYS = [
  "id",
  "firstName",
  "lastName",
  "phone",
  "email",
  "birthDate",
  "archivedAt",
  "createdAt",
  "updatedAt",
] as const;
const CLIENT_COLLECTION_KEYS = ["items", "total", "truncated"] as const;
const CLIENT_VISIT_KEYS = [
  "id",
  "treatmentName",
  "startsAt",
  "endsAt",
  "status",
  "notes",
  "anaesthesia",
] as const;
const CLIENT_NOTE_KEYS = [
  "id",
  "body",
  "category",
  "createdAt",
  "editedAt",
] as const;
const CLIENT_FORM_KEYS = [
  "id",
  "visitId",
  "templateCode",
  "templateName",
  "status",
  "submittedAt",
  "signedAt",
  "createdAt",
] as const;
const CLIENT_FORM_DETAIL_KEYS = [
  "client",
  "submission",
  "sections",
  "anatomy",
  "treatmentAreaIds",
  "signatureKeys",
  "practitioner",
  "documentHash",
] as const;
const CLIENT_FORM_DETAIL_PRACTITIONER_KEYS = [
  "id",
  "displayName",
  "jobTitle",
  "signatureConfigured",
  "smsSigningReady",
  "canCurrentUserSign",
  "signedAt",
  "verificationDestinationMasked",
  "verificationVerifiedAt",
] as const;
const TEAM_KEYS = ["items", "canManage"] as const;
const TEAM_MEMBER_KEYS = [
  "id",
  "displayName",
  "email",
  "phone",
  "jobTitle",
  "isOwner",
  "performsTreatments",
  "allTreatments",
  "treatmentCodes",
  "isActive",
  "hasPanelAccess",
  "signatureConfigured",
  "smsSigningReady",
  "signatureUpdatedAt",
  "createdAt",
  "updatedAt",
] as const;
const CLIENT_FORM_DETAIL_CLIENT_KEYS = ["id", "firstName", "lastName"] as const;
const CLIENT_FORM_DETAIL_SUBMISSION_KEYS = [
  "id",
  "visitId",
  "templateCode",
  "templateName",
  "templateVersion",
  "status",
  "submittedAt",
  "signedAt",
  "createdAt",
] as const;
const CLIENT_FORM_DETAIL_SECTION_KEYS = ["key", "title", "items"] as const;
const CLIENT_FORM_DETAIL_ANATOMY_KEYS = [
  "model",
  "faceZoneSet",
  "bodyZoneSet",
] as const;
const CLIENT_FORM_DETAIL_ANSWER_KEYS = [
  "key",
  "label",
  "kind",
  "value",
  "detail",
] as const;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DATE_TIME_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;
const VISIT_STATUSES = new Set<BeautyDocsVisitStatus>([
  "PLANNED",
  "COMPLETED",
  "CANCELLED",
]);
const SUBMISSION_STATUSES = new Set<BeautyDocsSubmissionStatus>([
  "DRAFT",
  "SUBMITTED",
  "SIGNED",
  "VOID",
]);
const NOTE_CATEGORIES = new Set<BeautyDocsClientNoteCategory>([
  "NOTATKA",
  "ALERGIA",
  "UWAGA",
  "PREFERENCJA",
]);
const FORM_ANSWER_KINDS = new Set<BeautyDocsAdminFormAnswerKind>([
  "field",
  "contraindication",
  "consent",
  "signature",
  "treatment_area",
  "place_and_date",
]);
const BOOKING_SCHEDULE_KEYS = ["slotIntervalMinutes", "days"] as const;
const BOOKING_DAY_KEYS = ["weekday", "enabled", "opensAt", "closesAt"] as const;
const BOOKING_SLOT_INTERVALS = new Set([15, 30, 60]);
const NOTIFICATION_KINDS = new Set<BeautyDocsAdminNotificationKind>([
  "PRACTITIONER_SIGNATURE_REQUIRED",
]);
const NOTIFICATION_SEVERITIES = new Set<BeautyDocsAdminNotificationSeverity>([
  "INFO",
  "ACTION_REQUIRED",
]);
const NOTIFICATION_LIST_KEYS = ["items", "unreadCount"] as const;
const NOTIFICATION_KEYS = [
  "id",
  "kind",
  "severity",
  "title",
  "body",
  "actionLabel",
  "clientId",
  "submissionId",
  "clientName",
  "formName",
  "practitionerName",
  "createdAt",
  "readAt",
  "resolvedAt",
  "archivedAt",
] as const;

export interface BeautyDocsLoginCredentials {
  readonly email: string;
  readonly password: string;
}

export type BeautyDocsAdminContractResult<T> =
  | { readonly status: "ok"; readonly data: T }
  | { readonly status: "unauthorized" }
  | { readonly status: "forbidden" }
  | { readonly status: "not-found" }
  | { readonly status: "invalid-request" }
  | { readonly status: "unavailable" };

export class BeautyDocsAdminContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BeautyDocsAdminContractError";
  }
}

export function parseBeautyDocsBookingSchedule(
  value: unknown,
): BeautyDocsBookingSchedule {
  const schedule = expectRecord(value, "bookingSchedule");
  expectExactKeys(schedule, BOOKING_SCHEDULE_KEYS, "bookingSchedule");
  if (
    typeof schedule.slotIntervalMinutes !== "number" ||
    !BOOKING_SLOT_INTERVALS.has(schedule.slotIntervalMinutes)
  ) {
    throw contractError("bookingSchedule.slotIntervalMinutes is invalid");
  }
  if (!Array.isArray(schedule.days) || schedule.days.length !== 7) {
    throw contractError("bookingSchedule.days must contain seven days");
  }
  const days = schedule.days.map((value, index) => {
    const day = expectRecord(value, `bookingSchedule.days[${index}]`);
    expectExactKeys(day, BOOKING_DAY_KEYS, `bookingSchedule.days[${index}]`);
    if (
      typeof day.weekday !== "number" ||
      !Number.isInteger(day.weekday) ||
      day.weekday < 0 ||
      day.weekday > 6 ||
      typeof day.enabled !== "boolean" ||
      typeof day.opensAt !== "string" ||
      typeof day.closesAt !== "string"
    ) {
      throw contractError(`bookingSchedule.days[${index}] is invalid`);
    }
    const opensAt = bookingClockMinutes(day.opensAt);
    const closesAt = bookingClockMinutes(day.closesAt);
    if (opensAt === null || closesAt === null || closesAt - opensAt < 60) {
      throw contractError(`bookingSchedule.days[${index}] has invalid hours`);
    }
    return {
      weekday: day.weekday,
      enabled: day.enabled,
      opensAt: day.opensAt,
      closesAt: day.closesAt,
    };
  });
  if (new Set(days.map((day) => day.weekday)).size !== 7) {
    throw contractError("bookingSchedule.days contains duplicate weekdays");
  }
  return {
    slotIntervalMinutes: schedule.slotIntervalMinutes as 15 | 30 | 60,
    days: days.sort((first, second) => first.weekday - second.weekday),
  };
}

function bookingClockMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (match === null) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || ![0, 15, 30, 45].includes(minute)) return null;
  return hour * 60 + minute;
}

export function parseBeautyDocsLoginCredentials(
  value: unknown,
): BeautyDocsLoginCredentials {
  const credentials = expectRecord(value, "credentials");
  expectExactKeys(credentials, LOGIN_KEYS, "credentials");

  const email = expectString(credentials.email, "credentials.email", 320);
  if (!email.includes("@") || /\s/.test(email)) {
    throw contractError("credentials.email must be an email address");
  }

  if (
    typeof credentials.password !== "string" ||
    credentials.password.length === 0 ||
    credentials.password.length > 1_024
  ) {
    throw contractError("credentials.password is invalid");
  }

  return { email, password: credentials.password };
}

export function parseBeautyDocsAdminSession(
  value: unknown,
): BeautyDocsAdminSession {
  const session = expectRecord(value, "session");
  expectExactKeys(session, SESSION_KEYS, "session");

  const user = expectRecord(session.user, "session.user");
  expectExactKeys(user, USER_KEYS, "session.user");

  if (!Array.isArray(session.memberships) || session.memberships.length > 100) {
    throw contractError("session.memberships must be an array");
  }

  const memberships = session.memberships.map(parseMembership);
  const tenantSlugs = new Set(memberships.map((membership) => membership.tenantSlug));
  if (tenantSlugs.size !== memberships.length) {
    throw contractError("session.memberships contains duplicate salons");
  }

  return {
    user: {
      email: expectEmail(user.email, "session.user.email"),
      displayName: expectString(
        user.displayName,
        "session.user.displayName",
        200,
      ),
    },
    memberships,
  };
}

export function parseBeautyDocsMfaState(value: unknown): BeautyDocsMfaState {
  const state = expectRecord(value, "mfaState");
  expectExactKeys(state, MFA_STATE_KEYS, "mfaState");
  const enabled = expectBoolean(state.enabled, "mfaState.enabled");
  const method =
    state.method === null
      ? null
      : expectEnum(state.method, "mfaState.method", MFA_METHODS);
  if (enabled !== (method !== null)) {
    throw contractError("mfaState method must match enabled state");
  }
  return {
    enabled,
    method,
    destinationMasked: expectNullableString(
      state.destinationMasked,
      "mfaState.destinationMasked",
      64,
    ),
    enabledAt: expectNullableDateTime(state.enabledAt, "mfaState.enabledAt"),
  };
}

export function parseBeautyDocsMfaLoginChallenge(
  value: unknown,
): BeautyDocsMfaLoginChallenge {
  const challenge = expectRecord(value, "mfaLoginChallenge");
  expectExactKeys(challenge, MFA_LOGIN_CHALLENGE_KEYS, "mfaLoginChallenge");
  if (challenge.mfaRequired !== true) {
    throw contractError("mfaLoginChallenge.mfaRequired must be true");
  }
  return {
    mfaRequired: true,
    challengeId: expectUuid(challenge.challengeId, "mfaLoginChallenge.challengeId"),
    method: expectEnum(challenge.method, "mfaLoginChallenge.method", MFA_METHODS),
    destinationMasked: expectNullableString(
      challenge.destinationMasked,
      "mfaLoginChallenge.destinationMasked",
      64,
    ),
    expiresInSeconds: expectInteger(
      challenge.expiresInSeconds,
      "mfaLoginChallenge.expiresInSeconds",
      120,
      900,
    ),
    devCode: expectNullableString(challenge.devCode, "mfaLoginChallenge.devCode", 6),
  };
}

export function parseBeautyDocsMfaChallenge(
  value: unknown,
): BeautyDocsMfaChallenge {
  const challenge = expectRecord(value, "mfaChallenge");
  expectExactKeys(challenge, MFA_CHALLENGE_KEYS, "mfaChallenge");
  const qrCodeDataUrl = expectNullableString(
    challenge.qrCodeDataUrl,
    "mfaChallenge.qrCodeDataUrl",
    100_000,
  );
  if (qrCodeDataUrl !== null && !qrCodeDataUrl.startsWith("data:image/png;base64,")) {
    throw contractError("mfaChallenge.qrCodeDataUrl must be a PNG data URL");
  }
  return {
    challengeId: expectUuid(challenge.challengeId, "mfaChallenge.challengeId"),
    purpose: expectEnum(challenge.purpose, "mfaChallenge.purpose", MFA_PURPOSES),
    method: expectEnum(challenge.method, "mfaChallenge.method", MFA_METHODS),
    destinationMasked: expectNullableString(
      challenge.destinationMasked,
      "mfaChallenge.destinationMasked",
      64,
    ),
    expiresInSeconds: expectInteger(
      challenge.expiresInSeconds,
      "mfaChallenge.expiresInSeconds",
      120,
      900,
    ),
    devCode: expectNullableString(challenge.devCode, "mfaChallenge.devCode", 6),
    secret: expectNullableString(challenge.secret, "mfaChallenge.secret", 128),
    qrCodeDataUrl,
  };
}

export function isBeautyDocsMfaChallengeId(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function parseBeautyDocsTenantOverview(
  value: unknown,
): BeautyDocsTenantOverview {
  const overview = expectRecord(value, "overview");
  expectExactKeys(overview, OVERVIEW_KEYS, "overview");

  const tenant = expectRecord(overview.tenant, "overview.tenant");
  expectExactKeys(tenant, OVERVIEW_TENANT_KEYS, "overview.tenant");
  const slug = expectString(tenant.slug, "overview.tenant.slug", 63);
  if (!isValidTenantSlug(slug)) {
    throw contractError("overview.tenant.slug is invalid");
  }

  const membership = expectRecord(overview.membership, "overview.membership");
  expectExactKeys(
    membership,
    OVERVIEW_MEMBERSHIP_KEYS,
    "overview.membership",
  );

  const stats = expectRecord(overview.stats, "overview.stats");
  expectExactKeys(stats, STATS_KEYS, "overview.stats");

  const capabilities = expectRecord(
    overview.capabilities,
    "overview.capabilities",
  );
  expectExactKeys(
    capabilities,
    CAPABILITY_KEYS,
    "overview.capabilities",
  );

  return {
    tenant: {
      slug,
      displayName: expectString(
        tenant.displayName,
        "overview.tenant.displayName",
        200,
      ),
      legalName: expectString(
        tenant.legalName,
        "overview.tenant.legalName",
        250,
      ),
    },
    membership: {
      role: expectMembershipRole(membership.role, "overview.membership.role"),
    },
    capabilities: {
      canViewClients: expectBoolean(
        capabilities.canViewClients,
        "overview.capabilities.canViewClients",
      ),
      canManageClients: expectBoolean(
        capabilities.canManageClients,
        "overview.capabilities.canManageClients",
      ),
      canManageForms: expectBoolean(
        capabilities.canManageForms,
        "overview.capabilities.canManageForms",
      ),
      canManageMembers: expectBoolean(
        capabilities.canManageMembers,
        "overview.capabilities.canManageMembers",
      ),
    },
    stats: {
      clientsCount: expectCount(stats.clientsCount, "overview.stats.clientsCount"),
      activeFormsCount: expectCount(
        stats.activeFormsCount,
        "overview.stats.activeFormsCount",
      ),
      formSubmissionsCount: expectCount(
        stats.formSubmissionsCount,
        "overview.stats.formSubmissionsCount",
      ),
      signedFormSubmissionsCount: expectCount(
        stats.signedFormSubmissionsCount,
        "overview.stats.signedFormSubmissionsCount",
      ),
    },
  };
}

export function parseBeautyDocsClientListQuery(input: {
  readonly search?: string | null;
  readonly page?: string | null;
  readonly pageSize?: string | null;
}): BeautyDocsAdminClientListQuery {
  const search = (input.search ?? "").trim();
  if (search.length === 1 || search.length > 80) {
    throw contractError("clients query search must be empty or 2-80 characters");
  }

  return {
    search,
    page: expectQueryInteger(input.page ?? "1", "clients query page", 1, 500),
    pageSize: expectQueryInteger(
      input.pageSize ?? "20",
      "clients query pageSize",
      1,
      100,
    ),
  };
}

export function parseBeautyDocsAdminClientList(
  value: unknown,
): BeautyDocsAdminClientList {
  const list = expectRecord(value, "clients");
  expectExactKeys(list, CLIENT_LIST_KEYS, "clients");
  if (!Array.isArray(list.items) || list.items.length > 100) {
    throw contractError("clients.items must be an array with at most 100 items");
  }

  const page = expectInteger(list.page, "clients.page", 1, 500);
  const pageSize = expectInteger(list.pageSize, "clients.pageSize", 1, 100);
  const total = expectCount(list.total, "clients.total");
  const totalPages = expectCount(list.totalPages, "clients.totalPages");
  const expectedTotalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
  if (totalPages !== expectedTotalPages || list.items.length > pageSize) {
    throw contractError("clients pagination is inconsistent");
  }

  return {
    items: list.items.map(parseClientListItem),
    total,
    page,
    pageSize,
    totalPages,
  };
}

const ADMIN_FORM_KEYS = [
  "code",
  "name",
  "description",
  "enabled",
  "displayOrder",
  "version",
  "questionCount",
  "durationMinutes",
] as const;
const LEGACY_ADMIN_FORM_KEYS = ADMIN_FORM_KEYS.filter(
  (key) => key !== "durationMinutes",
);
const ADMIN_FORM_LIST_KEYS = ["forms", "canManage"] as const;

export function parseBeautyDocsAdminFormList(
  value: unknown,
): BeautyDocsAdminFormList {
  const list = expectRecord(value, "forms");
  expectExactKeys(list, ADMIN_FORM_LIST_KEYS, "forms");
  if (!Array.isArray(list.forms) || list.forms.length > 500) {
    throw contractError("forms.forms must be an array with at most 500 items");
  }

  return {
    forms: list.forms.map((item, index) =>
      parseAdminForm(item, `forms.forms[${index}]`),
    ),
    canManage: expectBoolean(list.canManage, "forms.canManage"),
  };
}

export function parseBeautyDocsAdminFormEntry(value: unknown): BeautyDocsAdminForm {
  return parseAdminForm(value, "form");
}

function parseAdminForm(value: unknown, path: string): BeautyDocsAdminForm {
  const form = expectRecord(value, path);
  expectExactKeys(
    form,
    form.durationMinutes === undefined
      ? LEGACY_ADMIN_FORM_KEYS
      : ADMIN_FORM_KEYS,
    path,
  );

  return {
    code: expectString(form.code, `${path}.code`, 100),
    name: expectString(form.name, `${path}.name`, 250),
    description: expectNullableString(form.description, `${path}.description`, 2_000),
    enabled: expectBoolean(form.enabled, `${path}.enabled`),
    displayOrder: expectInteger(form.displayOrder, `${path}.displayOrder`, 0, 100_000),
    version:
      form.version === null
        ? null
        : expectInteger(form.version, `${path}.version`, 1, 100_000),
    questionCount: expectCount(form.questionCount, `${path}.questionCount`),
    durationMinutes:
      form.durationMinutes === undefined
        ? 60
        : expectInteger(form.durationMinutes, `${path}.durationMinutes`, 15, 480),
  };
}

export function parseBeautyDocsAdminFormListResponse(
  status: number,
  body: string,
): BeautyDocsAdminContractResult<BeautyDocsAdminFormList> {
  return parseAdminReadResponse(status, body, parseBeautyDocsAdminFormList);
}

export function parseBeautyDocsAdminFormEntryResponse(
  status: number,
  body: string,
): BeautyDocsAdminContractResult<BeautyDocsAdminForm> {
  return parseAdminReadResponse(status, body, parseBeautyDocsAdminFormEntry);
}

const FORM_PREVIEW_KEYS = [
  "code",
  "name",
  "description",
  "version",
  "definition",
  "legal",
  "practitioners",
] as const;
const FORM_PREVIEW_PRACTITIONER_KEYS = ["id", "displayName", "jobTitle"] as const;

/**
 * Parse a form's full published content for the owner's preview dialog.
 * `definition` and `legal` are platform-authored JSON; this mirrors the
 * public form-content parser's normalisation (kind-tagged section union,
 * bounded arrays) but for the admin-facing preview response shape.
 */
export function parseBeautyDocsAdminFormPreview(
  value: unknown,
): BeautyDocsAdminFormPreview {
  const content = expectRecord(value, "form");
  expectExactKeys(content, FORM_PREVIEW_KEYS, "form");

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
  const rawDocuments = legal.documents;
  if (rawDocuments !== null && rawDocuments !== undefined) {
    if (!Array.isArray(rawDocuments) || rawDocuments.length > 30) {
      throw contractError("form.legal.documents must be an array of at most 30 items");
    }
  }
  if (
    !Array.isArray(content.practitioners) ||
    content.practitioners.length > 250
  ) {
    throw contractError("form.practitioners must be an array of at most 250 items");
  }

  return {
    code: expectString(content.code, "form.code", 100),
    name: expectString(content.name, "form.name", 250),
    description: expectNullableString(content.description, "form.description", 2_000),
    version: expectInteger(content.version, "form.version", 1, 100_000),
    definition: {
      treatment: expectNullableString(
        definition.treatment ?? null,
        "form.definition.treatment",
        250,
      ),
      anatomy: parseFormPreviewAnatomy(definition.anatomy),
      sections: rawSections.map((section, index) =>
        parseFormPreviewSection(section, index),
      ),
    },
    legal: {
      documentForm: expectNullableString(
        legal.documentForm ?? null,
        "form.legal.documentForm",
        250,
      ),
      consents: rawConsents.map((consent, index) =>
        parseFormPreviewConsent(consent, index),
      ),
      documents: (Array.isArray(rawDocuments) ? rawDocuments : []).map(
        (document, index) => parseFormPreviewLegalDocument(document, index),
      ),
    },
    practitioners: content.practitioners.map((practitioner, index) => {
      const path = `form.practitioners[${index}]`;
      const row = expectRecord(practitioner, path);
      expectExactKeys(row, FORM_PREVIEW_PRACTITIONER_KEYS, path);
      return {
        id: expectUuid(row.id, `${path}.id`),
        displayName: expectString(row.displayName, `${path}.displayName`, 200),
        jobTitle: expectNullableString(row.jobTitle, `${path}.jobTitle`, 160),
      };
    }),
  };
}

function parseFormPreviewAnatomy(
  value: unknown,
): BeautyDocsFormDefinition["anatomy"] {
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

function parseFormPreviewSection(
  value: unknown,
  index: number,
): BeautyDocsFormSection {
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
      items: rawItems.map((item, itemIndex) =>
        parseFormPreviewContraindicationItem(item, `${path}.items[${itemIndex}]`),
      ),
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
    fields: rawFields.map((field, fieldIndex) =>
      parseFormPreviewField(field, `${path}.fields[${fieldIndex}]`),
    ),
  };
}

interface FormPreviewField {
  readonly key: string;
  readonly label: string;
  readonly type: string;
  readonly required: boolean;
}

function parseFormPreviewField(value: unknown, path: string): FormPreviewField {
  const field = expectRecord(value, path);
  return {
    key: expectString(field.key, `${path}.key`, 100),
    label: expectString(field.label, `${path}.label`, 250),
    type: expectString(field.type, `${path}.type`, 40),
    required: field.required === true,
  };
}

function parseFormPreviewContraindicationItem(value: unknown, path: string) {
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

function parseFormPreviewLegalDocument(value: unknown, index: number) {
  const path = `form.legal.documents[${index}]`;
  const document = expectRecord(value, path);
  return {
    key: expectString(document.key, `${path}.key`, 100),
    title: expectString(document.title, `${path}.title`, 250),
    text: expectString(document.text, `${path}.text`, 200_000),
  };
}

function parseFormPreviewConsent(value: unknown, index: number) {
  const path = `form.legal.consents[${index}]`;
  const consent = expectRecord(value, path);
  return {
    key: expectString(consent.key, `${path}.key`, 100),
    title:
      consent.title === null || consent.title === undefined
        ? null
        : expectString(consent.title, `${path}.title`, 250),
    required: consent.required === true,
    text: expectString(consent.text, `${path}.text`, 200_000),
  };
}

export function parseBeautyDocsAdminFormPreviewResponse(
  status: number,
  body: string,
): BeautyDocsAdminContractResult<BeautyDocsAdminFormPreview> {
  return parseAdminReadResponse(status, body, parseBeautyDocsAdminFormPreview);
}

export function parseBeautyDocsAdminNotificationList(
  value: unknown,
): BeautyDocsAdminNotificationList {
  const list = expectRecord(value, "notifications");
  expectExactKeys(list, NOTIFICATION_LIST_KEYS, "notifications");
  if (!Array.isArray(list.items) || list.items.length > 200) {
    throw contractError("notifications.items must contain at most 200 items");
  }
  return {
    items: list.items.map((item, index) =>
      parseAdminNotification(item, `notifications.items[${index}]`),
    ),
    unreadCount: expectCount(list.unreadCount, "notifications.unreadCount"),
  };
}

export function parseBeautyDocsAdminNotification(
  value: unknown,
): BeautyDocsAdminNotification {
  return parseAdminNotification(value, "notification");
}

function parseAdminNotification(
  value: unknown,
  path: string,
): BeautyDocsAdminNotification {
  const item = expectRecord(value, path);
  expectExactKeys(item, NOTIFICATION_KEYS, path);
  return {
    id: expectUuid(item.id, `${path}.id`),
    kind: expectEnum(item.kind, `${path}.kind`, NOTIFICATION_KINDS),
    severity: expectEnum(
      item.severity,
      `${path}.severity`,
      NOTIFICATION_SEVERITIES,
    ),
    title: expectString(item.title, `${path}.title`, 250),
    body: expectString(item.body, `${path}.body`, 10_000),
    actionLabel: expectNullableString(
      item.actionLabel,
      `${path}.actionLabel`,
      120,
    ),
    clientId: expectNullableUuid(item.clientId, `${path}.clientId`),
    submissionId: expectNullableUuid(
      item.submissionId,
      `${path}.submissionId`,
    ),
    clientName: expectNullableString(
      item.clientName,
      `${path}.clientName`,
      300,
    ),
    formName: expectNullableString(item.formName, `${path}.formName`, 250),
    practitionerName: expectNullableString(
      item.practitionerName,
      `${path}.practitionerName`,
      250,
    ),
    createdAt: expectDateTime(item.createdAt, `${path}.createdAt`),
    readAt: expectNullableDateTime(item.readAt, `${path}.readAt`),
    resolvedAt: expectNullableDateTime(item.resolvedAt, `${path}.resolvedAt`),
    archivedAt: expectNullableDateTime(item.archivedAt, `${path}.archivedAt`),
  };
}

export function parseBeautyDocsAdminNotificationListResponse(
  status: number,
  body: string,
): BeautyDocsAdminContractResult<BeautyDocsAdminNotificationList> {
  return parseAdminReadResponse(
    status,
    body,
    parseBeautyDocsAdminNotificationList,
  );
}

export function parseBeautyDocsAdminNotificationResponse(
  status: number,
  body: string,
): BeautyDocsAdminContractResult<BeautyDocsAdminNotification> {
  return parseAdminReadResponse(status, body, parseBeautyDocsAdminNotification);
}

export function parseBeautyDocsAdminClientProfile(
  value: unknown,
): BeautyDocsAdminClientProfile {
  const profile = expectRecord(value, "clientProfile");
  expectExactKeys(profile, CLIENT_PROFILE_KEYS, "clientProfile");

  return {
    client: parseClient(profile.client),
    visits: parseClientCollection(
      profile.visits,
      "clientProfile.visits",
      parseClientVisit,
    ),
    notes: parseClientCollection(
      profile.notes,
      "clientProfile.notes",
      parseClientNote,
    ),
    forms: parseClientCollection(
      profile.forms,
      "clientProfile.forms",
      parseClientForm,
    ),
  };
}

export function isBeautyDocsClientId(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function isBeautyDocsSubmissionId(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function isBeautyDocsTeamMemberId(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function isBeautyDocsNotificationId(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function isBeautyDocsSignatureKey(value: string): boolean {
  return /^[A-Za-z0-9_-]{1,100}$/.test(value);
}

export function parseBeautyDocsAdminClientFormDetail(
  value: unknown,
): BeautyDocsAdminClientFormDetail {
  const detail = expectRecord(value, "clientForm");
  expectExactKeys(detail, Object.hasOwn(detail, "printMetadata") ? [...CLIENT_FORM_DETAIL_KEYS, "printMetadata"] : CLIENT_FORM_DETAIL_KEYS, "clientForm");
  let printMetadata = null;
  if (detail.printMetadata != null) {
    const meta = expectRecord(detail.printMetadata, "clientForm.printMetadata");
    expectExactKeys(meta, ["salonName", "formName", "templateVersion", "clientSignedAt", "documentHash"], "clientForm.printMetadata");
    if (meta.templateVersion !== null && (typeof meta.templateVersion !== "number" || !Number.isInteger(meta.templateVersion) || meta.templateVersion < 1)) throw contractError("Invalid template version");
    printMetadata = {
      salonName: expectString(meta.salonName, "printMetadata.salonName", 250),
      formName: expectString(meta.formName, "printMetadata.formName", 250),
      templateVersion: meta.templateVersion as number | null,
      clientSignedAt: expectNullableDateTime(meta.clientSignedAt, "printMetadata.clientSignedAt"),
      documentHash: expectNullableString(meta.documentHash, "printMetadata.documentHash", 64),
    };
  }

  const client = expectRecord(detail.client, "clientForm.client");
  expectExactKeys(
    client,
    CLIENT_FORM_DETAIL_CLIENT_KEYS,
    "clientForm.client",
  );

  const submission = expectRecord(
    detail.submission,
    "clientForm.submission",
  );
  expectExactKeys(
    submission,
    CLIENT_FORM_DETAIL_SUBMISSION_KEYS,
    "clientForm.submission",
  );

  if (!Array.isArray(detail.sections) || detail.sections.length > 100) {
    throw contractError(
      "clientForm.sections must be an array with at most 100 items",
    );
  }
  if (
    !Array.isArray(detail.signatureKeys) ||
    detail.signatureKeys.length > 50
  ) {
    throw contractError(
      "clientForm.signatureKeys must be an array with at most 50 items",
    );
  }
  const signatureKeys = detail.signatureKeys.map((key, index) =>
    expectString(key, `clientForm.signatureKeys[${index}]`, 100),
  );
  if (new Set(signatureKeys).size !== signatureKeys.length) {
    throw contractError("clientForm.signatureKeys contains duplicates");
  }
  const documentHash = expectNullableString(
    detail.documentHash,
    "clientForm.documentHash",
    64,
  );
  if (documentHash !== null && !/^[0-9a-f]{64}$/i.test(documentHash)) {
    throw contractError("clientForm.documentHash must be a SHA-256 hash");
  }
  const practitioner =
    detail.practitioner === null
      ? null
      : parseClientFormPractitioner(detail.practitioner);
  const anatomy =
    detail.anatomy === null
      ? null
      : parseClientFormAnatomy(detail.anatomy);
  const treatmentAreaIds = expectBoundedStringArray(
    detail.treatmentAreaIds,
    "clientForm.treatmentAreaIds",
    100,
    100,
  );

  return {
    client: {
      id: expectUuid(client.id, "clientForm.client.id"),
      firstName: expectString(
        client.firstName,
        "clientForm.client.firstName",
        120,
      ),
      lastName: expectString(
        client.lastName,
        "clientForm.client.lastName",
        160,
      ),
    },
    submission: {
      id: expectUuid(submission.id, "clientForm.submission.id"),
      visitId: expectNullableUuid(
        submission.visitId,
        "clientForm.submission.visitId",
      ),
      templateCode: expectString(
        submission.templateCode,
        "clientForm.submission.templateCode",
        100,
      ),
      templateName: expectString(
        submission.templateName,
        "clientForm.submission.templateName",
        250,
      ),
      templateVersion: expectInteger(
        submission.templateVersion,
        "clientForm.submission.templateVersion",
        1,
        100_000,
      ),
      status: expectEnum(
        submission.status,
        "clientForm.submission.status",
        SUBMISSION_STATUSES,
      ),
      submittedAt: expectNullableDateTime(
        submission.submittedAt,
        "clientForm.submission.submittedAt",
      ),
      signedAt: expectNullableDateTime(
        submission.signedAt,
        "clientForm.submission.signedAt",
      ),
      createdAt: expectDateTime(
        submission.createdAt,
        "clientForm.submission.createdAt",
      ),
    },
    ...(Object.hasOwn(detail, "printMetadata") ? { printMetadata } : {}),
    sections: detail.sections.map(parseClientFormDetailSection),
    anatomy,
    treatmentAreaIds,
    signatureKeys,
    practitioner,
    documentHash,
  };
}

function parseClientFormAnatomy(value: unknown) {
  const path = "clientForm.anatomy";
  const anatomy = expectRecord(value, path);
  expectExactKeys(anatomy, CLIENT_FORM_DETAIL_ANATOMY_KEYS, path);
  return {
    model: expectEnum(
      anatomy.model,
      `${path}.model`,
      new Set(["face", "body", "both"] as const),
    ),
    faceZoneSet: expectNullableString(
      anatomy.faceZoneSet,
      `${path}.faceZoneSet`,
      100,
    ),
    bodyZoneSet: expectNullableString(
      anatomy.bodyZoneSet,
      `${path}.bodyZoneSet`,
      100,
    ),
  };
}

function parseClientFormPractitioner(value: unknown) {
  const path = "clientForm.practitioner";
  const practitioner = expectRecord(value, path);
  expectExactKeys(
    practitioner,
    CLIENT_FORM_DETAIL_PRACTITIONER_KEYS,
    path,
  );
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
    signatureConfigured: expectBoolean(
      practitioner.signatureConfigured,
      `${path}.signatureConfigured`,
    ),
    smsSigningReady: expectBoolean(
      practitioner.smsSigningReady,
      `${path}.smsSigningReady`,
    ),
    canCurrentUserSign: expectBoolean(
      practitioner.canCurrentUserSign,
      `${path}.canCurrentUserSign`,
    ),
    signedAt: expectNullableDateTime(
      practitioner.signedAt,
      `${path}.signedAt`,
    ),
    verificationDestinationMasked: expectNullableString(
      practitioner.verificationDestinationMasked,
      `${path}.verificationDestinationMasked`,
      64,
    ),
    verificationVerifiedAt: expectNullableDateTime(
      practitioner.verificationVerifiedAt,
      `${path}.verificationVerifiedAt`,
    ),
  };
}

export function parseBeautyDocsAdminTeam(value: unknown): BeautyDocsAdminTeam {
  const team = expectRecord(value, "team");
  expectExactKeys(team, TEAM_KEYS, "team");
  if (!Array.isArray(team.items) || team.items.length > 250) {
    throw contractError("team.items must be an array with at most 250 items");
  }
  return {
    items: team.items.map((item, index) =>
      parseBeautyDocsAdminTeamMember(item, `team.items[${index}]`),
    ),
    canManage: expectBoolean(team.canManage, "team.canManage"),
  };
}

export function parseBeautyDocsAdminTeamMember(
  value: unknown,
  path = "teamMember",
): BeautyDocsAdminTeamMember {
  const member = expectRecord(value, path);
  expectExactKeys(member, TEAM_MEMBER_KEYS, path);
  return {
    id: expectUuid(member.id, `${path}.id`),
    displayName: expectString(member.displayName, `${path}.displayName`, 200),
    email: expectNullableString(member.email, `${path}.email`, 320),
    phone: expectNullableString(member.phone, `${path}.phone`, 32),
    jobTitle: expectNullableString(member.jobTitle, `${path}.jobTitle`, 160),
    isOwner: expectBoolean(member.isOwner, `${path}.isOwner`),
    performsTreatments: expectBoolean(
      member.performsTreatments,
      `${path}.performsTreatments`,
    ),
    allTreatments: expectBoolean(member.allTreatments, `${path}.allTreatments`),
    treatmentCodes: expectBoundedStringArray(
      member.treatmentCodes,
      `${path}.treatmentCodes`,
      100,
      100,
    ),
    isActive: expectBoolean(member.isActive, `${path}.isActive`),
    hasPanelAccess: expectBoolean(
      member.hasPanelAccess,
      `${path}.hasPanelAccess`,
    ),
    signatureConfigured: expectBoolean(
      member.signatureConfigured,
      `${path}.signatureConfigured`,
    ),
    smsSigningReady: expectBoolean(
      member.smsSigningReady,
      `${path}.smsSigningReady`,
    ),
    signatureUpdatedAt: expectNullableDateTime(
      member.signatureUpdatedAt,
      `${path}.signatureUpdatedAt`,
    ),
    createdAt: expectDateTime(member.createdAt, `${path}.createdAt`),
    updatedAt: expectDateTime(member.updatedAt, `${path}.updatedAt`),
  };
}

function parseClientFormDetailSection(
  value: unknown,
  index: number,
) {
  const path = `clientForm.sections[${index}]`;
  const section = expectRecord(value, path);
  expectExactKeys(section, CLIENT_FORM_DETAIL_SECTION_KEYS, path);
  if (!Array.isArray(section.items) || section.items.length > 500) {
    throw contractError(`${path}.items must be an array with at most 500 items`);
  }

  return {
    key: expectString(section.key, `${path}.key`, 100),
    title: expectString(section.title, `${path}.title`, 250),
    items: section.items.map((item, itemIndex) =>
      parseClientFormDetailAnswer(item, `${path}.items[${itemIndex}]`),
    ),
  };
}

function parseClientFormDetailAnswer(
  value: unknown,
  path: string,
): BeautyDocsAdminFormAnswer {
  const answer = expectRecord(value, path);
  expectExactKeys(answer, CLIENT_FORM_DETAIL_ANSWER_KEYS, path);

  return {
    key: expectString(answer.key, `${path}.key`, 100),
    label: expectString(answer.label, `${path}.label`, 1_000),
    kind: expectEnum(answer.kind, `${path}.kind`, FORM_ANSWER_KINDS),
    value: expectNullableString(answer.value, `${path}.value`, 5_000),
    detail: expectNullableString(answer.detail, `${path}.detail`, 5_000),
  };
}

export function parseBeautyDocsAdminSessionResponse(
  status: number,
  body: string,
): BeautyDocsAdminContractResult<BeautyDocsAdminSession> {
  if (status === 401) {
    return { status: "unauthorized" };
  }
  if (status !== 200) {
    return { status: "unavailable" };
  }

  try {
    return {
      status: "ok",
      data: parseBeautyDocsAdminSession(JSON.parse(body) as unknown),
    };
  } catch {
    return { status: "unavailable" };
  }
}

export function parseBeautyDocsTenantOverviewResponse(
  status: number,
  body: string,
): BeautyDocsAdminContractResult<BeautyDocsTenantOverview> {
  switch (status) {
    case 401:
      return { status: "unauthorized" };
    case 403:
      return { status: "forbidden" };
    case 404:
      return { status: "not-found" };
    case 200:
      try {
        return {
          status: "ok",
          data: parseBeautyDocsTenantOverview(JSON.parse(body) as unknown),
        };
      } catch {
        return { status: "unavailable" };
      }
    default:
      return { status: "unavailable" };
  }
}

export function parseBeautyDocsAdminClientListResponse(
  status: number,
  body: string,
): BeautyDocsAdminContractResult<BeautyDocsAdminClientList> {
  return parseAdminReadResponse(status, body, parseBeautyDocsAdminClientList);
}

export function parseBeautyDocsAdminClientProfileResponse(
  status: number,
  body: string,
): BeautyDocsAdminContractResult<BeautyDocsAdminClientProfile> {
  return parseAdminReadResponse(status, body, parseBeautyDocsAdminClientProfile);
}

export function parseBeautyDocsAdminClientFormDetailResponse(
  status: number,
  body: string,
): BeautyDocsAdminContractResult<BeautyDocsAdminClientFormDetail> {
  return parseAdminReadResponse(
    status,
    body,
    parseBeautyDocsAdminClientFormDetail,
  );
}

export function parseBeautyDocsAdminTeamResponse(
  status: number,
  body: string,
): BeautyDocsAdminContractResult<BeautyDocsAdminTeam> {
  return parseAdminReadResponse(status, body, parseBeautyDocsAdminTeam);
}

export function parseBeautyDocsAdminTeamMemberResponse(
  status: number,
  body: string,
): BeautyDocsAdminContractResult<BeautyDocsAdminTeamMember> {
  return parseAdminReadResponse(
    status === 201 ? 200 : status,
    body,
    parseBeautyDocsAdminTeamMember,
  );
}

function parseAdminReadResponse<T>(
  status: number,
  body: string,
  parser: (value: unknown) => T,
): BeautyDocsAdminContractResult<T> {
  switch (status) {
    case 401:
      return { status: "unauthorized" };
    case 403:
      return { status: "forbidden" };
    case 404:
      return { status: "not-found" };
    case 422:
      return { status: "invalid-request" };
    case 200:
      try {
        return { status: "ok", data: parser(JSON.parse(body) as unknown) };
      } catch {
        return { status: "unavailable" };
      }
    default:
      return { status: "unavailable" };
  }
}

function parseClientListItem(
  value: unknown,
  index: number,
): BeautyDocsAdminClientListItem {
  const path = `clients.items[${index}]`;
  const item = expectRecord(value, path);
  expectExactKeys(item, CLIENT_LIST_ITEM_KEYS, path);

  return {
    id: expectUuid(item.id, `${path}.id`),
    firstName: expectString(item.firstName, `${path}.firstName`, 120),
    lastName: expectString(item.lastName, `${path}.lastName`, 160),
    phone: expectNullableString(item.phone, `${path}.phone`, 32),
    email: expectNullableString(item.email, `${path}.email`, 320),
    archivedAt: expectNullableDateTime(item.archivedAt, `${path}.archivedAt`),
    createdAt: expectDateTime(item.createdAt, `${path}.createdAt`),
    updatedAt: expectDateTime(item.updatedAt, `${path}.updatedAt`),
  };
}

function parseClient(value: unknown): BeautyDocsAdminClient {
  const path = "clientProfile.client";
  const client = expectRecord(value, path);
  expectExactKeys(client, CLIENT_KEYS, path);

  return {
    id: expectUuid(client.id, `${path}.id`),
    firstName: expectString(client.firstName, `${path}.firstName`, 120),
    lastName: expectString(client.lastName, `${path}.lastName`, 160),
    phone: expectNullableString(client.phone, `${path}.phone`, 32),
    email: expectNullableString(client.email, `${path}.email`, 320),
    birthDate: expectNullableDate(client.birthDate, `${path}.birthDate`),
    archivedAt: expectNullableDateTime(client.archivedAt, `${path}.archivedAt`),
    createdAt: expectDateTime(client.createdAt, `${path}.createdAt`),
    updatedAt: expectDateTime(client.updatedAt, `${path}.updatedAt`),
  };
}

function parseClientVisit(value: unknown, index: number): BeautyDocsAdminClientVisit {
  const path = `clientProfile.visits.items[${index}]`;
  const visit = expectRecord(value, path);
  expectExactKeys(visit, CLIENT_VISIT_KEYS, path);

  return {
    id: expectUuid(visit.id, `${path}.id`),
    treatmentName: expectString(visit.treatmentName, `${path}.treatmentName`, 250),
    startsAt: expectDateTime(visit.startsAt, `${path}.startsAt`),
    endsAt: expectNullableDateTime(visit.endsAt, `${path}.endsAt`),
    status: expectEnum(visit.status, `${path}.status`, VISIT_STATUSES),
    notes: expectNullableString(visit.notes, `${path}.notes`, 50_000),
    anaesthesia: expectNullableString(
      visit.anaesthesia,
      `${path}.anaesthesia`,
      50_000,
    ),
  };
}

function parseClientNote(value: unknown, index: number): BeautyDocsAdminClientNote {
  const path = `clientProfile.notes.items[${index}]`;
  const note = expectRecord(value, path);
  expectExactKeys(note, CLIENT_NOTE_KEYS, path);

  return {
    id: expectUuid(note.id, `${path}.id`),
    body: expectString(note.body, `${path}.body`, 50_000),
    category: expectEnum(note.category, `${path}.category`, NOTE_CATEGORIES),
    createdAt: expectDateTime(note.createdAt, `${path}.createdAt`),
    editedAt: expectNullableDateTime(note.editedAt, `${path}.editedAt`),
  };
}

function parseClientForm(value: unknown, index: number): BeautyDocsAdminClientForm {
  const path = `clientProfile.forms.items[${index}]`;
  const form = expectRecord(value, path);
  expectExactKeys(form, CLIENT_FORM_KEYS, path);

  return {
    id: expectUuid(form.id, `${path}.id`),
    visitId: expectNullableUuid(form.visitId, `${path}.visitId`),
    templateCode: expectString(form.templateCode, `${path}.templateCode`, 100),
    templateName: expectString(form.templateName, `${path}.templateName`, 250),
    status: expectEnum(form.status, `${path}.status`, SUBMISSION_STATUSES),
    submittedAt: expectNullableDateTime(form.submittedAt, `${path}.submittedAt`),
    signedAt: expectNullableDateTime(form.signedAt, `${path}.signedAt`),
    createdAt: expectDateTime(form.createdAt, `${path}.createdAt`),
  };
}

function parseClientCollection<T>(
  value: unknown,
  path: string,
  itemParser: (item: unknown, index: number) => T,
): BeautyDocsAdminClientCollection<T> {
  const collection = expectRecord(value, path);
  expectExactKeys(collection, CLIENT_COLLECTION_KEYS, path);
  if (!Array.isArray(collection.items) || collection.items.length > 100) {
    throw contractError(`${path}.items must be an array with at most 100 items`);
  }

  const total = expectCount(collection.total, `${path}.total`);
  const truncated = expectBoolean(collection.truncated, `${path}.truncated`);
  if (
    total < collection.items.length ||
    truncated !== (total > collection.items.length)
  ) {
    throw contractError(`${path} totals are inconsistent`);
  }

  return {
    items: collection.items.map(itemParser),
    total,
    truncated,
  };
}

function parseMembership(value: unknown, index: number): BeautyDocsAdminMembership {
  const path = `session.memberships[${index}]`;
  const membership = expectRecord(value, path);
  expectExactKeys(membership, MEMBERSHIP_KEYS, path);

  const tenantSlug = expectString(
    membership.tenantSlug,
    `${path}.tenantSlug`,
    63,
  );
  if (!isValidTenantSlug(tenantSlug)) {
    throw contractError(`${path}.tenantSlug is invalid`);
  }

  return {
    tenantSlug,
    tenantDisplayName: expectString(
      membership.tenantDisplayName,
      `${path}.tenantDisplayName`,
      200,
    ),
    role: expectMembershipRole(membership.role, `${path}.role`),
  };
}

function expectMembershipRole(
  value: unknown,
  path: string,
): BeautyDocsMembershipRole {
  if (typeof value !== "string" || !MEMBERSHIP_ROLES.has(value as BeautyDocsMembershipRole)) {
    throw contractError(`${path} is invalid`);
  }

  return value as BeautyDocsMembershipRole;
}

function expectCount(value: unknown, path: string): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    throw contractError(`${path} must be a non-negative integer`);
  }

  return value;
}

function expectInteger(
  value: unknown,
  path: string,
  minimum: number,
  maximum: number,
): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < minimum ||
    value > maximum
  ) {
    throw contractError(`${path} must be an integer from ${minimum} to ${maximum}`);
  }

  return value;
}

function expectQueryInteger(
  value: string,
  path: string,
  minimum: number,
  maximum: number,
): number {
  if (!/^\d+$/.test(value)) {
    throw contractError(`${path} is invalid`);
  }

  return expectInteger(Number(value), path, minimum, maximum);
}

function expectBoolean(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") {
    throw contractError(`${path} must be a boolean`);
  }

  return value;
}

function expectEmail(value: unknown, path: string): string {
  const email = expectString(value, path, 320);
  if (!email.includes("@") || /\s/.test(email)) {
    throw contractError(`${path} must be an email address`);
  }

  return email;
}

function expectNullableString(
  value: unknown,
  path: string,
  maxLength: number,
): string | null {
  if (value === null) {
    return null;
  }

  if (typeof value !== "string" || value.length > maxLength) {
    throw contractError(`${path} must be null or a string`);
  }

  return value;
}

function expectUuid(value: unknown, path: string): string {
  if (typeof value !== "string" || !isBeautyDocsClientId(value)) {
    throw contractError(`${path} must be a UUID`);
  }

  return value;
}

function expectNullableUuid(value: unknown, path: string): string | null {
  return value === null ? null : expectUuid(value, path);
}

function expectDateTime(value: unknown, path: string): string {
  if (
    typeof value !== "string" ||
    !DATE_TIME_PATTERN.test(value) ||
    Number.isNaN(Date.parse(value))
  ) {
    throw contractError(`${path} must be an ISO 8601 date-time`);
  }

  return value;
}

function expectNullableDateTime(value: unknown, path: string): string | null {
  return value === null ? null : expectDateTime(value, path);
}

function expectNullableDate(value: unknown, path: string): string | null {
  if (value === null) {
    return null;
  }
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) {
    throw contractError(`${path} must be an ISO date`);
  }

  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) {
    throw contractError(`${path} must be a valid ISO date`);
  }

  return value;
}

function expectEnum<T extends string>(
  value: unknown,
  path: string,
  allowedValues: ReadonlySet<T>,
): T {
  if (typeof value !== "string" || !allowedValues.has(value as T)) {
    throw contractError(`${path} is invalid`);
  }

  return value as T;
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
  const keys = Object.keys(value);
  if (
    keys.length !== expectedKeys.length ||
    expectedKeys.some((key) => !Object.hasOwn(value, key))
  ) {
    throw contractError(`${path} does not match the BeautyDocs admin contract`);
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

function expectBoundedStringArray(
  value: unknown,
  path: string,
  maxItems: number,
  maxItemLength: number,
): string[] {
  if (!Array.isArray(value) || value.length > maxItems) {
    throw contractError(`${path} must be an array with at most ${maxItems} items`);
  }
  return value.map((item, index) =>
    expectString(item, `${path}[${index}]`, maxItemLength),
  );
}

function contractError(message: string): BeautyDocsAdminContractError {
  return new BeautyDocsAdminContractError(message);
}
