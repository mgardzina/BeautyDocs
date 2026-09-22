"use client";

import { useState } from "react";
import { Check, Lock } from "lucide-react";

const cardCls =
  "overflow-hidden rounded-[1.5rem] border border-white/80 bg-white shadow-[0_24px_64px_-30px_rgba(39,56,41,0.5)]";

function WindowBar({ title }: { readonly title: string }) {
  return (
    <div className="flex items-center justify-between border-b border-stone-200 bg-[#f7f8f4] px-4 py-3">
      <div className="flex items-center gap-1.5" aria-hidden="true">
        <span className="size-2.5 rounded-full bg-[#c4d8a7]" />
        <span className="size-2.5 rounded-full bg-[#dec9aa]" />
        <span className="size-2.5 rounded-full bg-[#b8c9bd]" />
      </div>
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-stone-400">
        {title}
      </p>
    </div>
  );
}

function Scribble({ className = "" }: { readonly className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 160 40"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M4 28c10-14 16 6 24-4s10-16 16-6 8 20 16 10 12-20 20-12 10 18 18 10 14-16 22-8 12 12 20 6"
        stroke="#173d35"
        strokeLinecap="round"
        strokeWidth="2.4"
      />
    </svg>
  );
}

/** #wywiady — a client filling and signing the intake form online. */
function WywiadyMock() {
  const [answer, setAnswer] = useState<"tak" | "nie">("nie");
  const [consent, setConsent] = useState(true);
  const [sent, setSent] = useState(false);

  return (
    <div className={cardCls}>
      <WindowBar title="Formularz online" />
      <div className="space-y-4 p-5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-stone-500">
            Imię i nazwisko
          </p>
          <div className="mt-1.5 rounded-xl border border-stone-200 bg-[#f7f8f4] px-3 py-2.5 text-sm font-medium text-[#173d35]">
            Anna Kowalska
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-[#173d35]">
            Czy przyjmujesz leki rozrzedzające krew?
          </p>
          <div className="mt-2 flex gap-2">
            {(["tak", "nie"] as const).map((option) => (
              <button
                aria-pressed={answer === option}
                className={`rounded-lg border px-4 py-1.5 text-sm capitalize transition ${
                  answer === option
                    ? "border-[#245c4d] bg-[#245c4d] font-semibold text-white"
                    : "border-stone-200 text-stone-500 hover:border-[#bacdbb] hover:bg-[#f3f6ef]"
                }`}
                key={option}
                onClick={() => setAnswer(option)}
                type="button"
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <button
          aria-pressed={consent}
          className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition ${
            consent ? "bg-[#eef3e8]" : "bg-stone-50 hover:bg-stone-100"
          }`}
          onClick={() => setConsent((v) => !v)}
          type="button"
        >
          <span
            className={`flex size-5 items-center justify-center rounded-md transition ${
              consent ? "bg-[#245c4d] text-white" : "border border-stone-300 bg-white text-transparent"
            }`}
          >
            <Check aria-hidden="true" className="size-3.5" />
          </span>
          <span className="text-sm text-[#173d35]">Wyrażam zgodę na zabieg</span>
        </button>

        <div className="rounded-xl border border-dashed border-stone-300 px-3 pb-2 pt-1">
          <Scribble className="h-9 w-40" />
          <p className="text-[11px] text-stone-400">Podpis klientki</p>
        </div>

        <button
          className={`flex h-10 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold text-white transition ${
            sent ? "bg-[#3b6d11]" : "bg-[#245c4d] hover:bg-[#194637]"
          }`}
          onClick={() => {
            setSent(true);
            window.setTimeout(() => setSent(false), 1800);
          }}
          type="button"
        >
          {sent ? (
            <>
              <Check aria-hidden="true" className="size-4" /> Wysłano
            </>
          ) : (
            "Wyślij formularz"
          )}
        </button>
      </div>
    </div>
  );
}

/** #kartoteka — one client's record with clickable history. */
function KartotekaMock() {
  const history = [
    { date: "12.05.2026", treatment: "Modelowanie ust", tone: "bg-[#245c4d]" },
    { date: "03.02.2026", treatment: "Botoks — czoło", tone: "bg-[#c39a6b]" },
    { date: "18.11.2025", treatment: "Mezoterapia", tone: "bg-[#7f9a86]" },
  ];
  const [selected, setSelected] = useState(0);

  return (
    <div className={cardCls}>
      <div className="flex items-center gap-3 p-5">
        <span className="flex size-12 items-center justify-center rounded-full bg-gradient-to-br from-[#afc98a] to-[#245c4d] text-base font-bold text-white">
          AK
        </span>
        <div>
          <p className="font-bold text-[#173d35]">Anna Kowalska</p>
          <p className="text-xs text-stone-500">Klientka od 2024 · 7 wizyt</p>
        </div>
        <span className="ml-auto rounded-full bg-[#eaf3de] px-2.5 py-1 text-[11px] font-bold text-[#3b6d11]">
          Aktywna
        </span>
      </div>

      <div className="grid grid-cols-2 gap-px bg-stone-100">
        <div className="bg-white px-5 py-3">
          <p className="text-[11px] uppercase tracking-[0.08em] text-stone-400">Ostatni zabieg</p>
          <p className="mt-0.5 text-sm font-semibold text-[#173d35]">
            {history[selected]!.treatment}
          </p>
        </div>
        <div className="bg-white px-5 py-3">
          <p className="text-[11px] uppercase tracking-[0.08em] text-stone-400">Alergie</p>
          <p className="mt-0.5 text-sm font-semibold text-[#173d35]">Brak</p>
        </div>
      </div>

      <div className="border-t border-stone-100 p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-stone-500">
          Historia zabiegów
        </p>
        <ul className="mt-3 space-y-1">
          {history.map((row, i) => (
            <li key={row.date}>
              <button
                aria-pressed={selected === i}
                className={`flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition ${
                  selected === i ? "bg-[#eef3e8]" : "hover:bg-stone-50"
                }`}
                onClick={() => setSelected(i)}
                type="button"
              >
                <span className={`size-2.5 shrink-0 rounded-full ${row.tone}`} />
                <span className="text-sm text-[#173d35]">{row.treatment}</span>
                <span className="ml-auto text-xs text-stone-400">{row.date}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** #formularze — the catalogue of ready templates, toggled per service. */
function FormularzeMock() {
  const [forms, setForms] = useState([
    { name: "Modelowanie ust", on: true },
    { name: "Botoks", on: true },
    { name: "Mezoterapia igłowa", on: false },
    { name: "Peeling chemiczny", on: true },
  ]);
  const activeCount = forms.filter((f) => f.on).length;

  const toggle = (index: number) => {
    setForms((prev) =>
      prev.map((form, i) => (i === index ? { ...form, on: !form.on } : form)),
    );
  };

  return (
    <div className={cardCls}>
      <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
        <p className="font-bold text-[#173d35]">Formularze salonu</p>
        <span className="rounded-full bg-[#eef3e7] px-2.5 py-1 text-xs font-bold text-[#245c4d]">
          {activeCount} aktywne
        </span>
      </div>
      <ul className="divide-y divide-stone-100">
        {forms.map((form, i) => (
          <li className="flex items-center gap-3 px-5 py-3.5" key={form.name}>
            <span className="flex size-8 items-center justify-center rounded-lg bg-[#eef3e8] text-[11px] font-black text-[#245c4d]">
              PDF
            </span>
            <span className="text-sm font-medium text-[#173d35]">{form.name}</span>
            <button
              aria-checked={form.on}
              aria-label={`${form.name}: ${form.on ? "włączony" : "wyłączony"}`}
              className={`ml-auto flex h-6 w-11 items-center rounded-full p-0.5 transition ${
                form.on ? "justify-end bg-[#245c4d]" : "justify-start bg-stone-200"
              }`}
              onClick={() => toggle(i)}
              role="switch"
              type="button"
            >
              <span className="size-5 rounded-full bg-white shadow-sm" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** #zgodnosc — a signed, versioned consent document. */
function ZgodnoscMock() {
  return (
    <div className={cardCls}>
      <div className="flex items-center gap-3 border-b border-stone-100 px-5 py-4">
        <span className="flex size-10 items-center justify-center rounded-full bg-[#eaf3de] text-[#3b6d11]">
          <Check aria-hidden="true" className="size-5" />
        </span>
        <div>
          <p className="text-sm font-bold text-[#173d35]">Podpisano</p>
          <p className="text-xs text-stone-500">12.05.2026 · 14:32</p>
        </div>
        <span className="ml-auto rounded-full border border-stone-200 px-2.5 py-1 text-[11px] font-bold text-stone-500">
          wersja 3
        </span>
      </div>

      <div className="p-5">
        <p className="font-serif text-lg text-[#173d35]">
          Zgoda na zabieg — modelowanie ust
        </p>
        <div className="mt-3 space-y-2" aria-hidden="true">
          <div className="h-2.5 w-full rounded-full bg-stone-100" />
          <div className="h-2.5 w-11/12 rounded-full bg-stone-100" />
          <div className="h-2.5 w-4/5 rounded-full bg-stone-100" />
        </div>

        <div className="mt-5 flex items-end justify-between">
          <div>
            <Scribble className="h-9 w-32" />
            <p className="text-[11px] text-stone-400">Anna Kowalska</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#eef3e8] px-2.5 py-1 text-[11px] font-bold text-[#245c4d]">
            <Lock aria-hidden="true" className="size-3" />
            Zgodne z RODO
          </span>
        </div>
      </div>
    </div>
  );
}

/** Renders the bespoke, interactive UI mock for a platform feature section id. */
export function PlatformFeatureMock({ id }: { readonly id: string }) {
  switch (id) {
    case "wywiady":
      return <WywiadyMock />;
    case "kartoteka":
      return <KartotekaMock />;
    case "formularze":
      return <FormularzeMock />;
    case "zgodnosc":
      return <ZgodnoscMock />;
    default:
      return null;
  }
}
