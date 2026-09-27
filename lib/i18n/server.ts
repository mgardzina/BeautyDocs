import "server-only";

import { cookies, headers } from "next/headers";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  isBeautyDocsLocale,
  negotiateLocale,
  type BeautyDocsLocale,
} from "./config";
import { createTranslator, messagesFor, type Translate } from "./translate";

/** Saved choice first, then the browser's languages, then Polish. */
export async function getRequestLocale(): Promise<BeautyDocsLocale> {
  const saved = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isBeautyDocsLocale(saved)) return saved;
  try {
    return negotiateLocale((await headers()).get("accept-language"));
  } catch {
    return DEFAULT_LOCALE;
  }
}

export async function getServerTranslator(): Promise<{ locale: BeautyDocsLocale; t: Translate }> {
  const locale = await getRequestLocale();
  return { locale, t: createTranslator(messagesFor(locale)) };
}
