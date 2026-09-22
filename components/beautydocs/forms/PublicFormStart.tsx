import Link from "next/link";
import { CheckCircle2, Clock3, FileText, LockKeyhole } from "lucide-react";
import type { TenantActiveForm, TenantPublicConfig } from "../../../types/tenant";

interface PublicFormStartProps {
  readonly tenant: TenantPublicConfig;
  readonly form: TenantActiveForm;
}

const preparationItems = [
  "Przygotuj swoje podstawowe dane kontaktowe.",
  "Odpowiadaj zgodnie ze swoim aktualnym stanem zdrowia.",
  "Przed zatwierdzeniem sprawdź wszystkie podane informacje.",
] as const;

export function PublicFormStart({ tenant, form }: PublicFormStartProps) {
  return (
    <div className="mx-auto max-w-3xl">
      <Link
        className="inline-flex rounded-lg text-sm font-semibold text-stone-600 underline decoration-slate-300 underline-offset-4 hover:text-[#173d35] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#245c4d] focus-visible:ring-offset-2"
        href={`/f/${encodeURIComponent(tenant.slug)}`}
      >
        ← Wróć do formularzy
      </Link>

      <section className="mt-6 overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
        <div className="border-b border-stone-200 bg-[#f7f8f4] px-6 py-6 sm:px-8">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-[#245c4d] px-3 py-1.5 text-xs font-bold text-white">
              <FileText aria-hidden="true" className="size-3.5" />
              Formularz online
            </span>
            <span className="inline-flex items-center gap-2 text-xs font-semibold text-stone-500">
              <Clock3 aria-hidden="true" className="size-4" />
              Wypełnij spokojnie i uważnie
            </span>
          </div>
          <h1 className="mt-5 text-3xl font-bold tracking-tight text-[#173d35] sm:text-4xl">
            {form.displayName}
          </h1>
          <p className="mt-3 text-base leading-7 text-stone-600">
            Dokumentacja zabiegowa dla salonu {tenant.displayName}.
          </p>
        </div>

        <div className="px-6 py-7 sm:px-8 sm:py-8">
          <h2 className="text-lg font-bold text-[#173d35]">Zanim zaczniesz</h2>
          <ul className="mt-5 space-y-4">
            {preparationItems.map((item) => (
              <li className="flex gap-3 text-sm leading-6 text-[#173d35]" key={item}>
                <CheckCircle2
                  aria-hidden="true"
                  className="mt-0.5 size-5 shrink-0 text-emerald-700"
                />
                {item}
              </li>
            ))}
          </ul>

          <div className="mt-7 flex gap-3 rounded-2xl bg-[#f7f8f4] p-4 text-sm leading-6 text-stone-600">
            <LockKeyhole
              aria-hidden="true"
              className="mt-0.5 size-5 shrink-0 text-[#173d35]"
            />
            <p>
              Podane informacje są przeznaczone dla tego salonu. Nie wpisuj
              danych innej osoby.
            </p>
          </div>

          <button
            aria-describedby="preview-form-notice"
            className="mt-7 w-full cursor-not-allowed rounded-xl bg-[#d4decc] px-5 py-3.5 font-bold text-stone-600"
            disabled
            type="button"
          >
            Rozpocznij formularz
          </button>
          <p className="mt-3 text-center text-xs leading-5 text-stone-500" id="preview-form-notice">
            W wersji preview dostępny jest ekran startowy. Właściwe pytania
            formularza zostaną podłączone w kolejnym etapie.
          </p>
        </div>
      </section>
    </div>
  );
}
