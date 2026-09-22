import type { BeautyDocsHostResolution } from "../types/tenant";

export const BEAUTYDOCS_ROOT_DOMAIN = "beautydocs.pl";

/**
 * These labels identify platform surfaces and can never be registered as a
 * salon slug.
 */
export const RESERVED_BEAUTYDOCS_SUBDOMAINS = [
  "www",
  "app",
  "forms",
  "admin",
  "api",
  "assets",
  "static",
  "support",
  "mail",
  "status",
] as const;

type ReservedSubdomain = (typeof RESERVED_BEAUTYDOCS_SUBDOMAINS)[number];

const DNS_LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const LOCAL_IP_HOSTS = new Set(["127.0.0.1", "::1"]);

/**
 * Resolve a Host header into a BeautyDocs routing surface.
 *
 * Only shared platform surfaces are recognized. Salon identity lives in a URL
 * path and is never derived from a per-salon subdomain or used as authorization.
 */
export function parseBeautyDocsHost(
  hostHeader: string | null | undefined,
): BeautyDocsHostResolution {
  if (hostHeader == null || hostHeader.trim() === "") {
    return unknownHost(null, "missing-host");
  }

  const hostname = normalizeHostname(hostHeader);

  if (hostname === null) {
    return unknownHost(null, "invalid-host");
  }

  if (hostname === "localhost" || LOCAL_IP_HOSTS.has(hostname)) {
    return {
      surface: "local-development",
      hostname,
      subdomain: null,
      isLocalDevelopment: true,
    };
  }

  if (hostname.endsWith(".localhost")) {
    const subdomain = hostname.slice(0, -".localhost".length);
    return classifySubdomain(subdomain, hostname, true);
  }

  if (hostname === BEAUTYDOCS_ROOT_DOMAIN) {
    return {
      surface: "marketing",
      hostname,
      subdomain: null,
      isLocalDevelopment: false,
    };
  }

  const productionSuffix = `.${BEAUTYDOCS_ROOT_DOMAIN}`;

  if (!hostname.endsWith(productionSuffix)) {
    return unknownHost(hostname, "external-domain");
  }

  const subdomain = hostname.slice(0, -productionSuffix.length);
  return classifySubdomain(subdomain, hostname, false);
}

export function isValidTenantSlug(slug: string): boolean {
  const normalizedSlug = slug.trim().toLowerCase();

  return (
    normalizedSlug === slug &&
    DNS_LABEL_PATTERN.test(slug) &&
    !isReservedSubdomain(slug)
  );
}

export function isReservedBeautyDocsSubdomain(
  subdomain: string,
): boolean {
  return isReservedSubdomain(subdomain.toLowerCase());
}

function classifySubdomain(
  subdomain: string,
  hostname: string,
  isLocalDevelopment: boolean,
): BeautyDocsHostResolution {
  if (subdomain.includes(".")) {
    return unknownHost(hostname, "nested-subdomain", isLocalDevelopment);
  }

  if (!DNS_LABEL_PATTERN.test(subdomain)) {
    return unknownHost(hostname, "invalid-subdomain", isLocalDevelopment);
  }

  switch (subdomain) {
    case "www":
      return {
        surface: "marketing",
        hostname,
        subdomain,
        isLocalDevelopment,
      };
    case "app":
      return {
        surface: "salon-app",
        hostname,
        subdomain,
        isLocalDevelopment,
      };
    case "forms":
      return {
        surface: "public-forms",
        hostname,
        subdomain,
        isLocalDevelopment,
      };
    case "admin":
      return {
        surface: "platform-admin",
        hostname,
        subdomain,
        isLocalDevelopment,
      };
    case "api":
      return {
        surface: "api",
        hostname,
        subdomain,
        isLocalDevelopment,
      };
    default:
      if (isReservedSubdomain(subdomain)) {
        return unknownHost(hostname, "reserved-subdomain", isLocalDevelopment);
      }

      return unknownHost(
        hostname,
        "unsupported-subdomain",
        isLocalDevelopment,
      );
  }
}

function isReservedSubdomain(value: string): value is ReservedSubdomain {
  return (RESERVED_BEAUTYDOCS_SUBDOMAINS as readonly string[]).includes(value);
}

function normalizeHostname(hostHeader: string): string | null {
  const value = hostHeader.trim().toLowerCase();

  // Host is a single authority, not a URL or a forwarded-host list.
  if (
    value === "" ||
    /[\s,/@\\]/.test(value) ||
    value.includes("?") ||
    value.includes("#")
  ) {
    return null;
  }

  if (value === "::1") {
    return value;
  }

  if (value.startsWith("[")) {
    const closingBracket = value.indexOf("]");
    if (closingBracket === -1) {
      return null;
    }

    const hostname = value.slice(1, closingBracket);
    const port = value.slice(closingBracket + 1);

    if (hostname !== "::1" || !isValidOptionalPort(port)) {
      return null;
    }

    return hostname;
  }

  const colonIndex = value.lastIndexOf(":");
  let hostname = value;

  if (colonIndex !== -1) {
    if (value.indexOf(":") !== colonIndex) {
      return null;
    }

    const port = value.slice(colonIndex + 1);
    if (!isValidPort(port)) {
      return null;
    }

    hostname = value.slice(0, colonIndex);
  }

  if (hostname.endsWith(".")) {
    hostname = hostname.slice(0, -1);
  }

  if (
    hostname === "" ||
    hostname.length > 253 ||
    !/^[a-z0-9.-]+$/.test(hostname) ||
    hostname.includes("..")
  ) {
    return null;
  }

  return hostname;
}

function isValidOptionalPort(value: string): boolean {
  return value === "" || (value.startsWith(":") && isValidPort(value.slice(1)));
}

function isValidPort(value: string): boolean {
  if (!/^\d{1,5}$/.test(value)) {
    return false;
  }

  const port = Number(value);
  return port >= 1 && port <= 65_535;
}

function unknownHost(
  hostname: string | null,
  reason:
    | "missing-host"
    | "invalid-host"
    | "external-domain"
    | "nested-subdomain"
    | "invalid-subdomain"
    | "reserved-subdomain"
    | "unsupported-subdomain",
  isLocalDevelopment = false,
): BeautyDocsHostResolution {
  return {
    surface: "unknown",
    hostname,
    subdomain: null,
    isLocalDevelopment,
    reason,
  };
}
