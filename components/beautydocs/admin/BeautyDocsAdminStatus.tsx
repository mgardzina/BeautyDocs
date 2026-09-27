"use client";

import { useT } from "../i18n";
import Link from "next/link";
import { BeautyDocsHeader } from "../BeautyDocsHeader";

export function BeautyDocsAdminUnavailable() {
  const t = useT();
  return (
    <AdminStatus
      description={t("Spróbuj ponownie za kilka minut.")}
      title={t("Panel jest chwilowo niedostępny")}
    />
  );
}

export function BeautyDocsAdminNotFound() {
  const t = useT();
  return (
    <AdminStatus
      code="404"
      description={t("Sprawdź adres lub wróć do listy swoich salonów.")}
      title={t("Nie znaleziono salonu")}
    />
  );
}

export function BeautyDocsAdminClientNotFound() {
  const t = useT();
  return (
    <AdminStatus
      code="404"
      description={t("Kartoteka nie istnieje, została usunięta albo należy do innego salonu.")}
      title={t("Nie znaleziono klientki")}
    />
  );
}

export function BeautyDocsAdminFormNotFound() {
  const t = useT();
  return (
    <AdminStatus
      code="404"
      description={t("Formularz nie istnieje, został usunięty albo należy do innej klientki lub innego salonu.")}
      title={t("Nie znaleziono formularza")}
    />
  );
}

interface AdminStatusProps {
  readonly code?: string;
  readonly title: string;
  readonly description: string;
}

function AdminStatus({ code, title, description }: AdminStatusProps) {
  const t = useT();
  return (
    <div className="min-h-screen bg-[#f7f8f4] text-[#173d35]">
      <BeautyDocsHeader />
      <main className="mx-auto flex max-w-3xl flex-col items-center px-4 py-24 text-center sm:px-6">
        {code ? <p className="text-sm font-bold tracking-widest">{code}</p> : null}
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
          {t(title)}
        </h1>
        <p className="mt-4 text-stone-600">{t(description)}</p>
        {code ? (
          <Link
            className="mt-7 rounded-xl bg-[#245c4d] px-5 py-3 text-sm font-bold text-white hover:bg-[#173d35]"
            href="/panel"
          >
            {t("Wróć do panelu")}
          </Link>
        ) : null}
      </main>
    </div>
  );
}
