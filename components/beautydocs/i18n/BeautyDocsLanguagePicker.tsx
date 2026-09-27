"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, ChevronDown, Globe2, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  BEAUTYDOCS_LOCALES,
  LOCALE_INFO,
  type BeautyDocsLocale,
} from "../../../lib/i18n/config";
import { useBeautyDocsI18n, type LanguageAccount } from "./BeautyDocsI18nProvider";

/** Language names in Polish — the source keys the catalogs translate. */
const LANGUAGE_NAME_SOURCE: Readonly<Record<BeautyDocsLocale, string>> = {
  pl: "Polski",
  en: "Angielski",
  de: "Niemiecki",
  es: "Hiszpański",
  fr: "Francuski",
};

// Critically damped — the checkmark settles without overshoot (no momentum preceded it).
const SETTLE = { type: "spring", bounce: 0, duration: 0.3 } as const;

function useLanguageChoice(account: LanguageAccount) {
  const { locale, setLocale, switching } = useBeautyDocsI18n();
  // Optimistic: the checkmark moves on press, before the page re-renders. The
  // choice only applies while the rendered language is still the one it left.
  const [pending, setPending] = useState<{ from: BeautyDocsLocale; to: BeautyDocsLocale } | null>(null);
  const [failed, setFailed] = useState(false);
  const inFlight = pending !== null && pending.from === locale;
  const selected = inFlight ? pending.to : locale;

  const choose = async (next: BeautyDocsLocale) => {
    if (next === selected) return;
    setFailed(false);
    setPending({ from: locale, to: next });
    const ok = await setLocale(next, account);
    if (!ok) {
      setPending(null);
      setFailed(true);
    }
  };

  return { selected, choose, failed, busy: switching || inFlight };
}

/**
 * Settings-style grouped list. Each language is written in itself (so people
 * can find their own) with its name in the current interface language below.
 */
export function BeautyDocsLanguageList({
  account,
  className = "",
}: {
  readonly account: LanguageAccount;
  readonly className?: string;
}) {
  const { t, locale } = useBeautyDocsI18n();
  const reduceMotion = useReducedMotion();
  const { selected, choose, failed, busy } = useLanguageChoice(account);

  return (
    <div className={className}>
      <div
        aria-label={t("Język aplikacji")}
        className="overflow-hidden rounded-[22px] border border-[#e3e8dd] bg-white shadow-[0_1px_2px_rgba(23,61,53,0.04)]"
        role="radiogroup"
      >
        {BEAUTYDOCS_LOCALES.map((code, index) => {
          const isSelected = code === selected;
          return (
            <button
              aria-checked={isSelected}
              className="group relative flex min-h-[3.5rem] w-full items-center gap-4 px-5 py-3 text-left outline-none transition-colors duration-100 ease-out focus-visible:bg-[#f2f5ee] active:bg-[#eef2ea] disabled:cursor-default"
              disabled={busy && !isSelected}
              key={code}
              lang={LOCALE_INFO[code].htmlLang}
              onClick={() => void choose(code)}
              role="radio"
              type="button"
            >
              {index > 0 ? (
                <span aria-hidden className="absolute inset-x-0 top-0 ml-5 h-px bg-[#edf0e8]" />
              ) : null}
              <span className="min-w-0 flex-1">
                <span className="block text-[0.9375rem] font-semibold leading-5 tracking-[-0.01em] text-[#173d35]">
                  {LOCALE_INFO[code].nativeName}
                </span>
                <span className="mt-0.5 block text-[0.8125rem] leading-4 text-stone-500" lang={LOCALE_INFO[locale].htmlLang}>
                  {t(LANGUAGE_NAME_SOURCE[code])}
                </span>
              </span>
              <span aria-hidden className="grid size-6 place-items-center">
                <AnimatePresence initial={false}>
                  {isSelected ? (
                    busy ? (
                      <motion.span
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        initial={{ opacity: 0 }}
                        key="busy"
                        transition={{ duration: 0.15 }}
                      >
                        <Loader2 className="size-[1.125rem] animate-spin text-[#245c4d] motion-reduce:animate-none" />
                      </motion.span>
                    ) : (
                      <motion.span
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: reduceMotion ? 1 : 0.6 }}
                        initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.6 }}
                        key="check"
                        transition={reduceMotion ? { duration: 0.15 } : SETTLE}
                      >
                        <Check className="size-5 text-[#245c4d]" strokeWidth={2.75} />
                      </motion.span>
                    )
                  ) : null}
                </AnimatePresence>
              </span>
            </button>
          );
        })}
      </div>
      <p aria-live="polite" className="mt-3 px-5 text-xs leading-5 text-stone-500">
        {failed
          ? t("Nie udało się zmienić języka. Spróbuj ponownie.")
          : t(
              "Menu, formularze, wywiad medyczny i zgody wyświetlą się w wybranym języku. Podpisany dokument zapisuje język, w którym został przeczytany.",
            )}
      </p>
    </div>
  );
}

/**
 * Compact switcher for headers (public forms, client portal). The menu grows
 * out of its trigger and goes back into it.
 */
export function BeautyDocsLanguageMenu({
  account,
  tone = "light",
}: {
  readonly account: LanguageAccount;
  readonly tone?: "light" | "dark";
}) {
  const { t } = useBeautyDocsI18n();
  const reduceMotion = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const { selected, choose, busy } = useLanguageChoice(account);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative inline-block" ref={rootRef}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t("Zmień język")}
        className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[0.8125rem] font-semibold tracking-[0.01em] outline-none transition-[background-color,transform] duration-100 ease-out active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-[#245c4d]/40 motion-reduce:active:scale-100 ${
          tone === "dark"
            ? "bg-white/10 text-white hover:bg-white/15"
            : "border border-[#e3e8dd] bg-white text-[#173d35] hover:bg-[#f7f8f4]"
        }`}
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        {busy ? (
          <Loader2 aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />
        ) : (
          <Globe2 aria-hidden className="size-4" />
        )}
        {selected.toUpperCase()}
        <ChevronDown
          aria-hidden
          className={`size-3.5 opacity-60 transition-transform duration-200 motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
        />
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="absolute right-0 top-full z-50 mt-2 w-52 origin-top-right rounded-2xl border border-white/70 bg-white/90 p-1.5 shadow-[0_18px_50px_rgba(23,61,53,0.18)] backdrop-blur-xl backdrop-saturate-150 [@media(prefers-reduced-transparency:reduce)]:bg-white [@media(prefers-reduced-transparency:reduce)]:backdrop-blur-none"
            exit={{ opacity: 0, scale: reduceMotion ? 1 : 0.95, y: reduceMotion ? 0 : -4 }}
            initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.95, y: reduceMotion ? 0 : -4 }}
            role="menu"
            transition={reduceMotion ? { duration: 0.12 } : SETTLE}
          >
            {BEAUTYDOCS_LOCALES.map((code) => {
              const isSelected = code === selected;
              return (
                <button
                  aria-checked={isSelected}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left outline-none transition-colors duration-100 hover:bg-[#245c4d]/[0.06] focus-visible:bg-[#245c4d]/[0.08] active:bg-[#245c4d]/[0.12]"
                  key={code}
                  lang={LOCALE_INFO[code].htmlLang}
                  onClick={() => {
                    setOpen(false);
                    void choose(code);
                  }}
                  role="menuitemradio"
                  type="button"
                >
                  <span className="flex-1 text-sm font-semibold text-[#173d35]">
                    {LOCALE_INFO[code].nativeName}
                  </span>
                  {isSelected ? (
                    <Check aria-hidden className="size-4 text-[#245c4d]" strokeWidth={2.75} />
                  ) : null}
                </button>
              );
            })}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
