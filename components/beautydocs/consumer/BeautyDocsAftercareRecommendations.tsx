"use client";

import { useT } from "../i18n";
import { Info, LoaderCircle, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import type { BeautyDocsConsumerAftercare } from "@/types/beautydocs-catalog";

export function BeautyDocsAftercareRecommendations({
  tenantSlug,
  treatmentCode,
}: {
  readonly tenantSlug: string;
  readonly treatmentCode: string;
}) {
  const t = useT();
  const [result, setResult] = useState<BeautyDocsConsumerAftercare | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const params = new URLSearchParams({ tenantSlug, treatmentCode });
      try {
        const response = await fetch(
          `/api/beautydocs-preview/consumer/catalog/recommendations?${params}`,
          { cache: "no-store", credentials: "same-origin" },
        );
        if (!cancelled && response.ok) {
          setResult((await response.json()) as BeautyDocsConsumerAftercare);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantSlug, treatmentCode]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-[#e2e7da] px-5 py-4 text-xs font-bold text-stone-500">
        <LoaderCircle className="size-4 animate-spin" />{" "}{t("Pobieranie zaleceń salonu…")}
      </div>
    );
  }
  if (!result || result.items.length === 0) return null;

  return (
    <section className="rounded-2xl border border-[#dfe5d7] bg-[#f8fbf5] p-5">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#245c4d]">
        {t("Pielęgnacja po zabiegu")}
      </p>
      <h3 className="mt-1 text-lg font-black text-[#173d35]">{t("Kosmetyki polecone przez salon")}</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {result.items.map((item) => (
          <article className="rounded-2xl border border-[#e1e6da] bg-white p-4" key={item.id}>
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-700">
                <Sparkles className="size-4" />
              </span>
              <div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="rounded-full bg-[#eef3e6] px-2 py-1 text-[9px] font-black text-[#457a6d]">
                    {t("Polecenie salonu")}
                  </span>
                  {item.isSponsored ? (
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-[9px] font-black text-amber-900">
                      {t("Materiał sponsorowany")}
                    </span>
                  ) : null}
                </div>
                <h4 className="mt-2 text-sm font-black text-[#173d35]">{item.name}</h4>
                {item.brand ? <p className="text-xs text-stone-500">{item.brand}</p> : null}
              </div>
            </div>
            {item.recommendationNote ? (
              <p className="mt-3 text-xs leading-5 text-stone-600">
                {t(item.recommendationNote)}
              </p>
            ) : null}
          </article>
        ))}
      </div>
      <p className="mt-4 flex gap-2 text-xs leading-5 text-stone-500">
        <Info className="mt-0.5 size-4 shrink-0 text-[#245c4d]" /> {result.notice}
      </p>
    </section>
  );
}
