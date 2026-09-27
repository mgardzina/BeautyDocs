import type { BeautyDocsLocale } from "./config";
import de from "./messages/de.json";
import en from "./messages/en.json";
import es from "./messages/es.json";
import fr from "./messages/fr.json";

/**
 * Gettext-style catalogs: the Polish UI string is the key. A missing entry
 * renders the Polish original, so an untranslated string is never blank.
 */
export type BeautyDocsMessages = Readonly<Record<string, string>>;
export type TranslationValues = Readonly<Record<string, string | number>>;
export interface Translate {
  (source: string, values?: TranslationValues): string;
  /** Nullable text (optional labels, server errors) passes null/undefined through. */
  <S extends string | null | undefined>(source: S, values?: TranslationValues): S extends string ? string : S | string;
}

const CATALOGS: Readonly<Record<BeautyDocsLocale, BeautyDocsMessages>> = {
  pl: {},
  en,
  de,
  es,
  fr,
};

export function messagesFor(locale: BeautyDocsLocale): BeautyDocsMessages {
  return CATALOGS[locale];
}

export function interpolate(template: string, values?: TranslationValues): string {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.hasOwn(values, name) ? String(values[name]) : match,
  );
}

export function createTranslator(messages: BeautyDocsMessages): Translate {
  return ((source: string | null | undefined, values?: TranslationValues) =>
    typeof source === "string" ? interpolate(messages[source] ?? source, values) : source) as Translate;
}
