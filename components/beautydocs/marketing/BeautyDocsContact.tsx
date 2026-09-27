"use client";

import { useT } from "../i18n";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ArrowRight,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Mail,
  Search,
  ShieldCheck,
} from "lucide-react";
import {
  COUNTRY_CODES,
  formatPhoneDigits,
  makeCountryUid,
  type CountryDialCode,
} from "../forms/phone-countries";

const topics = [
  "Prezentacja platformy",
  "Wdrożenie w salonie",
  "Cennik dla salonu",
  "Coś innego",
] as const;

const trustPoints = [
  { Icon: Clock, text: "Odpowiadamy w 1 dzień roboczy" },
  { Icon: CalendarClock, text: "Prezentacja 30 minut, bez zobowiązań" },
  { Icon: ShieldCheck, text: "Twoje dane nie trafiają do osób trzecich" },
] as const;

/** Closes the dropdown on outside click / Escape while it is open. */
function useCloseOnOutside(
  ref: React.RefObject<HTMLElement | null>,
  open: boolean,
  onClose: () => void,
) {
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [ref, open, onClose]);
}

const triggerCls =
  "flex w-full items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.04] px-3.5 py-2.5 text-sm text-white outline-none transition hover:bg-white/[0.07] focus-visible:border-[#afc98a] focus-visible:outline-none";
const panelCls =
  "absolute left-0 top-[calc(100%+6px)] z-30 w-full overflow-hidden rounded-xl border border-white/10 bg-[#222b23] shadow-[0_24px_60px_-20px_rgba(0,0,0,0.7)]";

/** Dark, app-styled dropdown replacing the native <select> for the topic. */
function ContactTopicSelect({
  value,
  onChange,
}: {
  readonly value: string;
  readonly onChange: (value: string) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useCloseOnOutside(rootRef, open, () => setOpen(false));

  return (
    <div className="relative" ref={rootRef}>
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        className={triggerCls}
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        <span className={`truncate ${value ? "text-white" : "text-white/40"}`}>
          {value || t("Wybierz temat")}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`ml-auto size-4 shrink-0 text-white/40 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? (
        <ul className={`${panelCls} py-1`} role="listbox">
          {topics.map((topic) => {
            const selected = topic === value;
            return (
              <li key={topic} role="option" aria-selected={selected}>
                <button
                  className={`flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm transition ${
                    selected
                      ? "bg-[#245c4d]/25 text-[#c6dfb7]"
                      : "text-white/80 hover:bg-white/[0.06]"
                  }`}
                  onClick={() => {
                    onChange(topic);
                    setOpen(false);
                  }}
                  type="button"
                >
                  <span className="flex-1">{topic}</span>
                  {selected ? <Check className="size-4 text-[#c6dfb7]" /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

/** Dark phone field with a searchable country prefix, matching the client form. */
function ContactPhoneField() {
  const t = useT();
  const [selectedUid, setSelectedUid] = useState(makeCountryUid(COUNTRY_CODES[0]!));
  const [number, setNumber] = useState("");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  useCloseOnOutside(rootRef, open, () => setOpen(false));

  const country =
    COUNTRY_CODES.find((c) => makeCountryUid(c) === selectedUid) ?? COUNTRY_CODES[0]!;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRY_CODES;
    return COUNTRY_CODES.filter(
      (c) => c.label.toLowerCase().includes(q) || c.code.includes(q),
    );
  }, [query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      searchRef.current?.focus();
    }
  }, [open]);

  const handleNumber = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, country.digits ?? 15);
    setNumber(formatPhoneDigits(digits, country.groups));
  };

  const combined = number ? `${country.code} ${number}` : "";

  return (
    <div className="relative flex rounded-xl border border-white/15 bg-white/[0.04] transition focus-within:border-[#afc98a]" ref={rootRef}>
      <input name="phone" type="hidden" value={combined} />
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={t("Prefiks numeru telefonu")}
        className="flex shrink-0 items-center gap-1.5 rounded-l-xl border-r border-white/10 px-3 py-2.5 text-sm font-semibold text-white/90 transition hover:bg-white/[0.05] focus-visible:outline-none"
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        <span className="text-base leading-none">{country.flag}</span>
        <span>{country.code}</span>
        <ChevronDown
          aria-hidden="true"
          className={`size-3.5 text-white/40 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      <input
        autoComplete="tel"
        className="min-w-0 flex-1 rounded-r-xl bg-transparent px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/40"
        inputMode="numeric"
        onChange={(e) => handleNumber(e.target.value)}
        placeholder={country.groups.map((n) => "X".repeat(n)).join(" ")}
        type="tel"
        value={number}
      />

      {open ? (
        <div className="absolute left-0 top-[calc(100%+6px)] z-30 w-72 max-w-[85vw] overflow-hidden rounded-xl border border-white/10 bg-[#222b23] shadow-[0_24px_60px_-20px_rgba(0,0,0,0.7)]">
          <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2.5">
            <Search aria-hidden="true" className="size-3.5 shrink-0 text-white/40" />
            <input
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/40"
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("Szukaj kraju…")}
              ref={searchRef}
              type="text"
              value={query}
            />
          </div>
          <ul className="max-h-56 overflow-y-auto py-1" role="listbox">
            {filtered.length === 0 ? (
              <li className="px-3 py-2.5 text-sm text-white/40">{t("Brak wyników")}</li>
            ) : (
              filtered.map((c) => {
                const uid = makeCountryUid(c);
                const selected = uid === selectedUid;
                return (
                  <li key={uid} role="option" aria-selected={selected}>
                    <button
                      className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition ${
                        selected
                          ? "bg-[#245c4d]/25 text-[#c6dfb7]"
                          : "text-white/80 hover:bg-white/[0.06]"
                      }`}
                      onClick={() => {
                        setSelectedUid(uid);
                        setOpen(false);
                      }}
                      type="button"
                    >
                      <span className="text-base leading-none">{c.flag}</span>
                      <span className="flex-1 truncate">{t(c.label)}</span>
                      <span className="text-xs font-semibold text-white/50">{c.code}</span>
                      {selected ? <Check className="size-4 shrink-0 text-[#c6dfb7]" /> : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function BeautyDocsContact() {
  const t = useT();
  const [submitted, setSubmitted] = useState(false);
  const [topic, setTopic] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    // Preview: no backend yet, so we confirm locally instead of sending.
    event.preventDefault();
    setSubmitted(true);
  };

  return (
    <section
      className="scroll-mt-28 bg-gradient-to-b from-[#f7f8f4] to-[#f4ece7] px-4 py-20 sm:px-6 sm:py-28 lg:px-8"
      id="kontakt"
    >
      <div className="mx-auto grid w-full max-w-6xl gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:gap-16">
        {/* Left — pitch + channels */}
        <div className="lg:pt-4">
          <span className="inline-flex items-center rounded-full border border-[#dbe6cc] bg-white px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-[#245c4d]">
            {t("Kontakt")}
          </span>
          <h2 className="mt-5 font-serif text-3xl font-medium leading-[1.1] tracking-tight text-[#173d35] sm:text-4xl lg:text-5xl">
            {t("Wolisz porozmawiać?")}{" "}
            <span className="italic text-[#245c4d]">{t("Umów się indywidualnie.")}</span>
          </h2>
          <p className="mt-5 max-w-md text-lg leading-8 text-stone-600">
            {t("Pokażemy BeautyDocs na przykładzie Twojego salonu i pomożemy dobrać formularze pod usługi. Wybierz dogodny termin — resztą się zajmiemy.")}
          </p>

          <a
            className="mt-8 inline-flex items-center gap-3 rounded-2xl border border-[#e0e7d7] bg-white px-4 py-3 text-[#173d35] shadow-sm transition hover:border-[#bacdbb] hover:bg-[#f3f6ef] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#245c4d]"
            href="mailto:kontakt@beautydocs.pl"
          >
            <span className="flex size-10 items-center justify-center rounded-xl bg-[#e7efdf] text-[#245c4d]">
              <Mail aria-hidden="true" className="size-5" />
            </span>
            <span>
              <span className="block text-xs font-bold uppercase tracking-[0.12em] text-[#596b62]">
                {t("Napisz do nas")}
              </span>
              <span className="block font-bold">{t("kontakt@beautydocs.pl")}</span>
            </span>
          </a>

          <ul className="mt-8 space-y-3">
            {trustPoints.map(({ Icon, text }) => (
              <li className="flex items-center gap-3 text-sm text-stone-600" key={text}>
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#e2ead7] text-[#245c4d]">
                  <Icon aria-hidden="true" className="size-3.5" />
                </span>
                {t(text)}
              </li>
            ))}
          </ul>
        </div>

        {/* Right — booking form (dark card) */}
        <div className="relative rounded-[1.75rem] border border-white/10 bg-[#173d35] p-6 text-white shadow-[0_30px_80px_-40px_rgba(39,56,41,0.8)] sm:p-8">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-10 -top-12 size-40 rounded-full bg-[#245c4d]/30 blur-3xl"
          />
          {submitted ? (
            <div className="relative flex min-h-[420px] flex-col items-center justify-center text-center">
              <span className="flex size-16 items-center justify-center rounded-full bg-[#245c4d]/20 text-[#c6dfb7]">
                <CheckCircle2 aria-hidden="true" className="size-8" />
              </span>
              <h3 className="mt-6 font-serif text-2xl">{t("Dziękujemy!")}</h3>
              <p className="mt-3 max-w-sm text-white/70">
                {t("Zgłoszenie zostało przyjęte. Odezwiemy się na wskazany adres w ciągu jednego dnia roboczego, aby potwierdzić termin.")}
              </p>
              <button
                className="mt-8 text-sm font-bold text-[#c6dfb7] underline underline-offset-4 hover:text-white focus-visible:outline-none"
                onClick={() => setSubmitted(false)}
                type="button"
              >
                {t("Wyślij kolejne zgłoszenie")}
              </button>
            </div>
          ) : (
            <form className="relative" onSubmit={handleSubmit}>
              <h3 className="font-serif text-2xl">{t("Umów rozmowę")}</h3>
              <p className="mt-1.5 text-sm text-white/60">
                {t("Napisz, czego potrzebujesz — odezwiemy się z propozycją terminu.")}
              </p>

              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label={t("Imię i nazwisko")} htmlFor="c-name">
                  <input
                    autoComplete="name"
                    className={inputCls}
                    id="c-name"
                    name="name"
                    placeholder={t("np. Anna Kowalska")}
                    required
                    type="text"
                  />
                </Field>
                <Field label={t("Nazwa salonu")} htmlFor="c-salon">
                  <input
                    className={inputCls}
                    id="c-salon"
                    name="salon"
                    placeholder={t("np. Studio Lumière")}
                    type="text"
                  />
                </Field>
                <Field label={t("E-mail")} htmlFor="c-email">
                  <input
                    autoComplete="email"
                    className={inputCls}
                    id="c-email"
                    name="email"
                    placeholder={t("np. salon@example.com")}
                    required
                    type="email"
                  />
                </Field>
                <Field label={t("Telefon (opcjonalnie)")} htmlFor="c-phone">
                  <ContactPhoneField />
                </Field>
              </div>

              <div className="mt-4">
                <Field label={t("Czego dotyczy?")} htmlFor="c-topic">
                  <input name="topic" type="hidden" value={topic} />
                  <ContactTopicSelect onChange={setTopic} value={topic} />
                </Field>
              </div>

              <div className="mt-4">
                <Field label={t("Wiadomość")} htmlFor="c-message">
                  <textarea
                    className={`${inputCls} min-h-[110px] resize-y`}
                    id="c-message"
                    name="message"
                    placeholder={t("Napisz krótko, jakie usługi oferuje salon i czego szukasz.")}
                  />
                </Field>
              </div>

              <button
                className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#245c4d] px-5 py-3 font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#5a9a8a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#afc98a] focus-visible:ring-offset-2 focus-visible:ring-offset-[#173d35]"
                type="submit"
              >
                {t("Umów rozmowę")}
                <ArrowRight aria-hidden="true" className="size-4" />
              </button>
              <p className="mt-3 text-center text-xs text-white/40">
                {t("Wysyłając formularz, zgadzasz się na kontakt w sprawie prezentacji.")}
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

const inputCls =
  "w-full rounded-xl border border-white/15 bg-white/[0.04] px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-white/40 focus:border-[#afc98a] focus:bg-white/[0.06] focus-visible:ring-0";

function Field({
  label,
  htmlFor,
  children,
}: {
  readonly label: string;
  readonly htmlFor: string;
  readonly children: ReactNode;
}) {
  const t = useT();
  return (
    <label className="block" htmlFor={htmlFor}>
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.12em] text-white/50">
        {t(label)}
      </span>
      {children}
    </label>
  );
}
