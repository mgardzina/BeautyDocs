"use client";

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
      node.textContent = value.toLocaleString("pl-PL");
    };
    if (media.matches || !('IntersectionObserver' in window)) { finish(); return; }
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      const started = performance.now();
      const tick = (now: number) => {
        const progress = Math.min((now - started) / 1000, 1);
        node.textContent = Math.round(value * (1 - Math.pow(1 - progress, 3))).toLocaleString("pl-PL");
        if (progress < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }, { threshold: 0.5 });
    observer.observe(node);
    media.addEventListener("change", finish);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); media.removeEventListener("change", finish); };
  }, [value]);
  return <><span className="sr-only">{value.toLocaleString("pl-PL")}</span><span ref={ref} aria-hidden="true">{value.toLocaleString("pl-PL")}</span></>;
}

export function BeautyDocsStats({ data }: { readonly data: BeautyDocsStatsData | null }) {
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
    { value: stats.companyCount, label: "Firm z aktywnym kontem", detail: "Unikalne numery NIP aktywnych salonów. Kilka lokalizacji jednej firmy liczymy raz." },
    { value: stats.signedFormCount, label: "Podpisanych formularzy", detail: "Dokumenty aktywnych salonów z zakończonym podpisem. Bez szkiców i niepodpisanych zgłoszeń." },
    { value: stats.availableFormCount, label: "Dostępnych formularzy", detail: "Aktywne szablony w bibliotece BeautyDocs, gotowe do wykorzystania w salonie." },
  ] : [];
  return <section className="bd-section bd-real-stats" id="liczby" aria-labelledby="liczby-tytul"><div className="bd-container">
    <div className="bd-section-heading"><p className="bd-eyebrow">BeautyDocs w liczbach</p><h2 className="bd-heading" id="liczby-tytul">Codzienna praca.<br /><span className="bd-serif">Rzeczywiste liczby.</span></h2></div>
    {stats ? <dl className="bd-real-stats-grid">{cards.map(card => <div className="bd-real-stat" key={card.label}><dt>{card.label}</dt><dd><AnimatedCount value={card.value} /></dd><p>{card.detail}</p></div>)}</dl> : null}
    <p className="bd-stats-status" role="status">{unavailable ? stats ? "Nie udało się odświeżyć danych. Pokazujemy ostatnio pobrane wartości." : "Statystyki są chwilowo niedostępne. Spróbujemy pobrać je ponownie." : "Dane z BeautyDocs · odświeżane co minutę"}</p>
  </div></section>;
}
