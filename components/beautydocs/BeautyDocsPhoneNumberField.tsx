"use client";

import { useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { BeautyDocsAnchoredPopover } from "./BeautyDocsAnchoredPopover";
import {
  COUNTRY_CODES,
  formatPhoneDigits,
  makeCountryUid,
  type CountryDialCode,
} from "./forms/phone-countries";

// Country-prefix picker, shared with the treatment forms' phone field. The menu
// is portalled so it is never clipped inside cards/modals with overflow-hidden.
function PhonePrefixDropdown({
  selected,
  selectedUid,
  disabled,
  onSelect,
}: {
  readonly selected: CountryDialCode;
  readonly selectedUid: string;
  readonly disabled?: boolean;
  readonly onSelect: (uid: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const buttonRef = useRef<HTMLButtonElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRY_CODES;
    return COUNTRY_CODES.filter(
      (c) => c.label.toLowerCase().includes(q) || c.code.includes(q),
    );
  }, [query]);

  return (
    <>
      <button
        ref={buttonRef}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="Przedrostek numeru telefonu"
        className="flex h-full items-center gap-1.5 rounded-l-xl border-0 border-r border-stone-200 bg-white px-3 py-2.5 text-xs font-semibold text-[#245c4d] outline-none transition hover:bg-[#f8faf5] focus-visible:ring-0 disabled:opacity-60"
        disabled={disabled}
        type="button"
        onClick={() => {
          if (!open) setQuery("");
          setOpen((value) => !value);
        }}
      >
        <span className="text-base leading-none">{selected.flag}</span>
        <span>{selected.code}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-[#aab59a] transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      <BeautyDocsAnchoredPopover
        anchorRef={buttonRef}
        onClose={() => setOpen(false)}
        open={open}
        width={288}
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-stone-100 px-3 py-2.5">
          <Search className="h-3.5 w-3.5 shrink-0 text-[#aab59a]" />
          <input
            autoFocus
            className="w-full border-0 bg-transparent text-sm text-[#173d35] outline-none placeholder:text-[#aeb3a7]"
            placeholder="Szukaj kraju…"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <ul className="flex-1 overflow-y-auto py-1" role="listbox">
          {filtered.length === 0 ? (
            <li className="px-3 py-2.5 text-sm text-[#aeb3a7]">Brak wyników</li>
          ) : (
            filtered.map((c) => {
              const uid = makeCountryUid(c);
              const isSelected = uid === selectedUid;
              return (
                <li key={uid} role="option" aria-selected={isSelected}>
                  <button
                    className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition ${
                      isSelected
                        ? "bg-[#f3f7ed] text-[#245c4d]"
                        : "text-[#343f35] hover:bg-[#f8faf5]"
                    }`}
                    type="button"
                    onClick={() => {
                      onSelect(uid);
                      setOpen(false);
                    }}
                  >
                    <span className="text-base leading-none">{c.flag}</span>
                    <span className="flex-1 truncate">{c.label}</span>
                    <span className="text-xs font-semibold text-[#8ea591]">{c.code}</span>
                    {isSelected ? (
                      <Check className="h-4 w-4 shrink-0 text-[#245c4d]" />
                    ) : null}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </BeautyDocsAnchoredPopover>
    </>
  );
}

/**
 * Phone number input with a searchable country-prefix picker. `value` is the
 * full string, e.g. "+48 600 000 000"; `onChange` receives the same shape.
 */
export function BeautyDocsPhoneNumberField({
  value,
  onChange,
  id,
  disabled,
}: {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly id?: string;
  readonly disabled?: boolean;
}) {
  const parseValue = (
    v: string,
  ): { uid: string; prefix: string; number: string } => {
    if (!v) {
      const def = COUNTRY_CODES[0]!;
      return { uid: makeCountryUid(def), prefix: def.code, number: "" };
    }
    const sorted = [...COUNTRY_CODES].sort((a, b) => b.code.length - a.code.length);
    const match = sorted.find((c) => v.startsWith(c.code + " ") || v === c.code);
    if (match) {
      return {
        uid: makeCountryUid(match),
        prefix: match.code,
        number: v.slice(match.code.length).trimStart(),
      };
    }
    const def = COUNTRY_CODES[0]!;
    return { uid: makeCountryUid(def), prefix: def.code, number: v.replace(/^\+\d+ /, "") };
  };

  const parsed = parseValue(value);
  const [selectedUid, setSelectedUid] = useState(parsed.uid);
  const selectedCountry =
    COUNTRY_CODES.find((c) => makeCountryUid(c) === selectedUid) ?? COUNTRY_CODES[0]!;

  const handlePrefixChange = (newUid: string) => {
    setSelectedUid(newUid);
    const country =
      COUNTRY_CODES.find((c) => makeCountryUid(c) === newUid) ?? COUNTRY_CODES[0]!;
    const digits = parsed.number.replace(/\D/g, "");
    const formatted = formatPhoneDigits(digits, country.groups);
    onChange(country.code + (formatted ? " " + formatted : ""));
  };

  const handleNumberChange = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, selectedCountry.digits ?? 15);
    const formatted = formatPhoneDigits(digits, selectedCountry.groups);
    onChange(selectedCountry.code + (formatted ? " " + formatted : ""));
  };

  return (
    <div className="flex w-full rounded-xl border border-stone-200 bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] transition">
      <PhonePrefixDropdown
        disabled={disabled}
        onSelect={handlePrefixChange}
        selected={selectedCountry}
        selectedUid={selectedUid}
      />
      <input
        autoComplete="tel"
        className="min-w-0 flex-1 rounded-r-xl border-0 bg-[#f7f8f4] px-3 py-2.5 text-sm text-[#173d35] outline-none transition placeholder:text-[#aeb3a7] focus-visible:ring-0 disabled:opacity-60"
        disabled={disabled}
        id={id}
        inputMode="numeric"
        placeholder={selectedCountry.groups.map((n) => "X".repeat(n)).join(" ")}
        type="tel"
        value={parsed.number}
        onChange={(e) => handleNumberChange(e.target.value)}
      />
    </div>
  );
}
