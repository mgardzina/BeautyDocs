"use client";

import { useT } from "../i18n";
import { LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { BeautyDocsPublicCatalog } from "@/components/beautydocs/catalog/BeautyDocsPublicCatalog";
import type { BeautyDocsCatalogItem } from "@/types/beautydocs-catalog";

export function BeautyDocsConsumerCatalog() {
  const t = useT();
  const [items, setItems] = useState<readonly BeautyDocsCatalogItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/beautydocs-preview/catalog/products", {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!response.ok) throw new Error(String(response.status));
        const body = (await response.json()) as { items: BeautyDocsCatalogItem[] };
        if (!cancelled) setItems(body.items);
      } catch {
        if (!cancelled) setError(t("Nie udało się pobrać katalogu. Spróbuj ponownie."));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  return (
    <section className="space-y-5">
      <div className="overflow-hidden rounded-[28px] bg-[#173d35] px-6 py-7 text-white shadow-[0_20px_55px_rgba(37,60,54,0.16)] sm:px-8">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#d1e3b8]">
          {t("Sprawdzone informacje i katalog BeautyDocs")}
        </p>
        <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] sm:text-3xl">
          {t("Leki, preparaty, urządzenia i pielęgnacja")}
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-white/65">
          {t("Przeglądaj cały katalog BeautyDocs — dokładnie tak samo, jak na publicznej stronie katalogu. Szukaj leku po nazwie handlowej lub substancji czynnej, porównuj oferty i sprawdzaj podstawowe informacje o preparatach zabiegowych, technologiach i kosmetykach.")}
        </p>
      </div>

      {error ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700" role="alert">
          {error}
        </p>
      ) : items === null ? (
        <div className="flex items-center justify-center gap-2 rounded-[28px] border border-[#e1e6da] bg-white py-16 text-sm font-bold text-stone-600">
          <LoaderCircle className="size-5 animate-spin text-[#245c4d]" />{" "}{t("Wczytywanie katalogu…")}
        </div>
      ) : (
        <BeautyDocsPublicCatalog items={items} stayInPanel />
      )}
    </section>
  );
}
