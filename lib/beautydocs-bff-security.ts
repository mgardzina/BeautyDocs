export const BEAUTYDOCS_SESSION_COOKIE_NAME = "beautydocs_session";
export const BEAUTYDOCS_CONSUMER_SESSION_COOKIE_NAME =
  "beautydocs_consumer_session";
const SESSION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

interface SameOriginRequestHeaders {
  readonly origin: string | null;
  readonly host: string | null;
  readonly requestProtocol: string;
  /** Present in tests/infrastructure, but ignored until trusted proxies exist. */
  readonly forwardedHost?: string | null;
  readonly forwardedProto?: string | null;
}

/**
 * Validate a browser mutation before its Origin is forwarded to FastAPI.
 * Returns the normalized origin only when it matches the public BFF authority.
 */
export function validatedSameOrigin(
  headers: SameOriginRequestHeaders,
): string | null {
  if (!headers.origin || !headers.host) {
    return null;
  }

  // Forwarded headers are intentionally ignored until a trusted proxy boundary
  // is explicitly configured for the Next.js application.
  const authority = headers.host;
  const rawProtocol = headers.requestProtocol;
  const protocol = rawProtocol.endsWith(":") ? rawProtocol : `${rawProtocol}:`;
  if (
    authority.includes(",") ||
    /[\s/@\\]/.test(authority) ||
    protocol.includes(",") ||
    (protocol !== "http:" && protocol !== "https:")
  ) {
    return null;
  }

  try {
    const expectedOrigin = new URL(`${protocol}//${authority}`).origin;
    const suppliedOrigin = new URL(headers.origin);

    if (
      suppliedOrigin.origin !== headers.origin ||
      suppliedOrigin.username !== "" ||
      suppliedOrigin.password !== "" ||
      suppliedOrigin.origin !== expectedOrigin
    ) {
      return null;
    }

    if (
      suppliedOrigin.protocol === "http:" &&
      suppliedOrigin.hostname !== "localhost" &&
      suppliedOrigin.hostname !== "127.0.0.1" &&
      suppliedOrigin.hostname !== "[::1]"
    ) {
      return null;
    }

    return suppliedOrigin.origin;
  } catch {
    return null;
  }
}

/** Forward only the BeautyDocs session cookie, never unrelated legacy cookies. */
export function filterBeautyDocsSessionCookie(
  rawCookieHeader: string | null,
): string | null {
  if (!rawCookieHeader || /[\r\n]/.test(rawCookieHeader)) {
    return null;
  }

  const sessionValues: string[] = [];

  for (const part of rawCookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) {
      continue;
    }

    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (name === BEAUTYDOCS_SESSION_COOKIE_NAME) {
      sessionValues.push(value);
    }
  }

  if (
    sessionValues.length !== 1 ||
    !SESSION_TOKEN_PATTERN.test(sessionValues[0] ?? "")
  ) {
    return null;
  }

  return `${BEAUTYDOCS_SESSION_COOKIE_NAME}=${sessionValues[0]}`;
}

/** Forward only the passwordless consumer session cookie. */
export function filterBeautyDocsConsumerSessionCookie(
  rawCookieHeader: string | null,
): string | null {
  if (!rawCookieHeader || /[\r\n]/.test(rawCookieHeader)) return null;
  const values: string[] = [];
  for (const part of rawCookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (name === BEAUTYDOCS_CONSUMER_SESSION_COOKIE_NAME) values.push(value);
  }
  if (values.length !== 1 || !SESSION_TOKEN_PATTERN.test(values[0] ?? "")) {
    return null;
  }
  return `${BEAUTYDOCS_CONSUMER_SESSION_COOKIE_NAME}=${values[0]}`;
}

/**
 * Select a safe host-only session Set-Cookie value from FastAPI.
 * Domain cookies and cookies missing the required browser protections fail closed.
 */
export function selectBeautyDocsSessionSetCookie(
  setCookieHeaders: readonly string[],
  requireSecure: boolean,
): string | null {
  for (const header of setCookieHeaders) {
    if (/\r|\n/.test(header)) {
      continue;
    }

    const attributes = header.split(";").map((part) => part.trim());
    const nameValue = attributes[0] ?? "";
    const separator = nameValue.indexOf("=");
    if (
      separator === -1 ||
      nameValue.slice(0, separator) !== BEAUTYDOCS_SESSION_COOKIE_NAME
    ) {
      continue;
    }

    const lowerAttributes = attributes.slice(1).map((part) => part.toLowerCase());
    const cookieValue = nameValue.slice(separator + 1);
    const isHostOnly = !lowerAttributes.some((part) => part.startsWith("domain="));
    const isHttpOnly = lowerAttributes.includes("httponly");
    const isSameSiteLax = lowerAttributes.includes("samesite=lax");
    const hasRootPath = lowerAttributes.includes("path=/");
    const isSecure = lowerAttributes.includes("secure");
    const hasValidValue =
      SESSION_TOKEN_PATTERN.test(cookieValue) ||
      (cookieValue === "" && lowerAttributes.includes("max-age=0"));

    if (
      isHostOnly &&
      isHttpOnly &&
      isSameSiteLax &&
      hasRootPath &&
      hasValidValue &&
      (!requireSecure || isSecure)
    ) {
      return header;
    }
  }

  return null;
}

export function selectBeautyDocsConsumerSessionSetCookie(
  setCookieHeaders: readonly string[],
  requireSecure: boolean,
): string | null {
  for (const header of setCookieHeaders) {
    if (/\r|\n/.test(header)) continue;
    const attributes = header.split(";").map((part) => part.trim());
    const nameValue = attributes[0] ?? "";
    const separator = nameValue.indexOf("=");
    if (
      separator === -1 ||
      nameValue.slice(0, separator) !== BEAUTYDOCS_CONSUMER_SESSION_COOKIE_NAME
    ) {
      continue;
    }
    const lowerAttributes = attributes.slice(1).map((part) => part.toLowerCase());
    const cookieValue = nameValue.slice(separator + 1);
    const safe =
      !lowerAttributes.some((part) => part.startsWith("domain=")) &&
      lowerAttributes.includes("httponly") &&
      lowerAttributes.includes("samesite=lax") &&
      lowerAttributes.includes("path=/") &&
      (SESSION_TOKEN_PATTERN.test(cookieValue) ||
        (cookieValue === "" && lowerAttributes.includes("max-age=0"))) &&
      (!requireSecure || lowerAttributes.includes("secure"));
    if (safe) return header;
  }
  return null;
}
