"use client";
import { activeIntlLocale } from "../../../lib/i18n/active";

import { useT } from "../i18n";
import { useEffect, useRef, useState } from "react";
import { parsePlatformStats, type PlatformStats } from "@/lib/beautydocs-api-contract";

export type BeautyDocsStatsData = PlatformStats;

/** The accessible/SSR value is always exact. Only the decorative visual counts up. */
function AnimatedCount({ value }: { readonly value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    const finish = () => {
      cancelAnimationFrame(frame);
      node.textContent = value.toLocaleString(activeIntlLocale());
    };
    if (media.matches || !('IntersectionObserver' in window)) { finish(); return; }
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      const started = performance.now();
      const tick = (now: number) => {
        const progress = Math.min((now - started) / 1000, 1);
        node.textContent = Math.round(value * (1 - Math.pow(1 - progress, 3))).toLocaleString(activeIntlLocale());
        if (progress < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }, { threshold: 0.5 });
    observer.observe(node);
    media.addEventListener("change", finish);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); media.removeEventListener("change", finish); };
  }, [value]);
  return <><span className="sr-only">{value.toLocaleString(activeIntlLocale())}</span><span ref={ref} aria-hidden="true">{value.toLocaleString(activeIntlLocale())}</span></>;
}

export function BeautyDocsStats({ data }: { readonly data: BeautyDocsStatsData | null }) {
  const t = useT();
  const [stats, setStats] = useState(data);
  const [unavailable, setUnavailable] = useState(data === null);
  useEffect(() => {
    let controller: AbortController | undefined;
    let disposed = false;
    async function refresh() {
      if (document.hidden) return;
      controller?.abort();
      controller = new AbortController();
      try {
        const response = await fetch("/api/beautydocs-preview/platform-stats", { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Stats unavailable");
        const result = await response.json();
        if (result.status !== "ok") throw new Error("Stats unavailable");
        const next = parsePlatformStats(result.stats);
        if (!disposed) { setStats(next); setUnavailable(false); }
      } catch (error) {
        if (!disposed && !(error instanceof DOMException && error.name === "AbortError")) setUnavailable(true);
      }
    }
    const interval = window.setInterval(refresh, 60_000);
    document.addEventListener("visibilitychange", refresh);
    return () => { disposed = true; controller?.abort(); clearInterval(interval); document.removeEventListener("visibilitychange", refresh); };
  }, []);

  const cards = stats ? [
    { value: stats.companyCount, label: t("Firm z aktywnym kontem"), detail: t("Unikalne numery NIP aktywnych salonów. Kilka lokalizacji jednej firmy liczymy raz.") },
    { value: stats.signedFormCount, label: t("Podpisanych formularzy"), detail: t("Dokumenty aktywnych salonów z zakończonym podpisem. Bez szkiców i niepodpisanych zgłoszeń.") },
    { value: stats.availableFormCount, label: t("Dostępnych formularzy"), detail: t("Aktywne szablony w bibliotece BeautyDocs, gotowe do wykorzystania w salonie.") },
  ] : [];
  return <section className="bd-section bd-real-stats" id="liczby" aria-labelledby="liczby-tytul"><div className="bd-container">
    <div className="bd-section-heading"><p className="bd-eyebrow">{t("BeautyDocs w liczbach")}</p><h2 className="bd-heading" id="liczby-tytul">{t("Codzienna praca.")}<br /><span className="bd-serif">{t("Rzeczywiste liczby.")}</span></h2></div>
    {stats ? <dl className="bd-real-stats-grid">{cards.map(card => <div className="bd-real-stat" key={card.label}><dt>{t(card.label)}</dt><dd><AnimatedCount value={card.value} /></dd><p>{t(card.detail)}</p></div>)}</dl> : null}
    <p className="bd-stats-status" role="status">{unavailable ? stats ? t("Nie udało się odświeżyć danych. Pokazujemy ostatnio pobrane wartości.") : t("Statystyki są chwilowo niedostępne. Spróbujemy pobrać je ponownie.") : t("Dane z BeautyDocs · odświeżane co minutę")}</p>
  </div></section>;
}
