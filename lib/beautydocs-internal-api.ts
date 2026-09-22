import "server-only";

const LOCAL_API_URL = "http://localhost:8080";

/** Resolve an internal FastAPI URL without exposing it to the client bundle. */
export function resolveBeautyDocsInternalApiUrl(path: string): URL | null {
  const configuredUrl = process.env.BEAUTYDOCS_API_INTERNAL_URL?.trim();
  let baseUrl: URL;

  if (!configuredUrl) {
    if (process.env.NODE_ENV !== "development") {
      return null;
    }
    baseUrl = new URL(LOCAL_API_URL);
  } else {
    try {
      baseUrl = new URL(configuredUrl);
    } catch {
      return null;
    }
  }

  if (
    (baseUrl.protocol !== "http:" && baseUrl.protocol !== "https:") ||
    baseUrl.username !== "" ||
    baseUrl.password !== "" ||
    baseUrl.search !== "" ||
    baseUrl.hash !== ""
  ) {
    return null;
  }

  return new URL(path, baseUrl);
}
