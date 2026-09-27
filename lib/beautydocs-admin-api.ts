import "server-only";
import { isBeautyDocsLocale, type BeautyDocsLocale } from "./i18n/config";

import {
  isBeautyDocsClientId,
  isBeautyDocsMfaChallengeId,
  isBeautyDocsNotificationId,
  isBeautyDocsSignatureKey,
  isBeautyDocsSubmissionId,
  isBeautyDocsTeamMemberId,
  parseBeautyDocsAdminClientListResponse,
  parseBeautyDocsAdminClientFormDetailResponse,
  parseBeautyDocsAdminClientProfileResponse,
  parseBeautyDocsAdminFormEntryResponse,
  parseBeautyDocsAdminFormListResponse,
  parseBeautyDocsAdminFormPreviewResponse,
  parseBeautyDocsAdminNotificationListResponse,
  parseBeautyDocsAdminNotificationResponse,
  parseBeautyDocsAdminSessionResponse,
  parseBeautyDocsAdminTeamMemberResponse,
  parseBeautyDocsAdminTeamResponse,
  parseBeautyDocsBookingSchedule,
  parseBeautyDocsMfaChallenge,
  parseBeautyDocsMfaLoginChallenge,
  parseBeautyDocsMfaState,
  parseBeautyDocsTenantOverviewResponse,
  type BeautyDocsLoginCredentials,
} from "./beautydocs-admin-contract";
import {
  filterBeautyDocsSessionCookie,
  selectBeautyDocsSessionSetCookie,
} from "./beautydocs-bff-security";
import { isValidFormSlug } from "./beautydocs-form-path";
import { resolveBeautyDocsInternalApiUrl } from "./beautydocs-internal-api";
import type {
  BeautyDocsStaffInvitationPayload,
  BeautyDocsTeamMemberPayload,
  BeautyDocsTeamMemberUpdatePayload,
} from "./beautydocs-team-request";
import { isValidTenantSlug } from "./tenant-host";
import type {
  BeautyDocsAdminClientList,
  BeautyDocsAdminClientFormDetail,
  BeautyDocsAdminClientListQuery,
  BeautyDocsAdminClientProfile,
  BeautyDocsAdminForm,
  BeautyDocsAdminFormList,
  BeautyDocsAdminFormPreview,
  BeautyDocsAdminNotification,
  BeautyDocsAdminNotificationList,
  BeautyDocsAdminSession,
  BeautyDocsAdminTeam,
  BeautyDocsAdminTeamMember,
  BeautyDocsStaffInvitation,
  BeautyDocsStaffInvitationCreated,
  BeautyDocsAdminVisit,
  BeautyDocsAdminVisitList,
  BeautyDocsBookingSchedule,
  BeautyDocsMfaChallenge,
  BeautyDocsMfaChangeAuthorization,
  BeautyDocsMfaLoginChallenge,
  BeautyDocsMfaMethod,
  BeautyDocsMfaState,
  BeautyDocsPractitionerSignatureResult,
  BeautyDocsPractitionerVerificationStart,
  BeautyDocsTenantSettings,
  BeautyDocsTenantAnalytics,
  BeautyDocsTenantOverview,
} from "../types/beautydocs-admin";
import type {
  BeautyDocsChatConversationDetail,
  BeautyDocsChatConversationList,
  BeautyDocsChatMessage,
} from "../types/beautydocs-chat";

const APP_HOST = "app.beautydocs.pl";
const MAX_RESPONSE_CHARACTERS = 1_024 * 1_024;
const MAX_CHAT_ATTACHMENT_BYTES = 8 * 1024 * 1024;
const MAX_SIGNATURE_BYTES = 450_000;
const REQUEST_TIMEOUT_MS = 5_000;
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;
const LEGACY_DEFAULT_BOOKING_SCHEDULE: BeautyDocsBookingSchedule = {
  slotIntervalMinutes: 30,
  days: Array.from({ length: 7 }, (_, weekday) => ({
    weekday,
    enabled: weekday < 5,
    opensAt: "09:00",
    closesAt: "17:00",
  })),
};

export type BeautyDocsAdminApiResult<T> =
  | {
      readonly status: "ok";
      readonly data: T;
      readonly setCookie: string | null;
    }
  | { readonly status: "unauthorized" }
  | { readonly status: "forbidden" }
  | { readonly status: "not-found" }
  | { readonly status: "conflict" }
  | { readonly status: "payment-required" }
  | { readonly status: "rate-limited" }
  | { readonly status: "invalid-request" }
  | { readonly status: "unavailable" };

export type BeautyDocsStaffLoginResult =
  | {
      readonly status: "ok";
      readonly data: BeautyDocsAdminSession;
      readonly setCookie: string;
    }
  | {
      readonly status: "mfa-required";
      readonly data: BeautyDocsMfaLoginChallenge;
    }
  | { readonly status: "unauthorized" }
  | { readonly status: "invalid-request" }
  | { readonly status: "unavailable" };

interface InternalApiResponse {
  readonly status: number;
  readonly body: string;
  readonly setCookie: string | null;
}

export async function loginToBeautyDocs(
  credentials: BeautyDocsLoginCredentials,
  browserOrigin: string,
): Promise<BeautyDocsStaffLoginResult> {
  const response = await requestBeautyDocsAdminApi("/api/v1/auth/login", {
    method: "POST",
    origin: browserOrigin,
    body: JSON.stringify(credentials),
  });

  if (response === null) {
    return { status: "unavailable" };
  }
  if (response.status === 200) {
    try {
      const raw = JSON.parse(response.body) as unknown;
      if (typeof raw === "object" && raw !== null && "mfaRequired" in raw) {
        return {
          status: "mfa-required",
          data: parseBeautyDocsMfaLoginChallenge(raw),
        };
      }
    } catch {
      return { status: "unavailable" };
    }
  }
  const parsed = parseBeautyDocsAdminSessionResponse(
    response.status,
    response.body,
  );
  if (parsed.status !== "ok") {
    return parsed.status === "unauthorized"
      ? { status: "unauthorized" }
      : { status: "unavailable" };
  }
  if (response.setCookie === null) {
    return { status: "unavailable" };
  }

  return {
    status: "ok",
    data: parsed.data,
    setCookie: response.setCookie,
  };
}

export interface BeautyDocsRegisterPayload {
  readonly email: string;
}

export interface BeautyDocsRegisterData {
  readonly email: string;
  readonly expiresInSeconds: number;
  readonly devCode: string | null;
}

export type BeautyDocsRegisterResult =
  | { readonly status: "ok"; readonly data: BeautyDocsRegisterData }
  | { readonly status: "email-taken" }
  | { readonly status: "invalid-request" }
  | { readonly status: "unavailable" };

export interface BeautyDocsGoogleLoginConfig {
  readonly enabled: boolean;
  readonly clientId: string | null;
}

export interface BeautyDocsUserProfile {
  readonly displayName: string;
  readonly email: string;
  readonly phone: string | null;
  readonly emailVerifiedAt: string | null;
  readonly createdAt: string;
  readonly lastLoginAt: string | null;
  readonly signatureConfigured: boolean;
  readonly signatureUpdatedAt: string | null;
}

export async function registerBeautyDocsAccount(
  payload: BeautyDocsRegisterPayload,
  browserOrigin: string,
): Promise<BeautyDocsRegisterResult> {
  const response = await requestBeautyDocsAdminApi("/api/v1/auth/register", {
    method: "POST",
    origin: browserOrigin,
    body: JSON.stringify(payload),
  });

  if (response === null) {
    return { status: "unavailable" };
  }
  if (response.status === 409) {
    return { status: "email-taken" };
  }
  if (response.status === 400 || response.status === 422) {
    return { status: "invalid-request" };
  }
  if (response.status !== 200) {
    return { status: "unavailable" };
  }

  try {
    const raw = JSON.parse(response.body) as Record<string, unknown>;
    const email = raw.email;
    const expiresInSeconds = raw.expiresInSeconds;
    const devCode = raw.devCode;
    if (
      typeof email !== "string" ||
      typeof expiresInSeconds !== "number" ||
      !Number.isInteger(expiresInSeconds) ||
      (devCode !== null && typeof devCode !== "string")
    ) {
      return { status: "unavailable" };
    }
    return {
      status: "ok",
      data: { email, expiresInSeconds, devCode: devCode ?? null },
    };
  } catch {
    return { status: "unavailable" };
  }
}

export async function fetchBeautyDocsGoogleLoginConfig(): Promise<
  BeautyDocsAdminApiResult<BeautyDocsGoogleLoginConfig>
> {
  const response = await requestBeautyDocsAdminApi("/api/v1/auth/google/config", {
    method: "GET",
  });
  if (response === null || response.status !== 200) {
    return { status: "unavailable" };
  }
  try {
    const raw = JSON.parse(response.body) as Record<string, unknown>;
    if (
      typeof raw.enabled !== "boolean" ||
      (raw.clientId !== null && typeof raw.clientId !== "string")
    ) {
      return { status: "unavailable" };
    }
    return {
      status: "ok",
      data: {
        enabled: raw.enabled,
        clientId: typeof raw.clientId === "string" ? raw.clientId : null,
      },
      setCookie: null,
    };
  } catch {
    return { status: "unavailable" };
  }
}

export async function registerOrLoginBeautyDocsStaffWithGoogle(
  accessToken: string,
  browserOrigin: string,
): Promise<BeautyDocsStaffLoginResult> {
  const response = await requestBeautyDocsAdminApi("/api/v1/auth/google/staff", {
    method: "POST",
    origin: browserOrigin,
    body: JSON.stringify({ accessToken }),
  });
  if (response === null) return { status: "unavailable" };
  if (response.status === 401) return { status: "unauthorized" };
  if (response.status === 409) return { status: "invalid-request" };
  if (response.status === 200) {
    try {
      const raw = JSON.parse(response.body) as unknown;
      if (typeof raw === "object" && raw !== null && "mfaRequired" in raw) {
        return {
          status: "mfa-required",
          data: parseBeautyDocsMfaLoginChallenge(raw),
        };
      }
    } catch {
      return { status: "unavailable" };
    }
  }
  const parsed = parseBeautyDocsAdminSessionResponse(response.status, response.body);
  if (parsed.status !== "ok" || response.setCookie === null) {
    return { status: "unavailable" };
  }
  return {
    status: "ok",
    data: parsed.data,
    setCookie: response.setCookie,
  };
}

export type BeautyDocsOwnerGoogleResult =
  | {
      readonly status: "ok";
      readonly data: BeautyDocsAdminSession;
      readonly setCookie: string;
    }
  | { readonly status: "unauthorized" }
  | { readonly status: "conflict" }
  | { readonly status: "invalid-request" }
  | { readonly status: "unavailable" };

export async function registerBeautyDocsOwnerWithGoogle(
  accessToken: string,
  salonName: string,
  fullName: string | null,
  browserOrigin: string,
): Promise<BeautyDocsOwnerGoogleResult> {
  const response = await requestBeautyDocsAdminApi(
    "/api/v1/auth/google/register-owner",
    {
      method: "POST",
      origin: browserOrigin,
      body: JSON.stringify({
        accessToken,
        salonName,
        fullName: fullName ?? undefined,
      }),
    },
  );
  if (response === null) return { status: "unavailable" };
  if (response.status === 401) return { status: "unauthorized" };
  if (response.status === 409) return { status: "conflict" };
  if (response.status === 400 || response.status === 422) {
    return { status: "invalid-request" };
  }
  const parsed = parseBeautyDocsAdminSessionResponse(response.status, response.body);
  if (parsed.status !== "ok" || response.setCookie === null) {
    return { status: "unavailable" };
  }
  return { status: "ok", data: parsed.data, setCookie: response.setCookie };
}

export async function fetchBeautyDocsMfaState(
  rawCookieHeader: string | null,
): Promise<BeautyDocsAdminApiResult<BeautyDocsMfaState>> {
  const response = await requestBeautyDocsAdminApi("/api/v1/auth/mfa", {
    method: "GET",
    cookie: rawCookieHeader,
  });
  if (response === null) return { status: "unavailable" };
  if (response.status === 401) return { status: "unauthorized" };
  if (response.status !== 200) return { status: "unavailable" };
  try {
    return {
      status: "ok",
      data: parseBeautyDocsMfaState(JSON.parse(response.body) as unknown),
      setCookie: null,
    };
  } catch {
    return { status: "unavailable" };
  }
}

export async function startBeautyDocsMfaEnrollment(
  payload: {
    readonly method: BeautyDocsMfaMethod;
    readonly phone?: string;
    readonly changeChallengeId?: string;
  },
  rawCookieHeader: string | null,
  browserOrigin: string,
): Promise<BeautyDocsAdminApiResult<BeautyDocsMfaChallenge>> {
  return requestMfaChallenge(
    "/api/v1/auth/mfa/enrollment",
    payload,
    rawCookieHeader,
    browserOrigin,
  );
}

export async function confirmBeautyDocsMfaEnrollment(
  challengeId: string,
  code: string,
  rawCookieHeader: string | null,
  browserOrigin: string,
): Promise<BeautyDocsAdminApiResult<BeautyDocsMfaState>> {
  return requestMfaStateMutation(
    "/api/v1/auth/mfa/enrollment/confirm",
    challengeId,
    code,
    rawCookieHeader,
    browserOrigin,
  );
}

export async function startBeautyDocsMfaDisable(
  rawCookieHeader: string | null,
  browserOrigin: string,
): Promise<BeautyDocsAdminApiResult<BeautyDocsMfaChallenge>> {
  return requestMfaChallenge(
    "/api/v1/auth/mfa/disable-challenge",
    {},
    rawCookieHeader,
    browserOrigin,
  );
}

export async function startBeautyDocsMfaChange(
  rawCookieHeader: string | null,
  browserOrigin: string,
): Promise<BeautyDocsAdminApiResult<BeautyDocsMfaChallenge>> {
  return requestMfaChallenge(
    "/api/v1/auth/mfa/change-challenge",
    {},
    rawCookieHeader,
    browserOrigin,
  );
}

export async function confirmBeautyDocsMfaChange(
  challengeId: string,
  code: string,
  rawCookieHeader: string | null,
  browserOrigin: string,
): Promise<BeautyDocsAdminApiResult<BeautyDocsMfaChangeAuthorization>> {
  if (!isBeautyDocsMfaChallengeId(challengeId) || !/^\d{6}$/.test(code)) {
    return { status: "invalid-request" };
  }
  const response = await requestBeautyDocsAdminApi(
    "/api/v1/auth/mfa/change/confirm",
    {
      method: "POST",
      cookie: rawCookieHeader,
      origin: browserOrigin,
      body: JSON.stringify({ challengeId, code }),
    },
  );
  if (response === null) return { status: "unavailable" };
  if (response.status !== 200) return mapMfaErrorStatus(response.status);
  try {
    const raw = JSON.parse(response.body) as Record<string, unknown>;
    if (
      Object.keys(raw).length !== 2 ||
      typeof raw.changeChallengeId !== "string" ||
      !isBeautyDocsMfaChallengeId(raw.changeChallengeId) ||
      typeof raw.expiresInSeconds !== "number" ||
      !Number.isInteger(raw.expiresInSeconds) ||
      raw.expiresInSeconds < 1 ||
      raw.expiresInSeconds > 900
    ) {
      return { status: "unavailable" };
    }
    return {
      status: "ok",
      data: {
        changeChallengeId: raw.changeChallengeId,
        expiresInSeconds: raw.expiresInSeconds,
      },
      setCookie: null,
    };
  } catch {
    return { status: "unavailable" };
  }
}

export async function confirmBeautyDocsMfaDisable(
  challengeId: string,
  code: string,
  rawCookieHeader: string | null,
  browserOrigin: string,
): Promise<BeautyDocsAdminApiResult<null>> {
  if (!isBeautyDocsMfaChallengeId(challengeId) || !/^\d{6}$/.test(code)) {
    return { status: "invalid-request" };
  }
  const response = await requestBeautyDocsAdminApi(
    "/api/v1/auth/mfa/disable/confirm",
    {
      method: "POST",
      cookie: rawCookieHeader,
      origin: browserOrigin,
      body: JSON.stringify({ challengeId, code }),
    },
  );
  if (response === null) return { status: "unavailable" };
  if (response.status === 204) {
    return { status: "ok", data: null, setCookie: null };
  }
  return mapMfaErrorStatus(response.status);
}

export async function confirmBeautyDocsMfaLogin(
  challengeId: string,
  code: string,
  browserOrigin: string,
): Promise<BeautyDocsAdminApiResult<BeautyDocsAdminSession>> {
  if (!isBeautyDocsMfaChallengeId(challengeId) || !/^\d{6}$/.test(code)) {
    return { status: "invalid-request" };
  }
  const response = await requestBeautyDocsAdminApi(
    "/api/v1/auth/mfa/login/confirm",
    {
      method: "POST",
      origin: browserOrigin,
      body: JSON.stringify({ challengeId, code }),
    },
  );
  if (response === null) return { status: "unavailable" };
  const parsed = parseBeautyDocsAdminSessionResponse(response.status, response.body);
  if (parsed.status !== "ok") return parsed;
  if (response.setCookie === null) return { status: "unavailable" };
  return { status: "ok", data: parsed.data, setCookie: response.setCookie };
}

async function requestMfaChallenge(
  path: string,
  body: unknown,
  rawCookieHeader: string | null,
  browserOrigin: string,
): Promise<BeautyDocsAdminApiResult<BeautyDocsMfaChallenge>> {
  const response = await requestBeautyDocsAdminApi(path, {
    method: "POST",
    cookie: rawCookieHeader,
    origin: browserOrigin,
    body: JSON.stringify(body),
  });
  if (response === null) return { status: "unavailable" };
  if (response.status !== 200) return mapMfaErrorStatus(response.status);
  try {
    return {
      status: "ok",
      data: parseBeautyDocsMfaChallenge(JSON.parse(response.body) as unknown),
      setCookie: null,
    };
  } catch {
    return { status: "unavailable" };
  }
}

async function requestMfaStateMutation(
  path: string,
  challengeId: string,
  code: string,
  rawCookieHeader: string | null,
  browserOrigin: string,
): Promise<BeautyDocsAdminApiResult<BeautyDocsMfaState>> {
  if (!isBeautyDocsMfaChallengeId(challengeId) || !/^\d{6}$/.test(code)) {
    return { status: "invalid-request" };
  }
  const response = await requestBeautyDocsAdminApi(path, {
    method: "POST",
    cookie: rawCookieHeader,
    origin: browserOrigin,
    body: JSON.stringify({ challengeId, code }),
  });
  if (response === null) return { status: "unavailable" };
  if (response.status !== 200) return mapMfaErrorStatus(response.status);
  try {
    return {
      status: "ok",
      data: parseBeautyDocsMfaState(JSON.parse(response.body) as unknown),
      setCookie: null,
    };
  } catch {
    return { status: "unavailable" };
  }
}

function mapMfaErrorStatus<T>(status: number): BeautyDocsAdminApiResult<T> {
  if (status === 401) return { status: "unauthorized" };
  if (status === 402) return { status: "payment-required" };
  if (status === 429) return { status: "rate-limited" };
  if (status === 400 || status === 422) return { status: "invalid-request" };
  if (status === 404) return { status: "not-found" };
  if (status === 409) return { status: "conflict" };
  return { status: "unavailable" };
}

export type BeautyDocsGoogleTarget = "staff" | "consumer" | "none";

export async function resolveBeautyDocsGoogleTarget(
  accessToken: string,
  browserOrigin: string,
): Promise<BeautyDocsAdminApiResult<{ readonly target: BeautyDocsGoogleTarget }>> {
  const response = await requestBeautyDocsAdminApi("/api/v1/auth/google/resolve", {
    method: "POST",
    origin: browserOrigin,
    body: JSON.stringify({ accessToken }),
  });
  if (response === null) return { status: "unavailable" };
  if (response.status === 401) return { status: "unauthorized" };
  if (response.status < 200 || response.status >= 300) return { status: "unavailable" };
  try {
    const parsed = JSON.parse(response.body) as { target?: unknown };
    if (
      parsed.target !== "staff" &&
      parsed.target !== "consumer" &&
      parsed.target !== "none"
    ) {
      return { status: "unavailable" };
    }
    return { status: "ok", data: { target: parsed.target }, setCookie: null };
  } catch {
    return { status: "unavailable" };
  }
}

export interface BeautyDocsVerifyData {
  readonly email: string;
  /** One-time token that authorizes the finalize (complete) step. */
  readonly registrationToken: string;
}

export type BeautyDocsVerifyResult =
  | { readonly status: "ok"; readonly data: BeautyDocsVerifyData }
  | { readonly status: "invalid-code" }
  | { readonly status: "unavailable" };

export async function verifyBeautyDocsRegistration(
  payload: { readonly email: string; readonly code: string },
  browserOrigin: string,
): Promise<BeautyDocsVerifyResult> {
  const response = await requestBeautyDocsAdminApi("/api/v1/auth/register/verify", {
    method: "POST",
    origin: browserOrigin,
    body: JSON.stringify(payload),
  });

  if (response === null) {
    return { status: "unavailable" };
  }
  if (response.status === 400 || response.status === 422) {
    return { status: "invalid-code" };
  }
  if (response.status !== 200) {
    return { status: "unavailable" };
  }
  // Verification no longer opens a session — it returns a one-time token the
  // browser passes to the finalize step, where the account is actually created.
  try {
    const raw = JSON.parse(response.body) as Record<string, unknown>;
    const email = raw.email;
    const registrationToken = raw.registrationToken;
    if (typeof email !== "string" || typeof registrationToken !== "string") {
      return { status: "unavailable" };
    }
    return { status: "ok", data: { email, registrationToken } };
  } catch {
    return { status: "unavailable" };
  }
}

export interface BeautyDocsCompletePayload {
  readonly registrationToken: string;
  readonly fullName: string;
  readonly salonName: string;
  readonly password: string;
  readonly nip: string;
  readonly regon: string | null;
  readonly krs: string | null;
  readonly companyName: string;
  readonly street: string;
  readonly postalCode: string;
  readonly city: string;
}

export type BeautyDocsCompleteResult =
  | {
      readonly status: "ok";
      readonly data: BeautyDocsAdminSession;
      readonly setCookie: string;
    }
  | { readonly status: "invalid-registration" }
  | { readonly status: "email-taken" }
  | { readonly status: "invalid-request" }
  | { readonly status: "unavailable" };

export async function completeBeautyDocsRegistration(
  payload: BeautyDocsCompletePayload,
  browserOrigin: string,
): Promise<BeautyDocsCompleteResult> {
  const response = await requestBeautyDocsAdminApi(
    "/api/v1/auth/register/complete",
    {
      method: "POST",
      origin: browserOrigin,
      body: JSON.stringify(payload),
    },
  );

  if (response === null) {
    return { status: "unavailable" };
  }
  if (response.status === 409) {
    return { status: "email-taken" };
  }
  if (response.status === 400) {
    return { status: "invalid-registration" };
  }
  if (response.status === 422) {
    return { status: "invalid-request" };
  }
  const parsed = parseBeautyDocsAdminSessionResponse(
    response.status,
    response.body,
  );
  if (parsed.status !== "ok" || response.setCookie === null) {
    return { status: "unavailable" };
  }
  return { status: "ok", data: parsed.data, setCookie: response.setCookie };
}

export interface BeautyDocsCompanyLookup {
  readonly nip: string;
  readonly regon: string;
  readonly krs: string | null;
  readonly companyName: string;
  readonly street: string;
  readonly postalCode: string;
  readonly city: string;
  readonly statusNip: string | null;
  readonly activityEndedAt: string | null;
}

export async function lookupBeautyDocsCompany(
  nip: string,
  rawCookieHeader: string | null,
  browserOrigin: string,
): Promise<BeautyDocsAdminApiResult<BeautyDocsCompanyLookup>> {
  const response = await requestBeautyDocsAdminApi("/api/v1/auth/company-lookup", {
    method: "POST",
    cookie: rawCookieHeader,
    origin: browserOrigin,
    body: JSON.stringify({ nip }),
  });
  if (response === null) return { status: "unavailable" };
  if (response.status === 401) return { status: "unauthorized" };
  if (response.status === 404) return { status: "not-found" };
  if (response.status === 400 || response.status === 422) {
    return { status: "invalid-request" };
  }
  if (response.status !== 200) return { status: "unavailable" };

  try {
    const raw = JSON.parse(response.body) as Record<string, unknown>;
    const requiredStrings = [
      "nip",
      "regon",
      "companyName",
      "street",
      "postalCode",
      "city",
    ] as const;
    if (
      requiredStrings.some((key) => typeof raw[key] !== "string") ||
      (raw.krs !== null && typeof raw.krs !== "string") ||
      (raw.statusNip !== null && typeof raw.statusNip !== "string") ||
      (raw.activityEndedAt !== null && typeof raw.activityEndedAt !== "string")
    ) {
      return { status: "unavailable" };
    }
    return {
      status: "ok",
      data: raw as unknown as BeautyDocsCompanyLookup,
      setCookie: null,
    };
  } catch {
    return { status: "unavailable" };
  }
}

export interface BeautyDocsConfigurePayload {
  readonly nip: string;
  readonly regon: string | null;
  readonly krs: string | null;
  readonly companyName: string;
  readonly street: string;
  readonly postalCode: string;
  readonly city: string;
}

/**
 * Company-data update for an authenticated owner. Used by the Google sign-up
 * path (the account and salon already exist); the e-mail path instead sends
 * the same fields to {@link completeBeautyDocsRegistration}.
 */
export async function configureBeautyDocsSalon(
  payload: BeautyDocsConfigurePayload,
  rawCookieHeader: string | null,
  browserOrigin: string,
): Promise<BeautyDocsAdminApiResult<null>> {
  const response = await requestBeautyDocsAdminApi("/api/v1/auth/configure", {
    method: "POST",
    cookie: rawCookieHeader,
    origin: browserOrigin,
    body: JSON.stringify(payload),
  });

  if (response === null) {
    return { status: "unavailable" };
  }
  if (response.status === 401) {
    return { status: "unauthorized" };
  }
  if (response.status === 400 || response.status === 422) {
    return { status: "invalid-request" };
  }
  if (response.status !== 204) {
    return { status: "unavailable" };
  }
  return { status: "ok", data: null, setCookie: response.setCookie };
}

export interface BeautyDocsCreateSalonPayload {
  readonly salonName: string;
  readonly nip: string;
  readonly regon: string | null;
  readonly krs: string | null;
  readonly companyName: string;
  readonly street: string;
  readonly postalCode: string;
  readonly city: string;
}

export interface BeautyDocsCreateSalonResult {
  readonly tenantSlug: string;
  readonly tenantDisplayName: string;
}

/**
 * Adds a second (or third, ...) salon under the currently signed-in owner,
 * from the personal account panel. Unlike {@link registerBeautyDocsAccount},
 * this never creates a new login — the owner is already authenticated.
 */
export async function createBeautyDocsSalon(
  payload: BeautyDocsCreateSalonPayload,
  rawCookieHeader: string | null,
  browserOrigin: string,
): Promise<BeautyDocsAdminApiResult<BeautyDocsCreateSalonResult>> {
  const response = await requestBeautyDocsAdminApi("/api/v1/auth/salons", {
    method: "POST",
    cookie: rawCookieHeader,
    origin: browserOrigin,
    body: JSON.stringify(payload),
  });

  if (response === null) {
    return { status: "unavailable" };
  }
  if (response.status === 401) {
    return { status: "unauthorized" };
  }
  if (response.status === 400 || response.status === 422) {
    return { status: "invalid-request" };
  }
  if (response.status !== 201) {
    return { status: "unavailable" };
  }

  try {
    const raw = JSON.parse(response.body) as Record<string, unknown>;
    const tenantSlug = raw.tenantSlug;
    const tenantDisplayName = raw.tenantDisplayName;
    if (typeof tenantSlug !== "string" || typeof tenantDisplayName !== "string") {
      return { status: "unavailable" };
    }
    return {
      status: "ok",
      data: { tenantSlug, tenantDisplayName },
      setCookie: response.setCookie,
    };
  } catch {
    return { status: "unavailable" };
  }
}

export async function setBeautyDocsUserSignature(
  signature: string,
  rawCookieHeader: string | null,
  browserOrigin: string,
): Promise<BeautyDocsAdminApiResult<null>> {
  const response = await requestBeautyDocsAdminApi(
    "/api/v1/auth/profile/signature",
    {
      method: "PUT",
      cookie: rawCookieHeader,
      origin: browserOrigin,
      body: JSON.stringify({ signature }),
    },
  );
  if (response === null) return { status: "unavailable" };
  if (response.status === 401) return { status: "unauthorized" };
  if (response.status === 403) return { status: "forbidden" };
  if (response.status === 422) return { status: "invalid-request" };
  if (response.status !== 204) return { status: "unavailable" };
  return { status: "ok", data: null, setCookie: response.setCookie };
}

export async function fetchBeautyDocsUserProfile(
  rawCookieHeader: string | null,
): Promise<BeautyDocsAdminApiResult<BeautyDocsUserProfile>> {
  const response = await requestBeautyDocsAdminApi("/api/v1/auth/profile", {
    method: "GET",
    cookie: rawCookieHeader,
  });
  if (response === null) return { status: "unavailable" };
  if (response.status === 401) return { status: "unauthorized" };
  if (response.status !== 200) return { status: "unavailable" };
  const profile = parseUserProfile(response.body);
  return profile === null
    ? { status: "unavailable" }
    : { status: "ok", data: profile, setCookie: null };
}

export async function updateBeautyDocsUserProfile(
  payload: { readonly displayName: string; readonly phone: string | null },
  rawCookieHeader: string | null,
  browserOrigin: string,
): Promise<BeautyDocsAdminApiResult<BeautyDocsUserProfile>> {
  const response = await requestBeautyDocsAdminApi("/api/v1/auth/profile", {
    method: "PUT",
    cookie: rawCookieHeader,
    origin: browserOrigin,
    body: JSON.stringify(payload),
  });
  if (response === null) return { status: "unavailable" };
  if (response.status === 401) return { status: "unauthorized" };
  if (response.status === 422) return { status: "invalid-request" };
  if (response.status !== 200) return { status: "unavailable" };
  const profile = parseUserProfile(response.body);
  return profile === null
    ? { status: "unavailable" }
    : { status: "ok", data: profile, setCookie: null };
}

/** The signed-in owner/staff account's saved interface language. */
export async function fetchBeautyDocsUserLanguage(
  rawCookieHeader: string | null,
): Promise<BeautyDocsAdminApiResult<BeautyDocsLocale>> {
  const response = await requestBeautyDocsAdminApi("/api/v1/auth/language", {
    method: "GET",
    cookie: rawCookieHeader,
  });
  return parseLanguageResponse(response);
}

export async function updateBeautyDocsUserLanguage(
  language: BeautyDocsLocale,
  rawCookieHeader: string | null,
  browserOrigin: string,
): Promise<BeautyDocsAdminApiResult<BeautyDocsLocale>> {
  const response = await requestBeautyDocsAdminApi("/api/v1/auth/language", {
    method: "PUT",
    cookie: rawCookieHeader,
    origin: browserOrigin,
    body: JSON.stringify({ language }),
  });
  return parseLanguageResponse(response);
}

function parseLanguageResponse(
  response: InternalApiResponse | null,
): BeautyDocsAdminApiResult<BeautyDocsLocale> {
  if (response === null) return { status: "unavailable" };
  if (response.status === 401) return { status: "unauthorized" };
  if (response.status === 422) return { status: "invalid-request" };
  if (response.status !== 200) return { status: "unavailable" };
  try {
    const language = (JSON.parse(response.body) as { language?: unknown }).language;
    return isBeautyDocsLocale(language)
      ? { status: "ok", data: language, setCookie: null }
      : { status: "unavailable" };
  } catch {
    return { status: "unavailable" };
  }
}

export async function changeBeautyDocsUserPassword(
  payload: { readonly newPassword: string },
  rawCookieHeader: string | null,
  browserOrigin: string,
): Promise<BeautyDocsAdminApiResult<null>> {
  const response = await requestBeautyDocsAdminApi(
    "/api/v1/auth/profile/password",
    {
      method: "PUT",
      cookie: rawCookieHeader,
      origin: browserOrigin,
      body: JSON.stringify(payload),
    },
  );
  if (response === null) return { status: "unavailable" };
  if (response.status === 401) return { status: "unauthorized" };
  if (response.status === 400 || response.status === 422) {
    return { status: "invalid-request" };
  }
  if (response.status === 409) return { status: "conflict" };
  if (response.status !== 204) return { status: "unavailable" };
  return { status: "ok", data: null, setCookie: null };
}

export async function fetchBeautyDocsUserSignature(
  rawCookieHeader: string | null,
): Promise<BeautyDocsAdminApiResult<ArrayBuffer>> {
  return fetchBeautyDocsAdminPng(
    "/api/v1/auth/profile/signature",
    rawCookieHeader,
  );
}

export async function deleteBeautyDocsUserAccount(
  rawCookieHeader: string | null,
  browserOrigin: string,
): Promise<BeautyDocsAdminApiResult<null>> {
  const response = await requestBeautyDocsAdminApi("/api/v1/auth/profile", {
    method: "DELETE",
    cookie: rawCookieHeader,
    origin: browserOrigin,
    body: JSON.stringify({ confirmation: "USUŃ KONTO" }),
  });
  if (response === null) return { status: "unavailable" };
  if (response.status === 401) return { status: "unauthorized" };
  if (response.status === 409) return { status: "invalid-request" };
  if (response.status !== 204) return { status: "unavailable" };
  return { status: "ok", data: null, setCookie: response.setCookie };
}

export async function fetchBeautyDocsTenantSettings(
  tenantSlug: string,
  rawCookieHeader: string | null,
): Promise<BeautyDocsAdminApiResult<BeautyDocsTenantSettings>> {
  if (!isValidTenantSlug(tenantSlug)) return { status: "not-found" };
  const response = await requestBeautyDocsAdminApi(
    `/api/v1/admin/tenants/${encodeURIComponent(tenantSlug)}/settings`,
    { method: "GET", cookie: rawCookieHeader },
  );
  return parseTenantSettingsResult(response);
}

export async function fetchBeautyDocsTenantVisits(
  tenantSlug: string,
  dateFrom: string,
  dateTo: string,
  rawCookieHeader: string | null,
): Promise<BeautyDocsAdminApiResult<BeautyDocsAdminVisitList>> {
  if (
    !isValidTenantSlug(tenantSlug) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(dateFrom) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(dateTo)
  ) {
    return { status: "invalid-request" };
  }
  const response = await requestBeautyDocsAdminApi(
    `/api/v1/admin/tenants/${encodeURIComponent(tenantSlug)}/visits` +
      `?from=${encodeURIComponent(dateFrom)}&to=${encodeURIComponent(dateTo)}`,
    { method: "GET", cookie: rawCookieHeader },
  );
  if (response === null) return { status: "unavailable" };
  if (response.status === 401) return { status: "unauthorized" };
  if (response.status === 403) return { status: "forbidden" };
  if (response.status === 404) return { status: "not-found" };
  if (response.status === 400 || response.status === 422) {
    return { status: "invalid-request" };
  }
  if (response.status !== 200) return { status: "unavailable" };
  try {
    const data = JSON.parse(response.body) as BeautyDocsAdminVisitList;
    if (
      !data ||
      !Array.isArray(data.items) ||
      typeof data.dateFrom !== "string" ||
      typeof data.dateTo !== "string"
    ) {
      return { status: "unavailable" };
    }
    const parsedData = {
      ...data,
      bookingSchedule: parseApiBookingSchedule(data.bookingSchedule),
    };
    return { status: "ok", data: parsedData, setCookie: response.setCookie };
  } catch {
    return { status: "unavailable" };
  }
}

export async function createBeautyDocsTenantVisit(
  tenantSlug: string,
  input: {
    readonly clientId: string | null;
    readonly newClient: {
      readonly fullName: string;
      readonly phone: string | null;
      readonly email: string | null;
    } | null;
    readonly formCode: string;
    readonly startsAt: string;
  },
  rawCookieHeader: string | null,
  browserOrigin: string,
): Promise<BeautyDocsAdminApiResult<BeautyDocsAdminVisit>> {
  if (
    !isValidTenantSlug(tenantSlug) ||
    ((input.clientId === null) === (input.newClient === null)) ||
    (input.clientId !== null && !isBeautyDocsClientId(input.clientId)) ||
    (input.newClient !== null &&
      (input.newClient.fullName.trim().length < 2 ||
        input.newClient.fullName.length > 281 ||
        (input.newClient.phone !== null && input.newClient.phone.length > 32) ||
        (input.newClient.email !== null && input.newClient.email.length > 320))) ||
    !isValidFormSlug(input.formCode) ||
    !Number.isFinite(Date.parse(input.startsAt))
  ) {
    return { status: "invalid-request" };
  }
  const response = await requestBeautyDocsAdminApi(
    `/api/v1/admin/tenants/${encodeURIComponent(tenantSlug)}/visits`,
    {
      method: "POST",
      cookie: rawCookieHeader,
      origin: browserOrigin,
      body: JSON.stringify(input),
    },
  );
  if (response === null) return { status: "unavailable" };
  if (response.status === 401) return { status: "unauthorized" };
  if (response.status === 403) return { status: "forbidden" };
  if (response.status === 404) return { status: "not-found" };
  if (response.status === 409) return { status: "conflict" };
  if (response.status === 422) {
    return { status: "invalid-request" };
  }
  if (response.status !== 201) return { status: "unavailable" };
  try {
    const data = JSON.parse(response.body) as BeautyDocsAdminVisit;
    if (
      !data ||
      typeof data.id !== "string" ||
      typeof data.clientId !== "string" ||
      typeof data.treatmentName !== "string" ||
      typeof data.startsAt !== "string"
    ) {
      return { status: "unavailable" };
    }
    return { status: "ok", data, setCookie: null };
  } catch {
    return { status: "unavailable" };
  }
}

export async function rescheduleBeautyDocsTenantVisit(
  tenantSlug: string,
  visitId: string,
  startsAt: string,
  rawCookieHeader: string | null,
  browserOrigin: string,
): Promise<BeautyDocsAdminApiResult<BeautyDocsAdminVisit>> {
  if (
    !isValidTenantSlug(tenantSlug) ||
    !isBeautyDocsClientId(visitId) ||
    !Number.isFinite(Date.parse(startsAt))
  ) {
    return { status: "invalid-request" };
  }
  const response = await requestBeautyDocsAdminApi(
    `/api/v1/admin/tenants/${encodeURIComponent(tenantSlug)}/visits/${encodeURIComponent(visitId)}`,
    {
      method: "PATCH",
      cookie: rawCookieHeader,
      origin: browserOrigin,
      body: JSON.stringify({ startsAt }),
    },
  );
  if (response === null) return { status: "unavailable" };
  if (response.status === 401) return { status: "unauthorized" };
  if (response.status === 403) return { status: "forbidden" };
  if (response.status === 404) return { status: "not-found" };
  if (response.status === 409) return { status: "conflict" };
  if (response.status === 422) {
    return { status: "invalid-request" };
  }
  if (response.status !== 200) return { status: "unavailable" };
  try {
    const data = JSON.parse(response.body) as BeautyDocsAdminVisit;
    if (
      !data ||
      data.id !== visitId ||
      typeof data.clientId !== "string" ||
      typeof data.startsAt !== "string"
    ) {
      return { status: "unavailable" };
    }
    return { status: "ok", data, setCookie: null };
  } catch {
    return { status: "unavailable" };
  }
}

export async function updateBeautyDocsTenantSettings(
  tenantSlug: string,
  payload: Omit<
    BeautyDocsTenantSettings,
    "slug" | "countryCode" | "role" | "canEdit" | "canDelete" | "logoImage"
  >,
  rawCookieHeader: string | null,
  browserOrigin: string,
): Promise<BeautyDocsAdminApiResult<BeautyDocsTenantSettings>> {
  if (!isValidTenantSlug(tenantSlug)) return { status: "not-found" };
  const response = await requestBeautyDocsAdminApi(
    `/api/v1/admin/tenants/${encodeURIComponent(tenantSlug)}/settings`,
    {
      method: "PUT",
      cookie: rawCookieHeader,
      origin: browserOrigin,
      body: JSON.stringify(payload),
    },
  );
  return parseTenantSettingsResult(response);
}

export async function updateBeautyDocsTenantLogo(
  tenantSlug: string,
  dataUrl: string | null,
  rawCookieHeader: string | null,
  browserOrigin: string,
): Promise<BeautyDocsAdminApiResult<BeautyDocsTenantSettings>> {
  if (!isValidTenantSlug(tenantSlug)) return { status: "not-found" };
  const response = await requestBeautyDocsAdminApi(
    `/api/v1/admin/tenants/${encodeURIComponent(tenantSlug)}/logo`,
    {
      method: "PUT",
      cookie: rawCookieHeader,
      origin: browserOrigin,
      body: JSON.stringify({ dataUrl }),
    },
  );
  return parseTenantSettingsResult(response);
}

export async function deleteBeautyDocsTenant(
  tenantSlug: string,
  rawCookieHeader: string | null,
  browserOrigin: string,
): Promise<BeautyDocsAdminApiResult<null>> {
  if (!isValidTenantSlug(tenantSlug)) return { status: "not-found" };
  const response = await requestBeautyDocsAdminApi(
    `/api/v1/admin/tenants/${encodeURIComponent(tenantSlug)}`,
    {
      method: "DELETE",
      cookie: rawCookieHeader,
      origin: browserOrigin,
      body: JSON.stringify({ confirmation: "USUŃ SALON" }),
    },
  );
  if (response === null) return { status: "unavailable" };
  if (response.status === 401) return { status: "unauthorized" };
  if (response.status === 403) return { status: "forbidden" };
  if (response.status === 404) return { status: "not-found" };
  if (response.status !== 204) return { status: "unavailable" };
  return { status: "ok", data: null, setCookie: null };
}

export async function logoutFromBeautyDocs(
  rawCookieHeader: string | null,
  browserOrigin: string,
): Promise<BeautyDocsAdminApiResult<null>> {
  const response = await requestBeautyDocsAdminApi("/api/v1/auth/logout", {
    method: "POST",
    cookie: rawCookieHeader,
    origin: browserOrigin,
  });

  if (response === null) {
    return { status: "unavailable" };
  }
  if (response.status === 401) {
    return { status: "unauthorized" };
  }
  if (response.status !== 204 || response.setCookie === null) {
    return { status: "unavailable" };
  }

  return { status: "ok", data: null, setCookie: response.setCookie };
}

export async function fetchBeautyDocsAdminSession(
  rawCookieHeader: string | null,
): Promise<BeautyDocsAdminApiResult<BeautyDocsAdminSession>> {
  const response = await requestBeautyDocsAdminApi("/api/v1/auth/me", {
    method: "GET",
    cookie: rawCookieHeader,
  });

  if (response === null) {
    return { status: "unavailable" };
  }
  const parsed = parseBeautyDocsAdminSessionResponse(
    response.status,
    response.body,
  );
  if (parsed.status !== "ok") {
    return parsed;
  }

  return { status: "ok", data: parsed.data, setCookie: null };
}

export async function fetchBeautyDocsTenantOverview(
  tenantSlug: string,
  rawCookieHeader: string | null,
): Promise<BeautyDocsAdminApiResult<BeautyDocsTenantOverview>> {
  if (!isValidTenantSlug(tenantSlug)) {
    return { status: "not-found" };
  }

  const response = await requestBeautyDocsAdminApi(
    `/api/v1/admin/tenants/${encodeURIComponent(tenantSlug)}/overview`,
    { method: "GET", cookie: rawCookieHeader },
  );

  if (response === null) {
    return { status: "unavailable" };
  }

  const parsed = parseBeautyDocsTenantOverviewResponse(
    response.status,
    response.body,
  );
  if (parsed.status !== "ok") {
    return parsed;
  }
  if (parsed.data.tenant.slug !== tenantSlug) {
    return { status: "unavailable" };
  }

  return { status: "ok", data: parsed.data, setCookie: null };
}

export async function fetchBeautyDocsTenantAnalytics(
  tenantSlug: string,
  rawCookieHeader: string | null,
): Promise<BeautyDocsAdminApiResult<BeautyDocsTenantAnalytics>> {
  if (!isValidTenantSlug(tenantSlug)) {
    return { status: "not-found" };
  }
  const response = await requestBeautyDocsAdminApi(
    `/api/v1/admin/tenants/${encodeURIComponent(tenantSlug)}/overview/analytics`,
    { method: "GET", cookie: rawCookieHeader },
  );
  if (response === null) return { status: "unavailable" };
  if (response.status === 401) return { status: "unauthorized" };
  if (response.status === 403) return { status: "forbidden" };
  if (response.status === 404) return { status: "not-found" };
  if (response.status !== 200) return { status: "unavailable" };

  const toFinite = (value: unknown): number =>
    typeof value === "number" && Number.isFinite(value) ? value : 0;
  try {
    const raw = JSON.parse(response.body) as Record<string, unknown>;
    const weeksRaw = Array.isArray(raw.weeks) ? raw.weeks : [];
    const treatmentsRaw = Array.isArray(raw.treatments) ? raw.treatments : [];
    return {
      status: "ok",
      data: {
        weeks: weeksRaw.map((entry) => {
          const item = entry as Record<string, unknown>;
          return {
            weekStart: typeof item.weekStart === "string" ? item.weekStart : "",
            visits: toFinite(item.visits),
            newClients: toFinite(item.newClients),
            submissions: toFinite(item.submissions),
          };
        }),
        treatments: treatmentsRaw.map((entry) => {
          const item = entry as Record<string, unknown>;
          return {
            label: typeof item.label === "string" ? item.label : "",
            count: toFinite(item.count),
          };
        }),
      },
      setCookie: null,
    };
  } catch {
    return { status: "unavailable" };
  }
}

export async function fetchBeautyDocsAdminClients(
  tenantSlug: string,
  query: BeautyDocsAdminClientListQuery,
  rawCookieHeader: string | null,
): Promise<BeautyDocsAdminApiResult<BeautyDocsAdminClientList>> {
  if (!isValidTenantSlug(tenantSlug)) {
    return { status: "not-found" };
  }

  const searchParams = new URLSearchParams({
    page: String(query.page),
    pageSize: String(query.pageSize),
  });
  if (query.search !== "") {
    searchParams.set("search", query.search);
  }

  const response = await requestBeautyDocsAdminApi(
    `/api/v1/admin/tenants/${encodeURIComponent(tenantSlug)}/clients?${searchParams.toString()}`,
    { method: "GET", cookie: rawCookieHeader },
  );
  if (response === null) {
    return { status: "unavailable" };
  }

  const parsed = parseBeautyDocsAdminClientListResponse(
    response.status,
    response.body,
  );
  if (parsed.status !== "ok") {
    return parsed;
  }
  if (
    parsed.data.page !== query.page ||
    parsed.data.pageSize !== query.pageSize
  ) {
    return { status: "unavailable" };
  }

  return { status: "ok", data: parsed.data, setCookie: null };
}

export async function fetchBeautyDocsAdminClientProfile(
  tenantSlug: string,
  clientId: string,
  rawCookieHeader: string | null,
): Promise<BeautyDocsAdminApiResult<BeautyDocsAdminClientProfile>> {
  if (!isValidTenantSlug(tenantSlug) || !isBeautyDocsClientId(clientId)) {
    return { status: "not-found" };
  }

  const response = await requestBeautyDocsAdminApi(
    `/api/v1/admin/tenants/${encodeURIComponent(tenantSlug)}/clients/${encodeURIComponent(clientId)}`,
    { method: "GET", cookie: rawCookieHeader },
  );
  if (response === null) {
    return { status: "unavailable" };
  }

  const parsed = parseBeautyDocsAdminClientProfileResponse(
    response.status,
    response.body,
  );
  if (parsed.status !== "ok") {
    return parsed;
  }
  if (parsed.data.client.id.toLowerCase() !== clientId.toLowerCase()) {
    return { status: "unavailable" };
  }

  return { status: "ok", data: parsed.data, setCookie: null };
}

export async function fetchBeautyDocsAdminClientFormDetail(
  tenantSlug: string,
  clientId: string,
  submissionId: string,
  rawCookieHeader: string | null,
): Promise<BeautyDocsAdminApiResult<BeautyDocsAdminClientFormDetail>> {
  if (
    !isValidTenantSlug(tenantSlug) ||
    !isBeautyDocsClientId(clientId) ||
    !isBeautyDocsSubmissionId(submissionId)
  ) {
    return { status: "not-found" };
  }

  const response = await requestBeautyDocsAdminApi(
    `/api/v1/admin/tenants/${encodeURIComponent(tenantSlug)}/clients/${encodeURIComponent(clientId)}/forms/${encodeURIComponent(submissionId)}`,
    { method: "GET", cookie: rawCookieHeader },
  );
  if (response === null) {
    return { status: "unavailable" };
  }

  const parsed = parseBeautyDocsAdminClientFormDetailResponse(
    response.status,
    response.body,
  );
  if (parsed.status !== "ok") {
    return parsed;
  }
  if (
    parsed.data.client.id.toLowerCase() !== clientId.toLowerCase() ||
    parsed.data.submission.id.toLowerCase() !== submissionId.toLowerCase()
  ) {
    return { status: "unavailable" };
  }

  return { status: "ok", data: parsed.data, setCookie: null };
}

export async function fetchBeautyDocsAdminClientFormSignature(
  tenantSlug: string,
  clientId: string,
  submissionId: string,
  signatureKey: string,
  rawCookieHeader: string | null,
): Promise<BeautyDocsAdminApiResult<ArrayBuffer>> {
  if (
    !isValidTenantSlug(tenantSlug) ||
    !isBeautyDocsClientId(clientId) ||
    !isBeautyDocsSubmissionId(submissionId) ||
    !isBeautyDocsSignatureKey(signatureKey)
  ) {
    return { status: "not-found" };
  }

  const endpointUrl = resolveBeautyDocsInternalApiUrl(
    `/api/v1/admin/tenants/${encodeURIComponent(tenantSlug)}` +
      `/clients/${encodeURIComponent(clientId)}` +
      `/forms/${encodeURIComponent(submissionId)}` +
      `/signatures/${encodeURIComponent(signatureKey)}`,
  );
  if (endpointUrl === null) {
    return { status: "unavailable" };
  }

  const cookie = filterBeautyDocsSessionCookie(rawCookieHeader);
  const headers = new Headers({ accept: "image/png", host: APP_HOST });
  if (cookie !== null) {
    headers.set("cookie", cookie);
  }

  try {
    const response = await fetch(endpointUrl, {
      method: "GET",
      headers,
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (response.status === 401) {
      return { status: "unauthorized" };
    }
    if (response.status === 403) {
      return { status: "forbidden" };
    }
    if (response.status === 404) {
      return { status: "not-found" };
    }
    if (response.status !== 200) {
      return { status: "unavailable" };
    }

    const contentType =
      response.headers.get("content-type")?.split(";", 1)[0]?.trim() ?? "";
    const declaredLength = Number(response.headers.get("content-length"));
    if (
      contentType.toLowerCase() !== "image/png" ||
      (Number.isFinite(declaredLength) &&
        (declaredLength <= 0 || declaredLength > MAX_SIGNATURE_BYTES))
    ) {
      return { status: "unavailable" };
    }

    const body = await response.arrayBuffer();
    const bytes = new Uint8Array(body);
    if (
      bytes.byteLength === 0 ||
      bytes.byteLength > MAX_SIGNATURE_BYTES ||
      PNG_MAGIC.some((byte, index) => bytes[index] !== byte)
    ) {
      return { status: "unavailable" };
    }

    return { status: "ok", data: body, setCookie: null };
  } catch {
    return { status: "unavailable" };
  }
}

export async function fetchBeautyDocsAdminClientFormPractitionerSignature(
  tenantSlug: string,
  clientId: string,
  submissionId: string,
  rawCookieHeader: string | null,
): Promise<BeautyDocsAdminApiResult<ArrayBuffer>> {
  if (
    !isValidTenantSlug(tenantSlug) ||
    !isBeautyDocsClientId(clientId) ||
    !isBeautyDocsSubmissionId(submissionId)
  ) {
    return { status: "not-found" };
  }
  return fetchBeautyDocsAdminPng(
    `/api/v1/admin/tenants/${encodeURIComponent(tenantSlug)}` +
      `/clients/${encodeURIComponent(clientId)}` +
      `/forms/${encodeURIComponent(submissionId)}` +
      "/practitioner-signature",
    rawCookieHeader,
  );
}

export async function startBeautyDocsPractitionerVerification(
  tenantSlug: string,
  clientId: string,
  submissionId: string,
  rawCookieHeader: string | null,
  browserOrigin: string,
  browserUserAgent: string | null,
): Promise<
  BeautyDocsAdminApiResult<BeautyDocsPractitionerVerificationStart>
> {
  const response = await requestPractitionerSigningApi(
    tenantSlug,
    clientId,
    submissionId,
    "/practitioner-verification",
    {
      method: "POST",
      cookie: rawCookieHeader,
      origin: browserOrigin,
      originalUserAgent: browserUserAgent,
    },
  );
  if (response === null) return { status: "unavailable" };
  const error = signingErrorResult(response.status);
  if (error) return error;
  try {
    const value = JSON.parse(response.body) as Record<string, unknown>;
    if (
      typeof value.verificationId !== "string" ||
      typeof value.destinationMasked !== "string" ||
      typeof value.expiresInSeconds !== "number" ||
      (value.devCode !== null && typeof value.devCode !== "string")
    ) {
      return { status: "unavailable" };
    }
    return {
      status: "ok",
      data: {
        verificationId: value.verificationId,
        destinationMasked: value.destinationMasked,
        expiresInSeconds: value.expiresInSeconds,
        devCode: value.devCode,
      },
      setCookie: null,
    };
  } catch {
    return { status: "unavailable" };
  }
}

export async function confirmBeautyDocsPractitionerVerification(
  tenantSlug: string,
  clientId: string,
  submissionId: string,
  payload: { readonly verificationId: string; readonly code: string },
  rawCookieHeader: string | null,
  browserOrigin: string,
  browserUserAgent: string | null,
): Promise<BeautyDocsAdminApiResult<null>> {
  const response = await requestPractitionerSigningApi(
    tenantSlug,
    clientId,
    submissionId,
    "/practitioner-verification/confirm",
    {
      method: "POST",
      cookie: rawCookieHeader,
      origin: browserOrigin,
      originalUserAgent: browserUserAgent,
      body: JSON.stringify(payload),
    },
  );
  if (response === null) return { status: "unavailable" };
  const error = signingErrorResult(response.status);
  if (error) return error;
  return { status: "ok", data: null, setCookie: null };
}

export async function signBeautyDocsPractitionerSubmission(
  tenantSlug: string,
  clientId: string,
  submissionId: string,
  payload: { readonly verificationId: string; readonly signature: string },
  rawCookieHeader: string | null,
  browserOrigin: string,
  browserUserAgent: string | null,
): Promise<BeautyDocsAdminApiResult<BeautyDocsPractitionerSignatureResult>> {
  const response = await requestPractitionerSigningApi(
    tenantSlug,
    clientId,
    submissionId,
    "/practitioner-signature",
    {
      method: "POST",
      cookie: rawCookieHeader,
      origin: browserOrigin,
      originalUserAgent: browserUserAgent,
      body: JSON.stringify(payload),
    },
  );
  if (response === null) return { status: "unavailable" };
  const error = signingErrorResult(response.status);
  if (error) return error;
  try {
    const value = JSON.parse(response.body) as Record<string, unknown>;
    if (
      typeof value.submissionId !== "string" ||
      value.status !== "SIGNED" ||
      typeof value.practitionerSignedAt !== "string" ||
      typeof value.documentHash !== "string"
    ) {
      return { status: "unavailable" };
    }
    return {
      status: "ok",
      data: {
        submissionId: value.submissionId,
        status: "SIGNED",
        practitionerSignedAt: value.practitionerSignedAt,
        documentHash: value.documentHash,
      },
      setCookie: null,
    };
  } catch {
    return { status: "unavailable" };
  }
}

async function requestPractitionerSigningApi(
  tenantSlug: string,
  clientId: string,
  submissionId: string,
  suffix: string,
  options: AdminApiRequestOptions,
): Promise<InternalApiResponse | null> {
  if (
    !isValidTenantSlug(tenantSlug) ||
    !isBeautyDocsClientId(clientId) ||
    !isBeautyDocsSubmissionId(submissionId)
  ) {
    return {
      status: 404,
      body: "",
      setCookie: null,
    };
  }
  return requestBeautyDocsAdminApi(
    `/api/v1/admin/tenants/${encodeURIComponent(tenantSlug)}` +
      `/clients/${encodeURIComponent(clientId)}` +
      `/forms/${encodeURIComponent(submissionId)}${suffix}`,
    options,
  );
}

function signingErrorResult(
  status: number,
): Exclude<BeautyDocsAdminApiResult<never>, { readonly status: "ok" }> | null {
  if (status >= 200 && status < 300) return null;
  if (status === 401) return { status: "unauthorized" };
  if (status === 403) return { status: "forbidden" };
  if (status === 404) return { status: "not-found" };
  if ([400, 409, 422, 429].includes(status)) {
    return { status: "invalid-request" };
  }
  return { status: "unavailable" };
}

export async function fetchBeautyDocsAdminTeam(
  tenantSlug: string,
  rawCookieHeader: string | null,
): Promise<BeautyDocsAdminApiResult<BeautyDocsAdminTeam>> {
  if (!isValidTenantSlug(tenantSlug)) {
    return { status: "not-found" };
  }
  const response = await requestBeautyDocsAdminApi(
    `/api/v1/admin/tenants/${encodeURIComponent(tenantSlug)}/team`,
    { method: "GET", cookie: rawCookieHeader },
  );
  if (response === null) {
    return { status: "unavailable" };
  }
  const parsed = parseBeautyDocsAdminTeamResponse(response.status, response.body);
  if (parsed.status !== "ok") {
    return parsed;
  }
  return { status: "ok", data: parsed.data, setCookie: null };
}

export async function createBeautyDocsAdminTeamMember(
  tenantSlug: string,
  payload: BeautyDocsTeamMemberPayload,
  rawCookieHeader: string | null,
  browserOrigin: string,
): Promise<BeautyDocsAdminApiResult<BeautyDocsAdminTeamMember>> {
  if (!isValidTenantSlug(tenantSlug)) {
    return { status: "not-found" };
  }
  const response = await requestBeautyDocsAdminApi(
    `/api/v1/admin/tenants/${encodeURIComponent(tenantSlug)}/team`,
    {
      method: "POST",
      cookie: rawCookieHeader,
      origin: browserOrigin,
      body: JSON.stringify(payload),
    },
  );
  if (response === null) {
    return { status: "unavailable" };
  }
  const parsed = parseBeautyDocsAdminTeamMemberResponse(
    response.status,
    response.body,
  );
  if (parsed.status !== "ok") {
    return parsed;
  }
  return { status: "ok", data: parsed.data, setCookie: null };
}

export async function createBeautyDocsStaffInvitation(
  tenantSlug: string,
  payload: BeautyDocsStaffInvitationPayload,
  rawCookieHeader: string | null,
  browserOrigin: string,
): Promise<BeautyDocsAdminApiResult<BeautyDocsStaffInvitationCreated>> {
  if (!isValidTenantSlug(tenantSlug)) return { status: "not-found" };
  const response = await requestBeautyDocsAdminApi(
    `/api/v1/admin/tenants/${encodeURIComponent(tenantSlug)}/team/invitations`,
    {
      method: "POST",
      cookie: rawCookieHeader,
      origin: browserOrigin,
      body: JSON.stringify(payload),
    },
  );
  if (response === null) return { status: "unavailable" };
  if (response.status === 401) return { status: "unauthorized" };
  if (response.status === 403) return { status: "forbidden" };
  if (response.status === 404) return { status: "not-found" };
  if (response.status === 409) return { status: "conflict" };
  if (response.status === 400 || response.status === 422) {
    return { status: "invalid-request" };
  }
  if (response.status !== 201) return { status: "unavailable" };
  try {
    const data = JSON.parse(response.body) as BeautyDocsStaffInvitationCreated;
    if (
      typeof data.id !== "string" ||
      typeof data.email !== "string" ||
      typeof data.salonName !== "string" ||
      typeof data.expiresAt !== "string" ||
      typeof data.activationUrl !== "string" ||
      !data.activationUrl.startsWith("http") ||
      typeof data.qrCodeDataUrl !== "string" ||
      !data.qrCodeDataUrl.startsWith("data:image/png;base64,")
    ) {
      return { status: "unavailable" };
    }
    return { status: "ok", data, setCookie: null };
  } catch {
    return { status: "unavailable" };
  }
}

export type BeautyDocsStaffInvitationResult =
  | { readonly status: "ok"; readonly data: BeautyDocsStaffInvitation }
  | { readonly status: "not-found" }
  | { readonly status: "invalid-request" }
  | { readonly status: "unavailable" };

export async function fetchBeautyDocsStaffInvitation(
  token: string,
): Promise<BeautyDocsStaffInvitationResult> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return { status: "invalid-request" };
  const response = await requestBeautyDocsAdminApi(
    `/api/v1/auth/staff-invitations/${encodeURIComponent(token)}`,
    { method: "GET" },
  );
  if (response === null) return { status: "unavailable" };
  if (response.status === 404) return { status: "not-found" };
  if (response.status !== 200) return { status: "unavailable" };
  try {
    const data = JSON.parse(response.body) as BeautyDocsStaffInvitation;
    if (
      typeof data.email !== "string" ||
      typeof data.salonName !== "string" ||
      typeof data.expiresAt !== "string"
    ) {
      return { status: "unavailable" };
    }
    return { status: "ok", data };
  } catch {
    return { status: "unavailable" };
  }
}

export async function acceptBeautyDocsStaffInvitation(
  token: string,
  payload: { readonly fullName: string; readonly password: string },
  browserOrigin: string,
): Promise<BeautyDocsStaffLoginResult | { readonly status: "conflict" | "not-found" }> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return { status: "not-found" };
  const response = await requestBeautyDocsAdminApi(
    `/api/v1/auth/staff-invitations/${encodeURIComponent(token)}/accept`,
    {
      method: "POST",
      origin: browserOrigin,
      body: JSON.stringify(payload),
    },
  );
  if (response === null) return { status: "unavailable" };
  if (response.status === 404) return { status: "not-found" };
  if (response.status === 409) return { status: "conflict" };
  if (response.status === 400 || response.status === 422) {
    return { status: "invalid-request" };
  }
  if (response.status !== 200) return { status: "unavailable" };
  const parsed = parseBeautyDocsAdminSessionResponse(
    response.status,
    response.body,
  );
  if (parsed.status !== "ok" || response.setCookie === null) {
    return { status: "unavailable" };
  }
  return {
    status: "ok",
    data: parsed.data,
    setCookie: response.setCookie,
  };
}

export async function updateBeautyDocsAdminTeamMember(
  tenantSlug: string,
  memberId: string,
  payload: BeautyDocsTeamMemberUpdatePayload,
  rawCookieHeader: string | null,
  browserOrigin: string,
): Promise<BeautyDocsAdminApiResult<BeautyDocsAdminTeamMember>> {
  if (
    !isValidTenantSlug(tenantSlug) ||
    !isBeautyDocsTeamMemberId(memberId)
  ) {
    return { status: "not-found" };
  }
  const response = await requestBeautyDocsAdminApi(
    `/api/v1/admin/tenants/${encodeURIComponent(tenantSlug)}` +
      `/team/${encodeURIComponent(memberId)}`,
    {
      method: "PUT",
      cookie: rawCookieHeader,
      origin: browserOrigin,
      body: JSON.stringify(payload),
    },
  );
  if (response === null) {
    return { status: "unavailable" };
  }
  const parsed = parseBeautyDocsAdminTeamMemberResponse(
    response.status,
    response.body,
  );
  if (parsed.status !== "ok") {
    return parsed;
  }
  return { status: "ok", data: parsed.data, setCookie: null };
}

export async function setBeautyDocsAdminTeamMemberSignature(
  tenantSlug: string,
  memberId: string,
  signature: string,
  rawCookieHeader: string | null,
  browserOrigin: string,
): Promise<BeautyDocsAdminApiResult<BeautyDocsAdminTeamMember>> {
  if (
    !isValidTenantSlug(tenantSlug) ||
    !isBeautyDocsTeamMemberId(memberId)
  ) {
    return { status: "not-found" };
  }
  const response = await requestBeautyDocsAdminApi(
    `/api/v1/admin/tenants/${encodeURIComponent(tenantSlug)}` +
      `/team/${encodeURIComponent(memberId)}/signature`,
    {
      method: "PUT",
      cookie: rawCookieHeader,
      origin: browserOrigin,
      body: JSON.stringify({ signature }),
    },
  );
  if (response === null) {
    return { status: "unavailable" };
  }
  const parsed = parseBeautyDocsAdminTeamMemberResponse(
    response.status,
    response.body,
  );
  if (parsed.status !== "ok") {
    return parsed;
  }
  return { status: "ok", data: parsed.data, setCookie: null };
}

export async function fetchBeautyDocsAdminTeamMemberSignature(
  tenantSlug: string,
  memberId: string,
  rawCookieHeader: string | null,
): Promise<BeautyDocsAdminApiResult<ArrayBuffer>> {
  if (
    !isValidTenantSlug(tenantSlug) ||
    !isBeautyDocsTeamMemberId(memberId)
  ) {
    return { status: "not-found" };
  }
  return fetchBeautyDocsAdminPng(
    `/api/v1/admin/tenants/${encodeURIComponent(tenantSlug)}` +
      `/team/${encodeURIComponent(memberId)}/signature`,
    rawCookieHeader,
  );
}

async function fetchBeautyDocsAdminPng(
  path: string,
  rawCookieHeader: string | null,
): Promise<BeautyDocsAdminApiResult<ArrayBuffer>> {
  const endpointUrl = resolveBeautyDocsInternalApiUrl(path);
  if (endpointUrl === null) {
    return { status: "unavailable" };
  }
  const cookie = filterBeautyDocsSessionCookie(rawCookieHeader);
  const headers = new Headers({ accept: "image/png", host: APP_HOST });
  if (cookie !== null) {
    headers.set("cookie", cookie);
  }
  try {
    const response = await fetch(endpointUrl, {
      method: "GET",
      headers,
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (response.status === 401) return { status: "unauthorized" };
    if (response.status === 403) return { status: "forbidden" };
    if (response.status === 404) return { status: "not-found" };
    if (response.status !== 200) return { status: "unavailable" };

    const contentType =
      response.headers.get("content-type")?.split(";", 1)[0]?.trim() ?? "";
    const body = await response.arrayBuffer();
    const bytes = new Uint8Array(body);
    if (
      contentType.toLowerCase() !== "image/png" ||
      bytes.byteLength === 0 ||
      bytes.byteLength > MAX_SIGNATURE_BYTES ||
      PNG_MAGIC.some((byte, index) => bytes[index] !== byte)
    ) {
      return { status: "unavailable" };
    }
    return { status: "ok", data: body, setCookie: null };
  } catch {
    return { status: "unavailable" };
  }
}

export async function fetchBeautyDocsAdminForms(
  tenantSlug: string,
  rawCookieHeader: string | null,
): Promise<BeautyDocsAdminApiResult<BeautyDocsAdminFormList>> {
  if (!isValidTenantSlug(tenantSlug)) {
    return { status: "not-found" };
  }

  const response = await requestBeautyDocsAdminApi(
    `/api/v1/admin/tenants/${encodeURIComponent(tenantSlug)}/forms`,
    { method: "GET", cookie: rawCookieHeader },
  );
  if (response === null) {
    return { status: "unavailable" };
  }

  const parsed = parseBeautyDocsAdminFormListResponse(
    response.status,
    response.body,
  );
  if (parsed.status !== "ok") {
    return parsed;
  }
  return { status: "ok", data: parsed.data, setCookie: null };
}

export async function setBeautyDocsAdminFormEnabled(
  tenantSlug: string,
  formCode: string,
  enabled: boolean,
  durationMinutes: number | undefined,
  rawCookieHeader: string | null,
  browserOrigin: string,
): Promise<BeautyDocsAdminApiResult<BeautyDocsAdminForm>> {
  if (!isValidTenantSlug(tenantSlug) || !isValidFormSlug(formCode)) {
    return { status: "not-found" };
  }

  const response = await requestBeautyDocsAdminApi(
    `/api/v1/admin/tenants/${encodeURIComponent(tenantSlug)}/forms/${encodeURIComponent(formCode)}`,
    {
      method: "PUT",
      cookie: rawCookieHeader,
      origin: browserOrigin,
      body: JSON.stringify({
        enabled,
        ...(durationMinutes === undefined ? {} : { durationMinutes }),
      }),
    },
  );
  if (response === null) {
    return { status: "unavailable" };
  }

  const parsed = parseBeautyDocsAdminFormEntryResponse(
    response.status,
    response.body,
  );
  if (parsed.status !== "ok") {
    return parsed;
  }
  if (parsed.data.code !== formCode) {
    return { status: "unavailable" };
  }
  return { status: "ok", data: parsed.data, setCookie: null };
}

export async function fetchBeautyDocsAdminFormPreview(
  tenantSlug: string,
  formCode: string,
  rawCookieHeader: string | null,
): Promise<BeautyDocsAdminApiResult<BeautyDocsAdminFormPreview>> {
  if (!isValidTenantSlug(tenantSlug) || !isValidFormSlug(formCode)) {
    return { status: "not-found" };
  }

  const response = await requestBeautyDocsAdminApi(
    `/api/v1/admin/tenants/${encodeURIComponent(tenantSlug)}/forms/${encodeURIComponent(formCode)}/preview`,
    { method: "GET", cookie: rawCookieHeader },
  );
  if (response === null) {
    return { status: "unavailable" };
  }

  const parsed = parseBeautyDocsAdminFormPreviewResponse(
    response.status,
    response.body,
  );
  if (parsed.status !== "ok") {
    return parsed;
  }
  if (parsed.data.code !== formCode) {
    return { status: "unavailable" };
  }
  return { status: "ok", data: parsed.data, setCookie: null };
}

export async function fetchBeautyDocsAdminNotifications(
  tenantSlug: string,
  rawCookieHeader: string | null,
  pageSize = 100,
): Promise<BeautyDocsAdminApiResult<BeautyDocsAdminNotificationList>> {
  if (
    !isValidTenantSlug(tenantSlug) ||
    !Number.isInteger(pageSize) ||
    pageSize < 1 ||
    pageSize > 200
  ) {
    return { status: "invalid-request" };
  }
  const response = await requestBeautyDocsAdminApi(
    `/api/v1/admin/tenants/${encodeURIComponent(tenantSlug)}` +
      `/notifications?pageSize=${pageSize}`,
    { method: "GET", cookie: rawCookieHeader },
  );
  if (response === null) return { status: "unavailable" };
  const parsed = parseBeautyDocsAdminNotificationListResponse(
    response.status,
    response.body,
  );
  return parsed.status === "ok"
    ? { status: "ok", data: parsed.data, setCookie: null }
    : parsed;
}

export async function updateBeautyDocsAdminNotification(
  tenantSlug: string,
  notificationId: string,
  update: { readonly read?: boolean; readonly archived?: boolean },
  rawCookieHeader: string | null,
  browserOrigin: string,
): Promise<BeautyDocsAdminApiResult<BeautyDocsAdminNotification>> {
  if (
    !isValidTenantSlug(tenantSlug) ||
    !isBeautyDocsNotificationId(notificationId) ||
    (update.read === undefined && update.archived === undefined)
  ) {
    return { status: "invalid-request" };
  }
  const response = await requestBeautyDocsAdminApi(
    `/api/v1/admin/tenants/${encodeURIComponent(tenantSlug)}` +
      `/notifications/${encodeURIComponent(notificationId)}`,
    {
      method: "PATCH",
      cookie: rawCookieHeader,
      origin: browserOrigin,
      body: JSON.stringify(update),
    },
  );
  if (response === null) return { status: "unavailable" };
  const parsed = parseBeautyDocsAdminNotificationResponse(
    response.status,
    response.body,
  );
  return parsed.status === "ok"
    ? { status: "ok", data: parsed.data, setCookie: null }
    : parsed;
}

function parseUserProfile(body: string): BeautyDocsUserProfile | null {
  try {
    const raw = JSON.parse(body) as Record<string, unknown>;
    if (
      typeof raw.displayName !== "string" ||
      typeof raw.email !== "string" ||
      (raw.phone !== null && typeof raw.phone !== "string") ||
      (raw.emailVerifiedAt !== null && typeof raw.emailVerifiedAt !== "string") ||
      typeof raw.createdAt !== "string" ||
      (raw.lastLoginAt !== null && typeof raw.lastLoginAt !== "string") ||
      typeof raw.signatureConfigured !== "boolean" ||
      (raw.signatureUpdatedAt !== null &&
        typeof raw.signatureUpdatedAt !== "string")
    ) {
      return null;
    }
    return {
      displayName: raw.displayName,
      email: raw.email,
      phone: raw.phone,
      emailVerifiedAt: raw.emailVerifiedAt,
      createdAt: raw.createdAt,
      lastLoginAt: raw.lastLoginAt,
      signatureConfigured: raw.signatureConfigured,
      signatureUpdatedAt: raw.signatureUpdatedAt,
    };
  } catch {
    return null;
  }
}

function parseTenantSettingsResult(
  response: InternalApiResponse | null,
): BeautyDocsAdminApiResult<BeautyDocsTenantSettings> {
  if (response === null) return { status: "unavailable" };
  if (response.status === 401) return { status: "unauthorized" };
  if (response.status === 403) return { status: "forbidden" };
  if (response.status === 404) return { status: "not-found" };
  if (response.status === 400 || response.status === 422) {
    return { status: "invalid-request" };
  }
  if (response.status !== 200) return { status: "unavailable" };
  try {
    const raw = JSON.parse(response.body) as Record<string, unknown>;
    const optionalKeys = [
      "nip",
      "regon",
      "krs",
      "phone",
      "websiteUrl",
      "addressLine1",
      "addressLine2",
      "postalCode",
      "city",
    ] as const;
    if (
      typeof raw.slug !== "string" ||
      typeof raw.displayName !== "string" ||
      typeof raw.legalName !== "string" ||
      typeof raw.email !== "string" ||
      typeof raw.privacyContactEmail !== "string" ||
      typeof raw.countryCode !== "string" ||
      typeof raw.directoryVisible !== "boolean" ||
      !["OWNER", "ADMIN", "STAFF", "READ_ONLY"].includes(String(raw.role)) ||
      typeof raw.canEdit !== "boolean" ||
      typeof raw.canDelete !== "boolean" ||
      optionalKeys.some(
        (key) => raw[key] !== null && typeof raw[key] !== "string",
      )
    ) {
      return { status: "unavailable" };
    }
    raw.bookingSchedule = parseApiBookingSchedule(raw.bookingSchedule);
    return {
      status: "ok",
      data: raw as unknown as BeautyDocsTenantSettings,
      setCookie: null,
    };
  } catch {
    return { status: "unavailable" };
  }
}

function parseApiBookingSchedule(value: unknown): BeautyDocsBookingSchedule {
  if (value === undefined) return LEGACY_DEFAULT_BOOKING_SCHEDULE;
  return parseBeautyDocsBookingSchedule(value);
}

export async function fetchBeautyDocsAdminChats(
  tenantSlug: string,
  cookie: string | null,
): Promise<BeautyDocsAdminApiResult<BeautyDocsChatConversationList>> {
  if (!isValidTenantSlug(tenantSlug)) return { status: "not-found" };
  return adminChatJsonRequest<BeautyDocsChatConversationList>(
    `/api/v1/admin/tenants/${encodeURIComponent(tenantSlug)}/chats`,
    { method: "GET", cookie },
  );
}

export async function fetchBeautyDocsAdminChat(
  tenantSlug: string,
  conversationId: string,
  cookie: string | null,
): Promise<BeautyDocsAdminApiResult<BeautyDocsChatConversationDetail>> {
  if (!isValidTenantSlug(tenantSlug) || !/^[0-9a-f-]{36}$/i.test(conversationId)) {
    return { status: "not-found" };
  }
  return adminChatJsonRequest<BeautyDocsChatConversationDetail>(
    `/api/v1/admin/tenants/${encodeURIComponent(tenantSlug)}` +
      `/chats/${encodeURIComponent(conversationId)}`,
    { method: "GET", cookie },
  );
}

export async function sendBeautyDocsAdminChatMessage(
  tenantSlug: string,
  conversationId: string,
  body: string,
  cookie: string | null,
  origin: string,
): Promise<BeautyDocsAdminApiResult<BeautyDocsChatMessage>> {
  if (!isValidTenantSlug(tenantSlug) || !/^[0-9a-f-]{36}$/i.test(conversationId)) {
    return { status: "not-found" };
  }
  return adminChatJsonRequest<BeautyDocsChatMessage>(
    `/api/v1/admin/tenants/${encodeURIComponent(tenantSlug)}` +
      `/chats/${encodeURIComponent(conversationId)}/messages`,
    {
      method: "POST",
      cookie,
      origin,
      body: JSON.stringify({ body }),
    },
  );
}

export async function assignBeautyDocsAdminChatPractitioner(
  tenantSlug: string,
  conversationId: string,
  assignedTeamMemberId: string | null,
  cookie: string | null,
  origin: string,
): Promise<BeautyDocsAdminApiResult<BeautyDocsChatConversationDetail>> {
  if (
    !isValidTenantSlug(tenantSlug) ||
    !/^[0-9a-f-]{36}$/i.test(conversationId) ||
    (assignedTeamMemberId !== null && !/^[0-9a-f-]{36}$/i.test(assignedTeamMemberId))
  ) {
    return { status: "not-found" };
  }
  return adminChatJsonRequest<BeautyDocsChatConversationDetail>(
    `/api/v1/admin/tenants/${encodeURIComponent(tenantSlug)}` +
      `/chats/${encodeURIComponent(conversationId)}`,
    {
      method: "PATCH",
      cookie,
      origin,
      body: JSON.stringify({ assignedTeamMemberId }),
    },
  );
}

export async function uploadBeautyDocsAdminChatAttachment(
  tenantSlug: string,
  conversationId: string,
  payload: {
    readonly fileName: string;
    readonly contentType: string;
    readonly caption: string;
    readonly body: ArrayBuffer;
  },
  cookie: string | null,
  origin: string,
): Promise<BeautyDocsAdminApiResult<BeautyDocsChatMessage>> {
  if (!isValidTenantSlug(tenantSlug) || !/^[0-9a-f-]{36}$/i.test(conversationId)) {
    return { status: "not-found" };
  }
  const response = await requestAdminChatFile(
    `/api/v1/admin/tenants/${encodeURIComponent(tenantSlug)}` +
      `/chats/${encodeURIComponent(conversationId)}/attachments`,
    { ...payload, cookie, origin },
  );
  if (response === null) return { status: "unavailable" };
  if (response.status < 200 || response.status >= 300) {
    return mapAdminChatError(response.status);
  }
  try {
    return {
      status: "ok",
      data: JSON.parse(response.body) as BeautyDocsChatMessage,
      setCookie: null,
    };
  } catch {
    return { status: "unavailable" };
  }
}

export async function downloadBeautyDocsAdminChatAttachment(
  tenantSlug: string,
  conversationId: string,
  attachmentId: string,
  cookie: string | null,
): Promise<BeautyDocsAdminApiResult<{
  readonly body: ArrayBuffer;
  readonly contentType: string;
  readonly contentDisposition: string | null;
}>> {
  if (
    !isValidTenantSlug(tenantSlug) ||
    !/^[0-9a-f-]{36}$/i.test(conversationId) ||
    !/^[0-9a-f-]{36}$/i.test(attachmentId)
  ) {
    return { status: "not-found" };
  }
  const response = await requestAdminChatFileDownload(
    `/api/v1/admin/tenants/${encodeURIComponent(tenantSlug)}` +
      `/chats/${encodeURIComponent(conversationId)}` +
      `/attachments/${encodeURIComponent(attachmentId)}`,
    cookie,
  );
  if (response === null) return { status: "unavailable" };
  if (response.status < 200 || response.status >= 300) {
    return mapAdminChatError(response.status);
  }
  return {
    status: "ok",
    data: {
      body: response.body,
      contentType: response.contentType,
      contentDisposition: response.contentDisposition,
    },
    setCookie: null,
  };
}

export async function markBeautyDocsAdminChatRead(
  tenantSlug: string,
  conversationId: string,
  cookie: string | null,
  origin: string,
): Promise<BeautyDocsAdminApiResult<null>> {
  if (!isValidTenantSlug(tenantSlug) || !/^[0-9a-f-]{36}$/i.test(conversationId)) {
    return { status: "not-found" };
  }
  const response = await requestBeautyDocsAdminApi(
    `/api/v1/admin/tenants/${encodeURIComponent(tenantSlug)}` +
      `/chats/${encodeURIComponent(conversationId)}/read`,
    { method: "POST", cookie, origin },
  );
  if (response === null) return { status: "unavailable" };
  if (response.status === 204) return { status: "ok", data: null, setCookie: null };
  return mapAdminChatError(response.status);
}

async function adminChatJsonRequest<T>(
  path: string,
  options: AdminApiRequestOptions,
): Promise<BeautyDocsAdminApiResult<T>> {
  const response = await requestBeautyDocsAdminApi(path, options);
  if (response === null) return { status: "unavailable" };
  if (response.status < 200 || response.status >= 300) {
    return mapAdminChatError(response.status);
  }
  try {
    return {
      status: "ok",
      data: JSON.parse(response.body) as T,
      setCookie: null,
    };
  } catch {
    return { status: "unavailable" };
  }
}

function mapAdminChatError<T>(status: number): BeautyDocsAdminApiResult<T> {
  if (status === 401) return { status: "unauthorized" };
  if (status === 403) return { status: "forbidden" };
  if (status === 404) return { status: "not-found" };
  if (status === 409) return { status: "conflict" };
  if (status === 400 || status === 422) return { status: "invalid-request" };
  return { status: "unavailable" };
}

interface AdminApiRequestOptions {
  readonly method: "DELETE" | "GET" | "PATCH" | "POST" | "PUT";
  readonly cookie?: string | null;
  readonly origin?: string;
  readonly body?: string;
  readonly originalUserAgent?: string | null;
}

async function requestBeautyDocsAdminApi(
  path: string,
  options: AdminApiRequestOptions,
): Promise<InternalApiResponse | null> {
  const maxResponseCharacters = path.endsWith("/profile") ? 2_000_000 : MAX_RESPONSE_CHARACTERS;
  const endpointUrl = resolveBeautyDocsInternalApiUrl(path);
  if (endpointUrl === null) {
    return null;
  }

  const cookie = filterBeautyDocsSessionCookie(options.cookie ?? null);
  const headers = new Headers({
    accept: "application/json",
    host: APP_HOST,
  });

  if (cookie !== null) {
    headers.set("cookie", cookie);
  }
  if (options.origin !== undefined) {
    headers.set("origin", options.origin);
  }
  if (options.body !== undefined) {
    headers.set("content-type", "application/json");
  }
  if (options.originalUserAgent) {
    headers.set(
      "x-beautydocs-original-user-agent",
      options.originalUserAgent.slice(0, 512),
    );
  }

  try {
    const response = await fetch(endpointUrl, {
      method: options.method,
      headers,
      body: options.body,
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    const declaredLength = Number(response.headers.get("content-length"));
    if (
      Number.isFinite(declaredLength) &&
      declaredLength > maxResponseCharacters
    ) {
      return null;
    }

    const body = await response.text();
    if (body.length > maxResponseCharacters) {
      return null;
    }

    return {
      status: response.status,
      body,
      setCookie: selectBeautyDocsSessionSetCookie(
        readSetCookieHeaders(response.headers),
        options.origin?.startsWith("https://") ?? false,
      ),
    };
  } catch {
    return null;
  }
}

async function requestAdminChatFile(
  path: string,
  options: {
    readonly cookie: string | null;
    readonly origin: string;
    readonly fileName: string;
    readonly contentType: string;
    readonly caption: string;
    readonly body: ArrayBuffer;
  },
): Promise<InternalApiResponse | null> {
  if (options.body.byteLength > MAX_CHAT_ATTACHMENT_BYTES) return null;
  const endpointUrl = resolveBeautyDocsInternalApiUrl(path);
  if (endpointUrl === null) return null;
  const headers = new Headers({
    accept: "application/json",
    host: APP_HOST,
    origin: options.origin,
    "content-type": options.contentType,
    "x-beautydocs-file-name": encodeURIComponent(options.fileName),
    "x-beautydocs-message-body": encodeURIComponent(options.caption),
  });
  const cookie = filterBeautyDocsSessionCookie(options.cookie);
  if (cookie) headers.set("cookie", cookie);
  try {
    const response = await fetch(endpointUrl, {
      method: "POST",
      headers,
      body: options.body,
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const body = await response.text();
    if (body.length > MAX_RESPONSE_CHARACTERS) return null;
    return { status: response.status, body, setCookie: null };
  } catch {
    return null;
  }
}

async function requestAdminChatFileDownload(
  path: string,
  rawCookie: string | null,
): Promise<{
  readonly status: number;
  readonly body: ArrayBuffer;
  readonly contentType: string;
  readonly contentDisposition: string | null;
} | null> {
  const endpointUrl = resolveBeautyDocsInternalApiUrl(path);
  if (endpointUrl === null) return null;
  const headers = new Headers({ host: APP_HOST });
  const cookie = filterBeautyDocsSessionCookie(rawCookie);
  if (cookie) headers.set("cookie", cookie);
  try {
    const response = await fetch(endpointUrl, {
      method: "GET",
      headers,
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const body = await response.arrayBuffer();
    if (body.byteLength > MAX_CHAT_ATTACHMENT_BYTES) return null;
    return {
      status: response.status,
      body,
      contentType: response.headers.get("content-type") ?? "application/octet-stream",
      contentDisposition: response.headers.get("content-disposition"),
    };
  } catch {
    return null;
  }
}

function readSetCookieHeaders(headers: Headers): readonly string[] {
  const headersWithCookies = headers as Headers & {
    getSetCookie?: () => string[];
  };
  const values = headersWithCookies.getSetCookie?.();
  if (values && values.length > 0) {
    return values;
  }

  const combinedValue = headers.get("set-cookie");
  return combinedValue === null ? [] : [combinedValue];
}

export async function requestSalonProfile(
  slug: string, method: "GET" | "PUT", cookie: string | null, origin?: string, body?: string,
): Promise<BeautyDocsAdminApiResult<unknown>> {
  if (!isValidTenantSlug(slug)) return { status: "not-found" };
  return adminChatJsonRequest(`/api/v1/admin/tenants/${encodeURIComponent(slug)}/profile`, { method, cookie, origin, body });
}
