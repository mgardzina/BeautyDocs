import { DEFAULT_LOCALE, LOCALE_INFO } from "./config";

/**
 * Intl locale for date/number formatting in plain helper functions that cannot
 * use hooks. BeautyDocsI18nProvider sets it on every render.
 */
let activeIntl: string = LOCALE_INFO[DEFAULT_LOCALE].intl;

export function setActiveIntlLocale(value: string): void {
  activeIntl = value;
}

export function activeIntlLocale(): string {
  return activeIntl;
}
