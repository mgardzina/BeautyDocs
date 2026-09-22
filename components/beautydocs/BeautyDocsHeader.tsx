import type { TenantPublicConfig } from "../../types/tenant";
import { BeautyDocsWordmark } from "./BeautyDocsWordmark";

interface BeautyDocsHeaderProps {
  readonly tenant?: Pick<TenantPublicConfig, "displayName">;
}

/** Shared, non-customizable header for every BeautyDocs salon. */
export function BeautyDocsHeader({ tenant }: BeautyDocsHeaderProps) {
  return (
    <header className="border-b border-stone-200 bg-white">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <BeautyDocsWordmark className="truncate text-lg text-[#173d35]" />

        {tenant ? (
          <div className="min-w-0 text-right">
            <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
              Salon
            </p>
            <p className="truncate text-sm font-semibold text-[#173d35]">
              {tenant.displayName}
            </p>
          </div>
        ) : null}
      </div>
    </header>
  );
}
