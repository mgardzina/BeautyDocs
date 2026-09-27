"use client";

import { useT } from "../i18n";
import { BeautyDocsLogo } from "../BeautyDocsLogo";

export function BeautyDocsAdminPageLoading() {
  const t = useT();
  return (
    <div className="min-h-screen bg-[#f7f8f4] text-[#173d35]">
      <header className="border-b border-stone-200 bg-white px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-7xl items-center">
          <BeautyDocsLogo className="text-lg text-[#173d35]" />
        </div>
      </header>
      <main
        aria-busy="true"
        aria-label={t("Ładowanie panelu")}
        className="mx-auto max-w-6xl px-4 py-8 sm:px-6"
      >
        <div className="animate-pulse space-y-5 motion-reduce:animate-none">
          <div className="h-4 w-24 rounded bg-[#e9efe1]" />
          <div className="h-10 w-64 max-w-full rounded-lg bg-[#e9efe1]" />
          <div className="h-5 w-96 max-w-full rounded bg-[#f7f8f4]" />
          <div className="mt-8 h-12 rounded-xl bg-[#e9efe1]" />
          <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
            {[0, 1, 2, 3, 4].map((item) => (
              <div className="flex gap-4 border-b border-stone-100 p-5 last:border-b-0" key={item}>
                <div className="size-10 shrink-0 rounded-full bg-[#e9efe1]" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-1/3 rounded bg-[#e9efe1]" />
                  <div className="h-3 w-1/2 rounded bg-[#f7f8f4]" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <span className="sr-only">{t("Ładowanie…")}</span>
      </main>
    </div>
  );
}
