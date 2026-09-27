"use client";

import { useT } from "../i18n";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, MapPin, Search, Store, X } from "lucide-react";
import { salonPrice, type PublicSalon, type SalonSearchResult } from "@/types/beautydocs-salon";
import { SalonMap } from "./SalonMap";
import { SalonLogo } from "./SalonLogo";

export function SalonDiscovery() {
  const t = useT();
  const mapPanel = useRef<HTMLElement>(null);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<PublicSalon[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState<PublicSalon | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true); setError(false);
      try {
        const response = await fetch(`/api/beautydocs-preview/salons?query=${encodeURIComponent(query)}&offset=${offset}`, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error();
        const data: SalonSearchResult = await response.json();
        if (!controller.signal.aborted) { setItems(items => offset === 0 ? data.items : [...items, ...data.items]); setNextOffset(data.nextOffset); }
      } catch { if (!controller.signal.aborted) setError(true); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, offset, retry]);
  useEffect(() => { if (selected) { mapPanel.current?.focus({ preventScroll: true }); mapPanel.current?.scrollIntoView({ block: "nearest" }); } }, [selected]);
  function search(value: string) { setQuery(value); setOffset(0); setItems([]); setSelected(null); setLoading(true); }
  return <>
    <div className="bd-salon-search"><Search aria-hidden="true" size={23} /><label className="sr-only" htmlFor="salon-search">{t("Salon, miasto lub usługa")}</label><input id="salon-search" maxLength={100} value={query} onChange={e => search(e.target.value)} placeholder={t("Salon, miasto lub usługa")} type="search" />{query && <button aria-label={t("Wyczyść wyszukiwanie")} onClick={() => search("")}><X size={20} /></button>}</div>
    <div className="bd-discovery-toolbar"><p aria-live="polite">{loading ? t("Szukamy Twojego miejsca…") : error ? t("Wyszukiwanie niedostępne") : t("{length}{value2} salonów do poznania", { length: items.length, value2: nextOffset !== null ? "+" : "" })}</p><span>{t("Poznaj miejsce. Wybierz świadomie.")}</span></div>
    {error && <div className="bd-salon-empty" role="alert"><h2>{t("Nie udało się wczytać salonów.")}</h2><button className="bd-button bd-button-secondary" onClick={() => setRetry(v => v + 1)}>{t("Spróbuj ponownie")}</button></div>}
    {!loading && !error && items.length === 0 && <div className="bd-salon-empty"><Store size={36} /><h2>{query ? t("Jeszcze nie znaleźliśmy tego miejsca.") : t("Pierwsze salony pojawią się tutaj.")}</h2><p>{query ? t("Spróbuj innej nazwy, miasta lub usługi.") : t("Właściciele przygotowują swoje wizytówki. Zajrzyj ponownie.")}</p>{query && <button className="bd-button bd-button-secondary" onClick={() => search("")}>{t("Zobacz wszystkie salony")}</button>}</div>}
    <div className={`bd-discovery-layout ${selected ? "has-map" : ""}`}><div className="bd-salon-grid" aria-busy={loading}>{items.map(salon => {
      const lowest = salon.services.length ? salon.services.reduce((a, b) => a.price < b.price ? a : b) : null;
      return <article className="bd-salon-card" key={salon.slug}><Link className="bd-salon-card-main" href={`/salony/${salon.slug}`}><div className="bd-salon-cover">{salon.photos[0] ? <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={salon.photos[0].url} alt={salon.photos[0].caption || salon.displayName} loading="lazy" />
      </> : <div className="bd-salon-monogram"><span>{salon.displayName.slice(0, 1)}</span><small>{t("Poznaj salon")}</small></div>}<span className="bd-salon-open"><ArrowUpRight size={20} /></span></div><div className="bd-salon-card-copy"><p className="bd-eyebrow">{salon.city || "BeautyDocs"}</p><h2><SalonLogo url={salon.logoUrl} name={salon.displayName} />{salon.displayName}</h2><p>{salon.introduction || [salon.addressLine1, salon.city].filter(Boolean).join(", ") || t("Poznaj ofertę i atmosferę tego miejsca.")}</p><div className="bd-salon-card-bottom"><span>{lowest ? t("Usługi od {value1}", { value1: salonPrice({ ...lowest, priceFrom: false }) }) : t("Poznaj ofertę salonu")}</span><ArrowUpRight size={17} /></div></div></Link>{salon.latitude !== null && salon.longitude !== null && <button className="bd-salon-map-button" onClick={() => setSelected(salon)} aria-pressed={selected?.slug === salon.slug}><MapPin size={16} />{" "}{t("Pokaż na mapie")}</button>}</article>;
    })}</div>{selected && <aside ref={mapPanel} tabIndex={-1} aria-label={t("Mapa: {displayName}", { displayName: selected.displayName })} className="bd-discovery-map"><div><h2>{selected.displayName}</h2><button aria-label={t("Zamknij mapę")} onClick={() => setSelected(null)}><X size={20} /></button></div><SalonMap latitude={selected.latitude} longitude={selected.longitude} address={[selected.addressLine1, selected.city].filter(Boolean).join(", ")} name={selected.displayName} salons={items} selectedSlug={selected.slug} onSelect={setSelected} /><Link className="bd-button bd-button-primary" href={`/salony/${selected.slug}`}>{t("Poznaj salon")}{" "}<ArrowUpRight size={17} /></Link></aside>}</div>
    {nextOffset !== null && !error && <div className="bd-salon-load"><button className="bd-button bd-button-secondary" disabled={loading} onClick={() => setOffset(nextOffset)}>{loading ? t("Wczytywanie…") : t("Pokaż kolejne salony")}</button></div>}
  </>;
}
