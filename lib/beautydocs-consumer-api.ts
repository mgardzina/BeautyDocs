import "server-only";

import {
  filterBeautyDocsConsumerSessionCookie,
  selectBeautyDocsConsumerSessionSetCookie,
} from "./beautydocs-bff-security";
import { resolveBeautyDocsInternalApiUrl } from "./beautydocs-internal-api";
import type {
  BeautyDocsConsumerAppointmentAvailability,
  BeautyDocsConsumerAppointmentCreated,
  BeautyDocsConsumerAppointmentFormAccess,
  BeautyDocsConsumerAppointmentList,
  BeautyDocsConsumerAppointmentMonthAvailability,
  BeautyDocsConsumerDocument,
  BeautyDocsConsumerDocumentDetail,
  BeautyDocsGoogleLoginConfig,
  BeautyDocsConsumerEmailChallenge,
  BeautyDocsConsumerRegistrationToken,
  BeautyDocsConsumerLoginChallenge,
  BeautyDocsConsumerMedicalCatalog,
  BeautyDocsConsumerSalonList,
  BeautyDocsConsumerState,
} from "../types/beautydocs-consumer";
import type {
  BeautyDocsChatConversationDetail,
  BeautyDocsChatConversationList,
  BeautyDocsChatMessage,
} from "../types/beautydocs-chat";
import type {
  BeautyDocsMfaChallenge,
  BeautyDocsMfaChangeAuthorization,
  BeautyDocsMfaLoginChallenge,
  BeautyDocsMfaMethod,
  BeautyDocsMfaState,
} from "../types/beautydocs-admin";

const APP_HOST = "app.beautydocs.pl";
const MAX_RESPONSE_CHARACTERS = 1_024 * 1_024;
const MAX_CHAT_ATTACHMENT_BYTES = 8 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 10_000;

export type ConsumerApiResult<T> =
  | { readonly status: "ok"; readonly data: T; readonly setCookie: string | null }
  | { readonly status: "unauthorized" }
  | { readonly status: "forbidden" }
  | { readonly status: "not-found" }
  | { readonly status: "invalid" }
  | { readonly status: "rate-limited" }
  | { readonly status: "conflict" }
  | { readonly status: "unavailable" };

interface RequestOptions {
  readonly method: "DELETE" | "GET" | "POST" | "PUT";
  readonly cookie?: string | null;
  readonly origin?: string;
  readonly body?: string;
  readonly originalUserAgent?: string | null;
}

interface InternalResponse {
  readonly status: number;
  readonly body: string;
  readonly setCookie: string | null;
}

export async function requestConsumerPhoneCode(
  phone: string,
  cookie: string | null,
  origin: string,
  userAgent: string | null,
): Promise<ConsumerApiResult<BeautyDocsConsumerLoginChallenge>> {
  return consumerJsonRequest<BeautyDocsConsumerLoginChallenge>(
    "/api/v1/consumer/profile/phone/code",
    {
      method: "POST",
      cookie,
      origin,
      originalUserAgent: userAgent,
      body: JSON.stringify({ phone }),
    },
  );
}

export async function verifyConsumerPhoneCode(
  payload: { readonly phone: string; readonly challengeId: string; readonly code: string },
  cookie: string | null,
  origin: string,
  userAgent: string | null,
): Promise<ConsumerApiResult<BeautyDocsConsumerState>> {
  return consumerJsonRequest<BeautyDocsConsumerState>(
    "/api/v1/consumer/profile/phone/verify",
    {
      method: "POST",
      cookie,
      origin,
      originalUserAgent: userAgent,
      body: JSON.stringify(payload),
    },
  );
}

export async function registerConsumer(
  payload: { readonly email: string },
  origin: string,
): Promise<ConsumerApiResult<BeautyDocsConsumerEmailChallenge>> {
  return consumerJsonRequest<BeautyDocsConsumerEmailChallenge>(
    "/api/v1/consumer/auth/register",
    {
      method: "POST",
      origin,
      body: JSON.stringify(payload),
    },
  );
}

export async function verifyConsumerEmailRegistration(
  payload: { readonly email: string; readonly code: string },
  origin: string,
): Promise<ConsumerApiResult<BeautyDocsConsumerRegistrationToken>> {
  // Verification no longer opens a session — it returns a one-time token the
  // browser passes to the finalize step, where the account is created.
  return consumerJsonRequest<BeautyDocsConsumerRegistrationToken>(
    "/api/v1/consumer/auth/register/verify",
    {
      method: "POST",
      origin,
      body: JSON.stringify(payload),
    },
  );
}

export async function completeConsumerRegistration(
  payload: {
    readonly registrationToken: string;
    readonly fullName: string;
    readonly password: string;
  },
  origin: string,
): Promise<ConsumerApiResult<BeautyDocsConsumerState>> {
  return consumerJsonRequest<BeautyDocsConsumerState>(
    "/api/v1/consumer/auth/register/complete",
    {
      method: "POST",
      origin,
      body: JSON.stringify(payload),
    },
  );
}

export async function loginConsumerWithPassword(
  payload: { readonly email: string; readonly password: string },
  origin: string,
): Promise<ConsumerApiResult<BeautyDocsConsumerState | BeautyDocsMfaLoginChallenge>> {
  return consumerJsonRequest<BeautyDocsConsumerState | BeautyDocsMfaLoginChallenge>(
    "/api/v1/consumer/auth/password",
    {
      method: "POST",
      origin,
      body: JSON.stringify(payload),
    },
  );
}

export async function fetchConsumerMfaState(
  cookie: string | null,
): Promise<ConsumerApiResult<BeautyDocsMfaState>> {
  return consumerJsonRequest<BeautyDocsMfaState>("/api/v1/consumer/mfa", {
    method: "GET",
    cookie,
  });
}

export async function startConsumerMfaEnrollment(
  payload: {
    readonly method: BeautyDocsMfaMethod;
    readonly phone?: string;
    readonly changeChallengeId?: string;
  },
  cookie: string | null,
  origin: string,
): Promise<ConsumerApiResult<BeautyDocsMfaChallenge>> {
  return consumerJsonRequest<BeautyDocsMfaChallenge>("/api/v1/consumer/mfa/enrollment", {
    method: "POST",
    cookie,
    origin,
    body: JSON.stringify(payload),
  });
}

export async function confirmConsumerMfaEnrollment(
  challengeId: string,
  code: string,
  cookie: string | null,
  origin: string,
): Promise<ConsumerApiResult<BeautyDocsMfaState>> {
  return consumerJsonRequest<BeautyDocsMfaState>(
    "/api/v1/consumer/mfa/enrollment/confirm",
    {
      method: "POST",
      cookie,
      origin,
      body: JSON.stringify({ challengeId, code }),
    },
  );
}

export async function startConsumerMfaChange(
  cookie: string | null,
  origin: string,
): Promise<ConsumerApiResult<BeautyDocsMfaChallenge>> {
  return consumerJsonRequest<BeautyDocsMfaChallenge>(
    "/api/v1/consumer/mfa/change-challenge",
    { method: "POST", cookie, origin, body: JSON.stringify({}) },
  );
}

export async function confirmConsumerMfaChange(
  challengeId: string,
  code: string,
  cookie: string | null,
  origin: string,
): Promise<ConsumerApiResult<BeautyDocsMfaChangeAuthorization>> {
  return consumerJsonRequest<BeautyDocsMfaChangeAuthorization>(
    "/api/v1/consumer/mfa/change/confirm",
    {
      method: "POST",
      cookie,
      origin,
      body: JSON.stringify({ challengeId, code }),
    },
  );
}

export async function startConsumerMfaDisable(
  cookie: string | null,
  origin: string,
): Promise<ConsumerApiResult<BeautyDocsMfaChallenge>> {
  return consumerJsonRequest<BeautyDocsMfaChallenge>(
    "/api/v1/consumer/mfa/disable-challenge",
    { method: "POST", cookie, origin, body: JSON.stringify({}) },
  );
}

export async function confirmConsumerMfaDisable(
  challengeId: string,
  code: string,
  cookie: string | null,
  origin: string,
): Promise<ConsumerApiResult<null>> {
  const response = await requestApi("/api/v1/consumer/mfa/disable/confirm", {
    method: "POST",
    cookie,
    origin,
    body: JSON.stringify({ challengeId, code }),
  });
  if (response === null) return { status: "unavailable" };
  if (response.status !== 204) return mapError(response.status);
  return { status: "ok", data: null, setCookie: response.setCookie };
}

export async function confirmConsumerMfaLogin(
  challengeId: string,
  code: string,
  origin: string,
): Promise<ConsumerApiResult<BeautyDocsConsumerState>> {
  return consumerJsonRequest<BeautyDocsConsumerState>(
    "/api/v1/consumer/mfa/login/confirm",
    {
      method: "POST",
      origin,
      body: JSON.stringify({ challengeId, code }),
    },
  );
}

export async function fetchConsumerGoogleLoginConfig(): Promise<
  ConsumerApiResult<BeautyDocsGoogleLoginConfig>
> {
  return consumerJsonRequest<BeautyDocsGoogleLoginConfig>(
    "/api/v1/consumer/auth/google/config",
    { method: "GET" },
  );
}

export async function loginConsumerWithGoogle(
  proof: { readonly credential?: string; readonly accessToken?: string },
  cookie: string | null,
  origin: string,
): Promise<ConsumerApiResult<BeautyDocsConsumerState>> {
  return consumerJsonRequest<BeautyDocsConsumerState>(
    "/api/v1/consumer/auth/google",
    {
      method: "POST",
      cookie,
      origin,
      body: JSON.stringify({
        credential: proof.credential,
        accessToken: proof.accessToken,
      }),
    },
  );
}

export interface BeautyDocsCheckInToken {
  readonly token: string;
  readonly expiresInSeconds: number;
}

export async function fetchConsumerCheckInToken(
  cookie: string | null,
  origin: string,
): Promise<ConsumerApiResult<BeautyDocsCheckInToken>> {
  return consumerJsonRequest<BeautyDocsCheckInToken>(
    "/api/v1/consumer/check-in-token",
    { method: "POST", cookie, origin, body: JSON.stringify({}) },
  );
}

export async function claimConsumerDocument(
  payload: {
    readonly submissionId: string;
    readonly claimToken: string;
    readonly saveProfile: boolean;
  },
  cookie: string | null,
  origin: string,
): Promise<ConsumerApiResult<BeautyDocsConsumerState>> {
  return consumerJsonRequest<BeautyDocsConsumerState>("/api/v1/consumer/claim", {
    method: "POST",
    cookie,
    origin,
    body: JSON.stringify(payload),
  });
}

export async function fetchConsumerState(
  cookie: string | null,
): Promise<ConsumerApiResult<BeautyDocsConsumerState>> {
  return consumerJsonRequest<BeautyDocsConsumerState>("/api/v1/consumer/me", {
    method: "GET",
    cookie,
  });
}

export async function updateConsumerProfile(
  payload: Record<string, unknown>,
  cookie: string | null,
  origin: string,
): Promise<ConsumerApiResult<BeautyDocsConsumerState>> {
  return consumerJsonRequest<BeautyDocsConsumerState>("/api/v1/consumer/profile", {
    method: "PUT",
    cookie,
    origin,
    body: JSON.stringify(payload),
  });
}

export async function fetchConsumerMedicalCatalog(
  cookie: string | null,
): Promise<ConsumerApiResult<BeautyDocsConsumerMedicalCatalog>> {
  return consumerJsonRequest<BeautyDocsConsumerMedicalCatalog>(
    "/api/v1/consumer/profile/medical",
    { method: "GET", cookie },
  );
}

export async function updateConsumerMedicalProfile(
  payload: Record<string, unknown>,
  cookie: string | null,
  origin: string,
): Promise<ConsumerApiResult<BeautyDocsConsumerState>> {
  return consumerJsonRequest<BeautyDocsConsumerState>(
    "/api/v1/consumer/profile/medical",
    {
      method: "PUT",
      cookie,
      origin,
      body: JSON.stringify(payload),
    },
  );
}

export async function fetchConsumerSignature(
  cookie: string | null,
): Promise<ConsumerApiResult<ArrayBuffer>> {
  const response = await requestApiBinary("/api/v1/consumer/profile/signature", {
    method: "GET",
    cookie,
  });
  if (response === null) return { status: "unavailable" };
  if (response.status < 200 || response.status >= 300) return mapError(response.status);
  return { status: "ok", data: response.body, setCookie: response.setCookie };
}

export async function updateConsumerSignature(
  signature: string,
  cookie: string | null,
  origin: string,
): Promise<ConsumerApiResult<null>> {
  const response = await requestApi("/api/v1/consumer/profile/signature", {
    method: "PUT",
    cookie,
    origin,
    body: JSON.stringify({ signature }),
  });
  if (response === null) return { status: "unavailable" };
  if (response.status !== 204) return mapError(response.status);
  return { status: "ok", data: null, setCookie: response.setCookie };
}

export async function deleteConsumerSignature(
  cookie: string | null,
  origin: string,
): Promise<ConsumerApiResult<null>> {
  const response = await requestApi("/api/v1/consumer/profile/signature", {
    method: "DELETE",
    cookie,
    origin,
  });
  if (response === null) return { status: "unavailable" };
  if (response.status !== 204) return mapError(response.status);
  return { status: "ok", data: null, setCookie: response.setCookie };
}

export async function fetchConsumerDocuments(
  cookie: string | null,
): Promise<ConsumerApiResult<{ readonly items: BeautyDocsConsumerDocument[] }>> {
  return consumerJsonRequest<{ readonly items: BeautyDocsConsumerDocument[] }>(
    "/api/v1/consumer/documents",
    { method: "GET", cookie },
  );
}

export async function fetchConsumerChats(
  cookie: string | null,
): Promise<ConsumerApiResult<BeautyDocsChatConversationList>> {
  return consumerJsonRequest<BeautyDocsChatConversationList>(
    "/api/v1/consumer/chats",
    { method: "GET", cookie },
  );
}

export async function fetchConsumerChat(
  conversationId: string,
  cookie: string | null,
): Promise<ConsumerApiResult<BeautyDocsChatConversationDetail>> {
  if (!/^[0-9a-f-]{36}$/i.test(conversationId)) return { status: "not-found" };
  return consumerJsonRequest<BeautyDocsChatConversationDetail>(
    `/api/v1/consumer/chats/${encodeURIComponent(conversationId)}`,
    { method: "GET", cookie },
  );
}

export async function startConsumerChat(
  payload: { readonly tenantSlug: string; readonly body: string },
  cookie: string | null,
  origin: string,
): Promise<ConsumerApiResult<BeautyDocsChatConversationDetail>> {
  return consumerJsonRequest<BeautyDocsChatConversationDetail>(
    "/api/v1/consumer/chats",
    {
      method: "POST",
      cookie,
      origin,
      body: JSON.stringify(payload),
    },
  );
}

export async function sendConsumerChatMessage(
  conversationId: string,
  body: string,
  cookie: string | null,
  origin: string,
): Promise<ConsumerApiResult<BeautyDocsChatMessage>> {
  if (!/^[0-9a-f-]{36}$/i.test(conversationId)) return { status: "not-found" };
  return consumerJsonRequest<BeautyDocsChatMessage>(
    `/api/v1/consumer/chats/${encodeURIComponent(conversationId)}/messages`,
    {
      method: "POST",
      cookie,
      origin,
      body: JSON.stringify({ body }),
    },
  );
}

export async function uploadConsumerChatAttachment(
  conversationId: string | null,
  payload: {
    readonly tenantSlug?: string;
    readonly fileName: string;
    readonly contentType: string;
    readonly caption: string;
    readonly body: ArrayBuffer;
  },
  cookie: string | null,
  origin: string,
): Promise<ConsumerApiResult<BeautyDocsChatMessage | BeautyDocsChatConversationDetail>> {
  if (conversationId !== null && !/^[0-9a-f-]{36}$/i.test(conversationId)) {
    return { status: "not-found" };
  }
  const path = conversationId === null
    ? "/api/v1/consumer/chats/attachments"
    : `/api/v1/consumer/chats/${encodeURIComponent(conversationId)}/attachments`;
  const response = await requestConsumerChatFile(path, {
    method: "POST",
    cookie,
    origin,
    fileName: payload.fileName,
    contentType: payload.contentType,
    caption: payload.caption,
    tenantSlug: payload.tenantSlug,
    body: payload.body,
  });
  if (response === null) return { status: "unavailable" };
  if (response.status < 200 || response.status >= 300) return mapError(response.status);
  try {
    return {
      status: "ok",
      data: JSON.parse(response.body) as BeautyDocsChatMessage | BeautyDocsChatConversationDetail,
      setCookie: response.setCookie,
    };
  } catch {
    return { status: "unavailable" };
  }
}

export async function downloadConsumerChatAttachment(
  conversationId: string,
  attachmentId: string,
  cookie: string | null,
): Promise<ConsumerApiResult<{
  readonly body: ArrayBuffer;
  readonly contentType: string;
  readonly contentDisposition: string | null;
}>> {
  if (
    !/^[0-9a-f-]{36}$/i.test(conversationId) ||
    !/^[0-9a-f-]{36}$/i.test(attachmentId)
  ) {
    return { status: "not-found" };
  }
  const response = await requestConsumerChatFileDownload(
    `/api/v1/consumer/chats/${encodeURIComponent(conversationId)}` +
      `/attachments/${encodeURIComponent(attachmentId)}`,
    cookie,
  );
  if (response === null) return { status: "unavailable" };
  if (response.status < 200 || response.status >= 300) return mapError(response.status);
  return {
    status: "ok",
    data: {
      body: response.body,
      contentType: response.contentType,
      contentDisposition: response.contentDisposition,
    },
    setCookie: response.setCookie,
  };
}

export async function markConsumerChatRead(
  conversationId: string,
  cookie: string | null,
  origin: string,
): Promise<ConsumerApiResult<null>> {
  if (!/^[0-9a-f-]{36}$/i.test(conversationId)) return { status: "not-found" };
  const response = await requestApi(
    `/api/v1/consumer/chats/${encodeURIComponent(conversationId)}/read`,
    { method: "POST", cookie, origin },
  );
  if (response === null) return { status: "unavailable" };
  if (response.status !== 204) return mapError(response.status);
  return { status: "ok", data: null, setCookie: response.setCookie };
}

export async function searchConsumerSalons(
  query: string,
  cookie: string | null,
  slug?: string,
): Promise<ConsumerApiResult<BeautyDocsConsumerSalonList>> {
  const params = new URLSearchParams();
  const normalizedQuery = query.trim().split(/\s+/).join(" ").slice(0, 100);
  if (normalizedQuery) params.set("query", normalizedQuery);
  // A direct slug lookup (from a salon's own public page "Umów wizytę" link)
  // bypasses the ranked text search entirely on the API side.
  if (slug && /^[a-z0-9-]{1,63}$/.test(slug)) params.set("slug", slug);
  const search = params.toString();
  const path = search
    ? `/api/v1/consumer/salons?${search}`
    : "/api/v1/consumer/salons";
  return consumerJsonRequest<BeautyDocsConsumerSalonList>(path, {
    method: "GET",
    cookie,
  });
}

export async function fetchConsumerAppointmentAvailability(
  tenantSlug: string,
  formCode: string,
  date: string,
  cookie: string | null,
): Promise<ConsumerApiResult<BeautyDocsConsumerAppointmentAvailability>> {
  if (
    !/^[a-z0-9-]{1,63}$/.test(tenantSlug) ||
    !/^[a-z0-9-]{1,100}$/.test(formCode) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date)
  ) {
    return { status: "invalid" };
  }
  return consumerJsonRequest<BeautyDocsConsumerAppointmentAvailability>(
    `/api/v1/consumer/salons/${encodeURIComponent(tenantSlug)}/availability` +
      `?formCode=${encodeURIComponent(formCode)}&date=${encodeURIComponent(date)}`,
    { method: "GET", cookie },
  );
}

export async function fetchConsumerAppointmentMonthAvailability(
  tenantSlug: string,
  formCode: string,
  month: string,
  cookie: string | null,
): Promise<ConsumerApiResult<BeautyDocsConsumerAppointmentMonthAvailability>> {
  if (
    !/^[a-z0-9-]{1,63}$/.test(tenantSlug) ||
    !/^[a-z0-9-]{1,100}$/.test(formCode) ||
    !/^\d{4}-\d{2}$/.test(month)
  ) {
    return { status: "invalid" };
  }
  return consumerJsonRequest<BeautyDocsConsumerAppointmentMonthAvailability>(
    `/api/v1/consumer/salons/${encodeURIComponent(tenantSlug)}/availability/month` +
      `?formCode=${encodeURIComponent(formCode)}&month=${encodeURIComponent(month)}`,
    { method: "GET", cookie },
  );
}

export async function createConsumerAppointment(
  payload: {
    readonly tenantSlug: string;
    readonly formCode: string;
    readonly startsAt: string;
  },
  cookie: string | null,
  origin: string,
): Promise<ConsumerApiResult<BeautyDocsConsumerAppointmentCreated>> {
  return consumerJsonRequest<BeautyDocsConsumerAppointmentCreated>(
    "/api/v1/consumer/appointments",
    {
      method: "POST",
      cookie,
      origin,
      body: JSON.stringify(payload),
    },
  );
}

export async function fetchConsumerAppointments(
  cookie: string | null,
): Promise<ConsumerApiResult<BeautyDocsConsumerAppointmentList>> {
  return consumerJsonRequest<BeautyDocsConsumerAppointmentList>(
    "/api/v1/consumer/appointments",
    { method: "GET", cookie },
  );
}

export async function cancelConsumerAppointment(
  appointmentId: string,
  cookie: string | null,
  origin: string,
): Promise<ConsumerApiResult<null>> {
  if (!/^[0-9a-f-]{36}$/i.test(appointmentId)) return { status: "not-found" };
  const response = await requestApi(
    `/api/v1/consumer/appointments/${encodeURIComponent(appointmentId)}`,
    { method: "DELETE", cookie, origin },
  );
  if (response === null) return { status: "unavailable" };
  if (response.status !== 204) return mapError(response.status);
  return { status: "ok", data: null, setCookie: response.setCookie };
}

export async function createConsumerAppointmentFormAccess(
  appointmentId: string,
  cookie: string | null,
  origin: string,
): Promise<ConsumerApiResult<BeautyDocsConsumerAppointmentFormAccess>> {
  if (!/^[0-9a-f-]{36}$/i.test(appointmentId)) return { status: "not-found" };
  return consumerJsonRequest<BeautyDocsConsumerAppointmentFormAccess>(
    `/api/v1/consumer/appointments/${encodeURIComponent(appointmentId)}/form-access`,
    { method: "POST", cookie, origin },
  );
}

export async function fetchConsumerDocument(
  submissionId: string,
  cookie: string | null,
): Promise<ConsumerApiResult<BeautyDocsConsumerDocumentDetail>> {
  if (!/^[0-9a-f-]{36}$/i.test(submissionId)) return { status: "not-found" };
  return consumerJsonRequest<BeautyDocsConsumerDocumentDetail>(
    `/api/v1/consumer/documents/${encodeURIComponent(submissionId)}`,
    { method: "GET", cookie },
  );
}

export async function fetchConsumerDocumentSignature(
  submissionId: string,
  signatureKey: string,
  cookie: string | null,
): Promise<ConsumerApiResult<ArrayBuffer>> {
  if (
    !/^[0-9a-f-]{36}$/i.test(submissionId) ||
    !/^[A-Za-z0-9_-]{1,100}$/.test(signatureKey)
  ) {
    return { status: "not-found" };
  }
  const response = await requestApiBinary(
    `/api/v1/consumer/documents/${encodeURIComponent(submissionId)}` +
      `/signatures/${encodeURIComponent(signatureKey)}`,
    { method: "GET", cookie },
  );
  if (response === null) return { status: "unavailable" };
  if (response.status < 200 || response.status >= 300) {
    return mapError(response.status);
  }
  return { status: "ok", data: response.body, setCookie: response.setCookie };
}

export async function fetchConsumerDocumentPractitionerSignature(
  submissionId: string,
  cookie: string | null,
): Promise<ConsumerApiResult<ArrayBuffer>> {
  if (!/^[0-9a-f-]{36}$/i.test(submissionId)) return { status: "not-found" };
  const response = await requestApiBinary(
    `/api/v1/consumer/documents/${encodeURIComponent(submissionId)}` +
      "/practitioner-signature",
    { method: "GET", cookie },
  );
  if (response === null) return { status: "unavailable" };
  if (response.status < 200 || response.status >= 300) {
    return mapError(response.status);
  }
  return { status: "ok", data: response.body, setCookie: response.setCookie };
}

export async function logoutConsumer(
  cookie: string | null,
  origin: string,
): Promise<ConsumerApiResult<null>> {
  const response = await requestApi("/api/v1/consumer/auth/logout", {
    method: "POST",
    cookie,
    origin,
  });
  if (response === null) return { status: "unavailable" };
  if (response.status === 401) return { status: "unauthorized" };
  if (response.status !== 204) return mapError(response.status);
  return { status: "ok", data: null, setCookie: response.setCookie };
}

export async function deleteConsumerAccount(
  cookie: string | null,
  origin: string,
): Promise<ConsumerApiResult<null>> {
  const response = await requestApi("/api/v1/consumer/account", {
    method: "DELETE",
    cookie,
    origin,
    body: JSON.stringify({ confirmation: "USUŃ KONTO" }),
  });
  if (response === null) return { status: "unavailable" };
  if (response.status !== 204) return mapError(response.status);
  return { status: "ok", data: null, setCookie: response.setCookie };
}

async function consumerJsonRequest<T>(
  path: string,
  options: RequestOptions,
): Promise<ConsumerApiResult<T>> {
  const response = await requestApi(path, options);
  if (response === null) return { status: "unavailable" };
  if (response.status < 200 || response.status >= 300) {
    return mapError(response.status);
  }
  try {
    return {
      status: "ok",
      data: JSON.parse(response.body) as T,
      setCookie: response.setCookie,
    };
  } catch {
    return { status: "unavailable" };
  }
}

function mapError(status: number): ConsumerApiResult<never> {
  if (status === 400 || status === 422) return { status: "invalid" };
  if (status === 401) return { status: "unauthorized" };
  if (status === 403) return { status: "forbidden" };
  if (status === 404) return { status: "not-found" };
  if (status === 409) return { status: "conflict" };
  if (status === 429) return { status: "rate-limited" };
  return { status: "unavailable" };
}

async function requestApi(
  path: string,
  options: RequestOptions,
): Promise<InternalResponse | null> {
  const url = resolveBeautyDocsInternalApiUrl(path);
  if (url === null) return null;
  const headers = new Headers({ accept: "application/json", host: APP_HOST });
  const cookie = filterBeautyDocsConsumerSessionCookie(options.cookie ?? null);
  if (cookie) headers.set("cookie", cookie);
  if (options.origin) headers.set("origin", options.origin);
  if (options.body !== undefined) headers.set("content-type", "application/json");
  if (options.originalUserAgent) {
    headers.set(
      "x-beautydocs-original-user-agent",
      options.originalUserAgent.slice(0, 512),
    );
  }
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
    return {
      status: response.status,
      body,
      setCookie: selectBeautyDocsConsumerSessionSetCookie(
        readSetCookieHeaders(response.headers),
        options.origin?.startsWith("https://") ?? false,
      ),
    };
  } catch {
    return null;
  }
}

async function requestApiBinary(
  path: string,
  options: RequestOptions,
): Promise<{ readonly status: number; readonly body: ArrayBuffer; readonly setCookie: string | null } | null> {
  const url = resolveBeautyDocsInternalApiUrl(path);
  if (url === null) return null;
  const headers = new Headers({ accept: "image/png", host: APP_HOST });
  const cookie = filterBeautyDocsConsumerSessionCookie(options.cookie ?? null);
  if (cookie) headers.set("cookie", cookie);
  try {
    const response = await fetch(url, {
      method: options.method,
      headers,
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const body = await response.arrayBuffer();
    if (body.byteLength > MAX_RESPONSE_CHARACTERS) return null;
    return {
      status: response.status,
      body,
      setCookie: selectBeautyDocsConsumerSessionSetCookie(
        readSetCookieHeaders(response.headers),
        false,
      ),
    };
  } catch {
    return null;
  }
}

interface ChatFileRequestOptions {
  readonly method: "POST";
  readonly cookie: string | null;
  readonly origin: string;
  readonly fileName: string;
  readonly contentType: string;
  readonly caption: string;
  readonly tenantSlug?: string;
  readonly body: ArrayBuffer;
}

async function requestConsumerChatFile(
  path: string,
  options: ChatFileRequestOptions,
): Promise<InternalResponse | null> {
  if (options.body.byteLength > MAX_CHAT_ATTACHMENT_BYTES) return null;
  const url = resolveBeautyDocsInternalApiUrl(path);
  if (url === null) return null;
  const headers = new Headers({
    accept: "application/json",
    host: APP_HOST,
    origin: options.origin,
    "content-type": options.contentType,
    "x-beautydocs-file-name": encodeURIComponent(options.fileName),
    "x-beautydocs-message-body": encodeURIComponent(options.caption),
  });
  if (options.tenantSlug) {
    headers.set("x-beautydocs-tenant-slug", options.tenantSlug);
  }
  const cookie = filterBeautyDocsConsumerSessionCookie(options.cookie);
  if (cookie) headers.set("cookie", cookie);
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
    return {
      status: response.status,
      body,
      setCookie: selectBeautyDocsConsumerSessionSetCookie(
        readSetCookieHeaders(response.headers),
        options.origin.startsWith("https://"),
      ),
    };
  } catch {
    return null;
  }
}

async function requestConsumerChatFileDownload(
  path: string,
  rawCookie: string | null,
): Promise<{
  readonly status: number;
  readonly body: ArrayBuffer;
  readonly contentType: string;
  readonly contentDisposition: string | null;
  readonly setCookie: string | null;
} | null> {
  const url = resolveBeautyDocsInternalApiUrl(path);
  if (url === null) return null;
  const headers = new Headers({ host: APP_HOST });
  const cookie = filterBeautyDocsConsumerSessionCookie(rawCookie);
  if (cookie) headers.set("cookie", cookie);
  try {
    const response = await fetch(url, {
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
      setCookie: selectBeautyDocsConsumerSessionSetCookie(
        readSetCookieHeaders(response.headers),
        false,
      ),
    };
  } catch {
    return null;
  }
}

function readSetCookieHeaders(headers: Headers): readonly string[] {
  const enhanced = headers as Headers & { getSetCookie?: () => string[] };
  const values = enhanced.getSetCookie?.();
  if (values && values.length > 0) return values;
  const combined = headers.get("set-cookie");
  return combined === null ? [] : [combined];
}
