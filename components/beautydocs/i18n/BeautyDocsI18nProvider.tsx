"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import {
  DEFAULT_LOCALE,
  LOCALE_INFO,
  type BeautyDocsLocale,
} from "../../../lib/i18n/config";
import { setActiveIntlLocale } from "../../../lib/i18n/active";
import {
  createTranslator,
  type BeautyDocsMessages,
  type Translate,
} from "../../../lib/i18n/translate";

export type LanguageAccount = "owner" | "consumer" | null;

interface I18nContextValue {
  readonly locale: BeautyDocsLocale;
  /** BCP 47 tag for Intl date/number formatting. */
  readonly intlLocale: string;
  readonly t: Translate;
  /** True while the page re-renders in a newly chosen language. */
  readonly switching: boolean;
  readonly setLocale: (next: BeautyDocsLocale, account?: LanguageAccount) => Promise<boolean>;
}

const identity: Translate = createTranslator({});

const I18nContext = createContext<I18nContextValue>({
  locale: DEFAULT_LOCALE,
  intlLocale: LOCALE_INFO[DEFAULT_LOCALE].intl,
  t: identity,
  switching: false,
  setLocale: async () => false,
});

export function BeautyDocsI18nProvider({
  locale,
  messages,
  children,
}: {
  readonly locale: BeautyDocsLocale;
  readonly messages: BeautyDocsMessages;
  readonly children: ReactNode;
}) {
  const router = useRouter();
  const [switching, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const t = useMemo(() => createTranslator(messages), [messages]);
  setActiveIntlLocale(LOCALE_INFO[locale].intl);

  const setLocale = useCallback(
    async (next: BeautyDocsLocale, account: LanguageAccount = null) => {
      setSaving(true);
      try {
        const response = await fetch("/api/beautydocs-preview/language", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ language: next, account }),
        });
        if (!response.ok) return false;
        document.documentElement.lang = LOCALE_INFO[next].htmlLang;
        // Server components re-render with the new cookie; client state is kept.
        startTransition(() => router.refresh());
        return true;
      } catch {
        return false;
      } finally {
        setSaving(false);
      }
    },
    [router],
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      intlLocale: LOCALE_INFO[locale].intl,
      t,
      switching: switching || saving,
      setLocale,
    }),
    [locale, t, switching, saving, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useBeautyDocsI18n(): I18nContextValue {
  return useContext(I18nContext);
}

/** Shorthand for components that only need to translate strings. */
export function useT(): Translate {
  return useContext(I18nContext).t;
}
