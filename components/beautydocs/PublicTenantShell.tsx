"use client";

import { useT } from "./i18n";
import type { ReactNode } from "react";
import type { TenantPublicConfig } from "../../types/tenant";
import { BeautyDocsHeader } from "./BeautyDocsHeader";

interface PublicTenantShellProps {
  readonly tenant: TenantPublicConfig;
  readonly children: ReactNode;
}

/**
 * Neutral public shell shared by all salons. It intentionally has no theme,
 * color or layout props: salon differences are data, not bespoke UI.
 */
export function PublicTenantShell({
  tenant,
  children,
}: PublicTenantShellProps) {
  const t = useT();
  return (
    <div className="flex min-h-screen flex-col bg-[#f7f8f4] text-[#173d35]">
      <BeautyDocsHeader tenant={tenant} />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        {children}
      </main>

      <footer className="border-t border-stone-200 bg-white">
        <div className="mx-auto grid w-full max-w-5xl gap-5 px-4 py-6 text-sm text-stone-600 sm:grid-cols-2 sm:px-6">
          <div>
            <p className="font-semibold text-[#173d35]">{tenant.legalName}</p>
            {tenant.legal.address ? (
              <address className="mt-1 not-italic">
                {tenant.legal.address.street}
                <br />
                {tenant.legal.address.postalCode} {tenant.legal.address.city}
              </address>
            ) : null}
            {tenant.legal.nip ? <p className="mt-1">{t("NIP:")}{" "}{tenant.legal.nip}</p> : null}
          </div>

          <div className="sm:text-right">
            <p className="font-semibold text-[#173d35]">{t("Kontakt z salonem")}</p>
            {tenant.contact.phone ? (
              <p className="mt-1">
                <a
                  className="underline decoration-slate-300 underline-offset-4 hover:text-[#173d35]"
                  href={`tel:${toTelephoneHref(tenant.contact.phone)}`}
                >
                  {tenant.contact.phone}
                </a>
              </p>
            ) : null}
            {tenant.contact.email ? (
              <p className="mt-1">
                <a
                  className="underline decoration-slate-300 underline-offset-4 hover:text-[#173d35]"
                  href={`mailto:${tenant.contact.email}`}
                >
                  {tenant.contact.email}
                </a>
              </p>
            ) : null}
          </div>

          <p className="text-xs text-stone-500 sm:col-span-2 sm:text-center">
            {t("Obsługiwane przez BeautyDocs")}
          </p>
        </div>
      </footer>
    </div>
  );
}

function toTelephoneHref(phone: string): string {
  return phone.replace(/[^+\d]/g, "");
}
