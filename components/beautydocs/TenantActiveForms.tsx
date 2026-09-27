"use client";

import { useT } from "./i18n";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, FileText } from "lucide-react";
import { beautyDocsFormPreviewPath } from "../../lib/beautydocs-form-path";
import { isValidTenantSlug } from "../../lib/tenant-host";
import type { TenantActiveForm } from "../../types/tenant";
import { BeautyDocsFormQrDialog } from "./admin/BeautyDocsFormQrDialog";

interface TenantActiveFormsProps {
  readonly forms: readonly TenantActiveForm[];
  readonly tenantSlug?: string;
  readonly salonName?: string;
  readonly logoUrl?: string | null;
  readonly fromAdmin?: boolean;
  readonly fromConsumer?: boolean;
}

/** Shared form catalogue presentation. It does not accept tenant theme props. */
export function TenantActiveForms({
  forms,
  tenantSlug,
  salonName,
  logoUrl,
  fromAdmin = false,
  fromConsumer = false,
}: TenantActiveFormsProps) {
  const t = useT();
  const fromQuery = fromAdmin
    ? "?from=admin"
    : fromConsumer
      ? "?from=consumer"
      : "";
  return (
    <section aria-labelledby="active-forms-heading">
      {fromAdmin && tenantSlug && isValidTenantSlug(tenantSlug) ? (
        <Link
          className="mb-6 inline-flex items-center gap-1.5 rounded-lg text-sm font-bold text-[#245c4d] transition hover:text-[#173d35] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#245c4d] focus-visible:ring-offset-2"
          href={`/panel/${encodeURIComponent(tenantSlug)}/forms`}
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          {t("Wróć do panelu")}
        </Link>
      ) : null}
      {fromConsumer ? (
        <Link
          className="mb-6 inline-flex items-center gap-1.5 rounded-lg text-sm font-bold text-[#245c4d] transition hover:text-[#173d35] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#245c4d] focus-visible:ring-offset-2"
          href="/klient?section=salons"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          {t("Wróć do panelu klientki")}
        </Link>
      ) : null}

      <div className="max-w-2xl">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#245c4d]">
          {t("Dokumentacja online")}
        </p>
        <h1
          className="mt-2 text-3xl font-black tracking-[-0.03em] text-[#173d35] sm:text-4xl"
          id="active-forms-heading"
        >
          {t("Wybierz formularz zabiegowy")}
        </h1>
        <p className="mt-3 text-base leading-7 text-stone-600">
          {t("Wybierz rodzaj zabiegu, aby rozpocząć uzupełnianie dokumentacji.")}
        </p>
      </div>

      {forms.length > 0 ? (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {forms.map((form) => (
            <li
              className="group relative flex flex-col rounded-3xl border border-[#e7ecdf] bg-white p-6 transition duration-200 hover:-translate-y-0.5 hover:border-[#cdd7c6] hover:shadow-[0_16px_40px_rgba(49,67,51,0.10)] has-[a:focus-visible]:border-[#245c4d] has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-[#245c4d]/30"
              key={form.code}
            >
              <div className="flex items-start gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#f1f6e9] text-[#245c4d] transition group-hover:bg-[#e7f0db]">
                  <FileText aria-hidden="true" className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-black leading-snug text-[#173d35]">
                    {form.displayName}
                  </h2>
                  <p className="mt-1 text-sm text-stone-500">
                    {t("Wypełnij dokumentację online")}
                  </p>
                </div>
                <ArrowUpRight
                  aria-hidden="true"
                  className="size-5 shrink-0 text-[#c0c9b4] transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[#245c4d]"
                />
              </div>

              {fromAdmin && tenantSlug ? (
                <div className="relative z-10 mt-4 border-t border-[#edf2e6] pt-4">
                  <BeautyDocsFormQrDialog
                    formCode={form.code}
                    formName={form.displayName}
                    tenantSlug={tenantSlug}
                  />
                </div>
              ) : null}

              {tenantSlug ? (
                <Link
                  aria-label={t("Otwórz formularz: {displayName}", { displayName: form.displayName })}
                  className="absolute inset-0 rounded-3xl focus-visible:outline-none"
                  href={`${beautyDocsFormPreviewPath(tenantSlug, form.code)}${fromQuery}`}
                />
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-8 rounded-3xl border border-dashed border-[#cdd7c6] bg-[#fcfaf8] p-8 text-center">
          <p className="font-black text-[#173d35]">{t("Brak aktywnych formularzy")}</p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-stone-600">
            {t("Ten salon nie udostępnia obecnie formularzy online. Skontaktuj się z salonem, aby uzyskać więcej informacji.")}
          </p>
        </div>
      )}
    </section>
  );
}
