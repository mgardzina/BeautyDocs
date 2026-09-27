"use client";

import { useT } from "../i18n";
import type { ReactNode } from "react";

import { BeautyDocsHeader } from "../BeautyDocsHeader";

export function PublicFormError({ reset }: { readonly reset: () => void }) {
  const t = useT();
  return (
    <FormStatus
      action={
        <button
          className="mt-7 rounded-xl bg-[#245c4d] px-5 py-3 text-sm font-bold text-white hover:bg-[#173d35] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#245c4d] focus-visible:ring-offset-2"
          onClick={reset}
          type="button"
        >
          Spróbuj ponownie
        </button>
      }
      description={t("Odśwież stronę lub spróbuj ponownie za kilka minut.")}
      title={t("Nie udało się otworzyć formularza")}
    />
  );
}

export function PublicFormUnavailable() {
  const t = useT();
  return (
    <FormStatus
      description={t("Spróbuj ponownie za kilka minut lub skontaktuj się z salonem.")}
      title={t("Formularz jest chwilowo niedostępny")}
    />
  );
}

export function PublicFormNotFound() {
  const t = useT();
  return (
    <FormStatus
      code="404"
      description={t("Sprawdź otrzymany adres. Formularz mógł zostać wyłączony przez salon.")}
      title={t("Nie znaleziono formularza")}
    />
  );
}

interface FormStatusProps {
  readonly code?: string;
  readonly title: string;
  readonly description: string;
  readonly action?: ReactNode;
}

function FormStatus({ code, title, description, action }: FormStatusProps) {
  const t = useT();
  return (
    <div className="min-h-screen bg-[#f7f8f4] text-[#173d35]">
      <BeautyDocsHeader />
      <main className="mx-auto flex max-w-3xl flex-col items-center px-4 py-24 text-center sm:px-6">
        {code ? <p className="text-sm font-bold tracking-widest">{code}</p> : null}
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
          {t(title)}
        </h1>
        <p className="mt-4 max-w-xl leading-7 text-stone-600">{t(description)}</p>
        {action}
      </main>
    </div>
  );
}
