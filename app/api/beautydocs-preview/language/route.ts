import { NextRequest } from "next/server";
import { updateBeautyDocsUserLanguage } from "@/lib/beautydocs-admin-api";
import { updateConsumerLanguage } from "@/lib/beautydocs-consumer-api";
import {
  beautyDocsBffError,
  beautyDocsBffJson,
  getValidatedBrowserOrigin,
  readSmallJsonBody,
} from "@/lib/beautydocs-bff-route";
import {
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  isBeautyDocsLocale,
  type BeautyDocsLocale,
} from "@/lib/i18n/config";

export const runtime = "nodejs";

/**
 * Save the interface language. The cookie drives rendering on this device;
 * `account` also stores it on the signed-in account so it follows the person
 * to other devices. Anonymous visitors (public forms) only get the cookie.
 */
export async function PUT(request: NextRequest) {
  const origin = getValidatedBrowserOrigin(request);
  if (origin === null) return beautyDocsBffError("forbidden", 403);

  let language: BeautyDocsLocale;
  let account: "owner" | "consumer" | null;
  try {
    const raw = (await readSmallJsonBody(request)) as Record<string, unknown>;
    if (
      !raw ||
      typeof raw !== "object" ||
      Object.keys(raw).some((key) => key !== "language" && key !== "account") ||
      !isBeautyDocsLocale(raw.language) ||
      (raw.account !== undefined && raw.account !== null && raw.account !== "owner" && raw.account !== "consumer")
    ) {
      throw new Error("invalid language");
    }
    language = raw.language;
    account = (raw.account as "owner" | "consumer" | null | undefined) ?? null;
  } catch {
    return beautyDocsBffError("invalid_request", 400);
  }

  let savedToAccount = false;
  if (account !== null) {
    const cookie = request.headers.get("cookie");
    const result =
      account === "owner"
        ? await updateBeautyDocsUserLanguage(language, cookie, origin)
        : await updateConsumerLanguage(language, cookie, origin);
    if (result.status === "unauthorized") return beautyDocsBffError("authentication_required", 401);
    savedToAccount = result.status === "ok";
  }

  const response = beautyDocsBffJson({ language, savedToAccount });
  response.cookies.set(LOCALE_COOKIE, language, {
    httpOnly: false,
    maxAge: LOCALE_COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
