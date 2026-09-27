"use client";

import { useT } from "./i18n";
import { BeautyDocsHeader } from "./BeautyDocsHeader";

export function PublicTenantNotFound() {
  const t = useT();
  return (
    <StatusPage
      code="404"
      description={t("Sprawdź adres strony lub skontaktuj się bezpośrednio z salonem.")}
      title={t("Nie znaleziono salonu")}
    />
  );
}

export function PublicTenantUnavailable() {
  const t = useT();
  return (
    <StatusPage
      description={t("Spróbuj ponownie za kilka minut. Jeśli problem nie ustąpi, skontaktuj się z salonem.")}
      title={t("Strona salonu jest chwilowo niedostępna")}
    />
  );
}

interface StatusPageProps {
  readonly code?: string;
  readonly title: string;
  readonly description: string;
}

function StatusPage({ code, title, description }: StatusPageProps) {
  const t = useT();
  return (
    <div className="min-h-screen bg-[#f7f8f4] text-[#173d35]">
      <BeautyDocsHeader />
      <main className="mx-auto flex w-full max-w-3xl flex-col items-center px-4 py-24 text-center sm:px-6">
        {code ? (
          <p className="text-sm font-bold tracking-widest text-stone-500">{code}</p>
        ) : null}
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
          {t(title)}
        </h1>
        <p className="mt-4 max-w-xl leading-7 text-stone-600">{t(description)}</p>
      </main>
    </div>
  );
}
