"use client";

import { BeautyDocsLanguageMenu, useT } from "./i18n";
import type { TenantPublicConfig } from "../../types/tenant";
import { BeautyDocsWordmark } from "./BeautyDocsWordmark";

interface BeautyDocsHeaderProps {
  readonly tenant?: Pick<TenantPublicConfig, "displayName">;
}

/** Shared, non-customizable header for every BeautyDocs salon. */
export function BeautyDocsHeader({ tenant }: BeautyDocsHeaderProps) {
  const t = useT();
  return (
    <header className="border-b border-stone-200 bg-white">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <BeautyDocsWordmark className="shrink-0 text-lg text-[#173d35]" />

        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          {tenant ? (
            <div className="min-w-0 text-right">
              <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
                {t("Salon")}
              </p>
              <p className="truncate text-sm font-semibold text-[#173d35]">
                {tenant.displayName}
              </p>
            </div>
          ) : null}
          {/* Clients arriving from a QR code choose their language before reading medical questions. */}
          <BeautyDocsLanguageMenu account={null} />
        </div>
      </div>
    </header>
  );
}
