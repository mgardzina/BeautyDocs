/**
 * Interface languages. Must match `InterfaceLanguage` in
 * apps/api/app/services/form_i18n.py and the account preference endpoints.
 */
export const BEAUTYDOCS_LOCALES = ["pl", "en", "de", "es", "fr"] as const;
export type BeautyDocsLocale = (typeof BEAUTYDOCS_LOCALES)[number];

export const DEFAULT_LOCALE: BeautyDocsLocale = "pl";
export const LOCALE_COOKIE = "beautydocs_lang";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export interface BeautyDocsLocaleInfo {
  readonly code: BeautyDocsLocale;
  /** The language's own name — people look for their language written in it. */
  readonly nativeName: string;
  readonly htmlLang: string;
  readonly intl: string;
}

export const LOCALE_INFO: Readonly<Record<BeautyDocsLocale, BeautyDocsLocaleInfo>> = {
  pl: { code: "pl", nativeName: "Polski", htmlLang: "pl", intl: "pl-PL" },
  en: { code: "en", nativeName: "English", htmlLang: "en", intl: "en-GB" },
  de: { code: "de", nativeName: "Deutsch", htmlLang: "de", intl: "de-DE" },
  es: { code: "es", nativeName: "Español", htmlLang: "es", intl: "es-ES" },
  fr: { code: "fr", nativeName: "Français", htmlLang: "fr", intl: "fr-FR" },
};

export function isBeautyDocsLocale(value: unknown): value is BeautyDocsLocale {
  return typeof value === "string" && (BEAUTYDOCS_LOCALES as readonly string[]).includes(value);
}

/** Pick the best supported language from an Accept-Language header. */
export function negotiateLocale(acceptLanguage: string | null | undefined): BeautyDocsLocale {
  if (!acceptLanguage) return DEFAULT_LOCALE;
  const ranked = acceptLanguage
    .split(",")
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.find((param) => param.trim().startsWith("q="));
      const weight = q ? Number(q.trim().slice(2)) : 1;
      return { base: tag.trim().toLowerCase().split("-")[0], weight: Number.isFinite(weight) ? weight : 0, index };
    })
    .filter((entry) => entry.base && entry.weight > 0)
    .sort((a, b) => b.weight - a.weight || a.index - b.index);
  return ranked.find((entry) => isBeautyDocsLocale(entry.base))?.base as BeautyDocsLocale | undefined ?? DEFAULT_LOCALE;
}
