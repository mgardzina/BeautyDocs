"use client";

import { useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { BeautyDocsAnchoredPopover } from "./BeautyDocsAnchoredPopover";

interface SelectOption {
  readonly value: string;
  readonly label: string;
}

// Dropdown select with the same look as the forms' AppSelect, but portalled so
// it is never clipped inside cards/modals.
function Select({
  value,
  options,
  placeholder,
  onChange,
  ariaLabel,
  searchable = false,
  align = "left",
  className,
  disabled,
}: {
  readonly value: string;
  readonly options: readonly SelectOption[];
  readonly placeholder: string;
  readonly onChange: (value: string) => void;
  readonly ariaLabel?: string;
  readonly searchable?: boolean;
  readonly align?: "left" | "center";
  readonly className?: string;
  readonly disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const buttonRef = useRef<HTMLButtonElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!searchable || !q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query, searchable]);

  const selected = options.find((o) => o.value === value);

  return (
    <div className={className}>
      <button
        ref={buttonRef}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        className={`flex w-full items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-3 text-sm outline-none transition hover:bg-[#f8faf5] focus-visible:ring-0 disabled:opacity-60 ${
          selected ? "text-[#173d35]" : "text-[#aeb3a7]"
        } ${align === "center" ? "justify-center text-center" : "justify-between"}`}
        disabled={disabled}
        type="button"
        onClick={() => {
          if (!open && searchable) setQuery("");
          setOpen((current) => !current);
        }}
      >
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-[#aab59a] transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      <BeautyDocsAnchoredPopover
        anchorRef={buttonRef}
        onClose={() => setOpen(false)}
        open={open}
        width="anchor"
      >
        {searchable ? (
          <div className="flex shrink-0 items-center gap-2 border-b border-stone-100 px-3 py-2.5">
            <Search className="h-3.5 w-3.5 shrink-0 text-[#aab59a]" />
            <input
              autoFocus
              className="w-full border-0 bg-transparent text-sm text-[#173d35] outline-none placeholder:text-[#aeb3a7]"
              placeholder="Szukaj…"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        ) : null}
        <ul className="flex-1 overflow-y-auto py-1" role="listbox">
          {filtered.length === 0 ? (
            <li className="px-3 py-2.5 text-sm text-[#aeb3a7]">Brak wyników</li>
          ) : (
            filtered.map((o) => {
              const isSelected = o.value === value;
              return (
                <li key={o.value} role="option" aria-selected={isSelected}>
                  <button
                    className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition ${
                      isSelected
                        ? "bg-[#f3f7ed] text-[#245c4d]"
                        : "text-[#343f35] hover:bg-[#f8faf5]"
                    }`}
                    type="button"
                    onClick={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                  >
                    <span className="flex-1 truncate">{o.label}</span>
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
    </div>
  );
}

const MONTHS: readonly SelectOption[] = [
  { value: "01", label: "Styczeń" },
  { value: "02", label: "Luty" },
  { value: "03", label: "Marzec" },
  { value: "04", label: "Kwiecień" },
  { value: "05", label: "Maj" },
  { value: "06", label: "Czerwiec" },
  { value: "07", label: "Lipiec" },
  { value: "08", label: "Sierpień" },
  { value: "09", label: "Wrzesień" },
  { value: "10", label: "Październik" },
  { value: "11", label: "Listopad" },
  { value: "12", label: "Grudzień" },
];

function getDaysInMonth(m: number, y: number): number {
  if (!m) return 31;
  if (m === 2) {
    if (!y) return 29;
    return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28;
  }
  if ([4, 6, 9, 11].includes(m)) return 30;
  return 31;
}

/**
 * Day / month / year dropdowns for a birth date. `value` is an ISO date string
 * ("YYYY-MM-DD"); `onChange` receives the same shape. Same UX as the forms.
 */
export function BeautyDocsBirthDateField({
  value,
  onChange,
  disabled,
}: {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly disabled?: boolean;
}) {
  const [yearStr, monthStr, dayStr] =
    value && value.includes("-") ? value.split("-") : ["", "", ""];

  const years = useMemo(() => {
    const list: string[] = [];
    for (let y = 2026; y >= 1900; y--) list.push(String(y));
    return list;
  }, []);

  const maxDays = getDaysInMonth(Number(monthStr), Number(yearStr));
  const days = useMemo(
    () => Array.from({ length: maxDays }, (_, i) => String(i + 1).padStart(2, "0")),
    [maxDays],
  );

  const update = (y: string, m: string, d: string) => onChange(`${y}-${m}-${d}`);

  const handleYearChange = (y: string) => {
    let d = dayStr;
    if (monthStr && d) {
      const maxD = getDaysInMonth(Number(monthStr), Number(y));
      if (Number(d) > maxD) d = String(maxD).padStart(2, "0");
    }
    update(y, monthStr, d);
  };

  const handleMonthChange = (m: string) => {
    let d = dayStr;
    if (m && d) {
      const maxD = getDaysInMonth(Number(m), Number(yearStr));
      if (Number(d) > maxD) d = String(maxD).padStart(2, "0");
    }
    update(yearStr, m, d);
  };

  const handleDayChange = (d: string) => update(yearStr, monthStr, d);

  return (
    <div className="grid grid-cols-12 gap-2 sm:gap-3">
      <Select
        align="center"
        ariaLabel="Dzień urodzenia"
        className="col-span-3"
        disabled={disabled}
        options={days.map((d) => ({ value: d, label: d }))}
        placeholder="Dzień"
        value={dayStr}
        onChange={handleDayChange}
      />
      <Select
        ariaLabel="Miesiąc urodzenia"
        className="col-span-5"
        disabled={disabled}
        options={MONTHS}
        placeholder="Miesiąc"
        value={monthStr}
        onChange={handleMonthChange}
      />
      <Select
        align="center"
        ariaLabel="Rok urodzenia"
        className="col-span-4"
        disabled={disabled}
        options={years.map((y) => ({ value: y, label: y }))}
        placeholder="Rok"
        searchable
        value={yearStr}
        onChange={handleYearChange}
      />
    </div>
  );
}
