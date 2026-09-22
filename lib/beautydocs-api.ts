import "server-only";

import {
  parsePlatformStatsResponse,
  parsePublicFormSubmissionResponse,
  parsePublicFormVerificationConfirmResponse,
  parsePublicFormVerificationStartResponse,
  parsePublicTenantFormResponse,
  parseTenantPublicConfigResponse,
  platformStatsEndpointPath,
  publicTenantConfigEndpointPath,
  publicTenantFormEndpointPath,
  publicTenantFormClientSignatureEndpointPath,
  publicTenantFormClientVerificationEndpointPath,
  publicTenantFormSubmissionClientVerificationConfirmEndpointPath,
  publicTenantFormSubmissionClientVerificationEndpointPath,
  publicTenantFormSubmissionEndpointPath,
  type PlatformStatsLoadResult,
  type PublicFormContentLoadResult,
  type PublicFormSubmitOutcome,
  type PublicFormVerificationConfirmOutcome,
  type PublicFormVerificationStartOutcome,
  type TenantPublicConfigLoadResult,
} from "./beautydocs-api-contract";
import { resolveBeautyDocsInternalApiUrl } from "./beautydocs-internal-api";
import { isValidFormSlug } from "./beautydocs-form-path";
import { isValidTenantSlug } from "./tenant-host";

const MAX_RESPONSE_CHARACTERS = 128 * 1_024;
const REQUEST_TIMEOUT_MS = 5_000;

/** Server-only public tenant lookup used by the opt-in BeautyDocs frontend. */
export async function fetchPublicTenantConfig(
  tenantSlug: string,
): Promise<TenantPublicConfigLoadResult> {
  if (!isValidTenantSlug(tenantSlug)) {
    return { status: "not-found" };
  }

  const endpointUrl = resolveBeautyDocsInternalApiUrl(
    publicTenantConfigEndpointPath(tenantSlug),
  );
  if (endpointUrl === null) {
    return { status: "unavailable", reason: "configuration" };
  }

  try {
    const response = await fetch(endpointUrl, {
      method: "GET",
      headers: {
        accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    const declaredLength = Number(response.headers.get("content-length"));
    if (
      Number.isFinite(declaredLength) &&
      declaredLength > MAX_RESPONSE_CHARACTERS
    ) {
      return { status: "unavailable", reason: "invalid-response" };
    }

    const responseBody = await response.text();
    if (responseBody.length > MAX_RESPONSE_CHARACTERS) {
      return { status: "unavailable", reason: "invalid-response" };
    }

    const result = parseTenantPublicConfigResponse(response.status, responseBody);
    if (result.status === "ok" && result.config.slug !== tenantSlug) {
      return { status: "unavailable", reason: "invalid-response" };
    }

    return result;
  } catch {
    return { status: "unavailable", reason: "network" };
  }
}

/** Server-only fetch of aggregate marketing counters for the public home page. */
export async function fetchPlatformStats(): Promise<PlatformStatsLoadResult> {
  const endpointUrl = resolveBeautyDocsInternalApiUrl(platformStatsEndpointPath());
  if (endpointUrl === null) {
    return { status: "unavailable" };
  }

  try {
    const response = await fetch(endpointUrl, {
      method: "GET",
      headers: { accept: "application/json" },
      // Cache briefly: these are slow-moving totals, not per-request data.
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    const responseBody = await response.text();
    if (responseBody.length > MAX_RESPONSE_CHARACTERS) {
      return { status: "unavailable" };
    }

    return parsePlatformStatsResponse(response.status, responseBody);
  } catch {
    return { status: "unavailable" };
  }
}

/** Server-only submission of a filled + signed public form. Body is a validated JSON string. */
export async function submitPublicTenantForm(
  tenantSlug: string,
  formCode: string,
  bodyJson: string,
  browserOrigin: string,
): Promise<PublicFormSubmitOutcome> {
  if (!isValidTenantSlug(tenantSlug) || !isValidFormSlug(formCode)) {
    return { status: "not-found" };
  }

  const endpointUrl = resolveBeautyDocsInternalApiUrl(
    publicTenantFormSubmissionEndpointPath(tenantSlug, formCode),
  );
  if (endpointUrl === null) {
    return { status: "unavailable" };
  }

  try {
    const response = await fetch(endpointUrl, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        origin: browserOrigin,
      },
      body: bodyJson,
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

    const responseBody = await response.text();
    if (responseBody.length > MAX_RESPONSE_CHARACTERS) {
      return { status: "unavailable" };
    }
    return parsePublicFormSubmissionResponse(response.status, responseBody);
  } catch {
    return { status: "unavailable" };
  }
}

export async function startPublicTenantFormClientVerification(
  tenantSlug: string,
  formCode: string,
  bodyJson: string,
  browserOrigin: string,
  browserUserAgent: string | null,
): Promise<PublicFormVerificationStartOutcome> {
  return requestPublicFormVerificationStart(
    publicTenantFormClientVerificationEndpointPath(tenantSlug, formCode),
    bodyJson,
    browserOrigin,
    browserUserAgent,
  );
}

export async function resendPublicTenantFormClientVerification(
  tenantSlug: string,
  formCode: string,
  submissionId: string,
  bodyJson: string,
  browserOrigin: string,
  browserUserAgent: string | null,
): Promise<PublicFormVerificationStartOutcome> {
  return requestPublicFormVerificationStart(
    publicTenantFormSubmissionClientVerificationEndpointPath(
      tenantSlug,
      formCode,
      submissionId,
    ),
    bodyJson,
    browserOrigin,
    browserUserAgent,
  );
}

export async function confirmPublicTenantFormClientVerification(
  tenantSlug: string,
  formCode: string,
  submissionId: string,
  bodyJson: string,
  browserOrigin: string,
  browserUserAgent: string | null,
): Promise<PublicFormVerificationConfirmOutcome> {
  const endpointUrl = resolveBeautyDocsInternalApiUrl(
    publicTenantFormSubmissionClientVerificationConfirmEndpointPath(
      tenantSlug,
      formCode,
      submissionId,
    ),
  );
  if (endpointUrl === null) return { status: "unavailable" };
  try {
    const response = await fetch(endpointUrl, {
      method: "POST",
      headers: publicSigningHeaders(browserOrigin, browserUserAgent),
      body: bodyJson,
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    const responseBody = await response.text();
    if (responseBody.length > MAX_RESPONSE_CHARACTERS) {
      return { status: "unavailable" };
    }
    return parsePublicFormVerificationConfirmResponse(
      response.status,
      responseBody,
    );
  } catch {
    return { status: "unavailable" };
  }
}

export async function finalizePublicTenantFormClientSignature(
  tenantSlug: string,
  formCode: string,
  submissionId: string,
  bodyJson: string,
  browserOrigin: string,
  browserUserAgent: string | null,
): Promise<PublicFormSubmitOutcome> {
  const endpointUrl = resolveBeautyDocsInternalApiUrl(
    publicTenantFormClientSignatureEndpointPath(
      tenantSlug,
      formCode,
      submissionId,
    ),
  );
  if (endpointUrl === null) return { status: "unavailable" };
  try {
    const response = await fetch(endpointUrl, {
      method: "POST",
      headers: publicSigningHeaders(browserOrigin, browserUserAgent),
      body: bodyJson,
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    const responseBody = await response.text();
    if (responseBody.length > MAX_RESPONSE_CHARACTERS) {
      return { status: "unavailable" };
    }
    return parsePublicFormSubmissionResponse(response.status, responseBody);
  } catch {
    return { status: "unavailable" };
  }
}

async function requestPublicFormVerificationStart(
  path: string,
  bodyJson: string,
  browserOrigin: string,
  browserUserAgent: string | null,
): Promise<PublicFormVerificationStartOutcome> {
  const endpointUrl = resolveBeautyDocsInternalApiUrl(path);
  if (endpointUrl === null) return { status: "unavailable" };
  try {
    const response = await fetch(endpointUrl, {
      method: "POST",
      headers: publicSigningHeaders(browserOrigin, browserUserAgent),
      body: bodyJson,
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    const responseBody = await response.text();
    if (responseBody.length > MAX_RESPONSE_CHARACTERS) {
      return { status: "unavailable" };
    }
    return parsePublicFormVerificationStartResponse(
      response.status,
      responseBody,
    );
  } catch {
    return { status: "unavailable" };
  }
}

function publicSigningHeaders(
  browserOrigin: string,
  browserUserAgent: string | null,
): Headers {
  const headers = new Headers({
    accept: "application/json",
    "content-type": "application/json",
    origin: browserOrigin,
  });
  if (browserUserAgent) {
    headers.set(
      "x-beautydocs-original-user-agent",
      browserUserAgent.slice(0, 512),
    );
  }
  return headers;
}

/** Server-only fetch of one enabled salon form's published content. */
export async function fetchPublicTenantForm(
  tenantSlug: string,
  formCode: string,
): Promise<PublicFormContentLoadResult> {
  if (!isValidTenantSlug(tenantSlug) || !isValidFormSlug(formCode)) {
    return { status: "not-found" };
  }

  const endpointUrl = resolveBeautyDocsInternalApiUrl(
    publicTenantFormEndpointPath(tenantSlug, formCode),
  );
  if (endpointUrl === null) {
    return { status: "unavailable", reason: "configuration" };
  }

  try {
    const response = await fetch(endpointUrl, {
      method: "GET",
      headers: { accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    const declaredLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_CHARACTERS) {
      return { status: "unavailable", reason: "invalid-response" };
    }

    const responseBody = await response.text();
    if (responseBody.length > MAX_RESPONSE_CHARACTERS) {
      return { status: "unavailable", reason: "invalid-response" };
    }

    const result = parsePublicTenantFormResponse(response.status, responseBody);
    if (result.status === "ok" && result.content.code !== formCode) {
      return { status: "unavailable", reason: "invalid-response" };
    }

    return result;
  } catch {
    return { status: "unavailable", reason: "network" };
  }
}
