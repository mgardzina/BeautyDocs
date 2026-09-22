"use client";

import { AlertCircle } from "lucide-react";
import { BeautyDocsHeader } from "../BeautyDocsHeader";

export function BeautyDocsAdminRouteError({ reset }: { readonly reset: () => void }) {
  return (
    <div className="min-h-screen bg-[#f7f8f4] text-[#173d35]">
      <BeautyDocsHeader />
      <main className="mx-auto flex max-w-3xl flex-col items-center px-4 py-24 text-center sm:px-6">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-red-50 text-red-700">
          <AlertCircle aria-hidden="true" className="size-5" />
        </span>
        <h1 className="mt-4 text-3xl font-bold tracking-tight">Nie udało się otworzyć widoku</h1>
        <p className="mt-3 max-w-lg text-sm leading-6 text-stone-600">
          Spróbuj ponownie. Jeśli problem się powtarza, wróć do panelu później.
        </p>
        <button
          className="mt-6 rounded-xl bg-[#245c4d] px-5 py-3 text-sm font-bold text-white hover:bg-[#173d35] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#245c4d] focus-visible:ring-offset-2"
          onClick={reset}
          type="button"
        >
          Spróbuj ponownie
        </button>
      </main>
    </div>
  );
}
