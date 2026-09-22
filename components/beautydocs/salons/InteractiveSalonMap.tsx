"use client";
import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap } from "leaflet";
import type { PublicSalon } from "@/types/beautydocs-salon";
import { salonPrice } from "@/types/beautydocs-salon";
import { SalonLogo } from "./SalonLogo";
import Link from "next/link";
import "leaflet/dist/leaflet.css";

const EMPTY_SALONS: PublicSalon[] = [];

export default function InteractiveSalonMap({ latitude, longitude, name, salons = EMPTY_SALONS, selectedSlug, onSelect }: { latitude: number; longitude: number; name: string; salons?: PublicSalon[]; selectedSlug?: string; onSelect?: (salon: PublicSalon) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const selectRef = useRef(onSelect); selectRef.current = onSelect;
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const selected = salons.find(salon => salon.slug === selectedSlug);
  useEffect(() => {
    let disposed = false;
    let observer: ResizeObserver | undefined;
    void import("leaflet").then(L => {
      if (disposed || !container.current) return;
      const map = L.map(container.current, { zoomControl: false, scrollWheelZoom: false }).setView([latitude, longitude], 14);
      mapRef.current = map;
      setReady(true);
      L.control.zoom({ position: "topright" }).addTo(map);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).on("tileerror", () => { if (!disposed) setError(true); }).addTo(map);
      observer = new ResizeObserver(() => map.invalidateSize()); observer.observe(container.current);
    }).catch(() => { if (!disposed) setError(true); });
    return () => { disposed = true; observer?.disconnect(); mapRef.current?.remove(); mapRef.current = null; };
    // The map lives for the component lifetime; markers update separately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    let disposed = false;
    if (!ready) return;
    let group: import("leaflet").LayerGroup | undefined;
    void import("leaflet").then(L => {
      if (disposed || !mapRef.current) return;
      const map = mapRef.current;
      group = L.layerGroup().addTo(map);
      const points = salons.filter(s => s.latitude !== null && s.longitude !== null);
      const markers = points.length ? points : [{ latitude, longitude, displayName: name, slug: "location", services: [] }];
      markers.forEach(salon => {
        const pill = document.createElement("span");
        const lowest = salon.services.length ? salon.services.reduce((a, b) => a.price < b.price ? a : b) : null;
        pill.textContent = lowest ? salonPrice({ ...lowest, priceFrom: true }) : salon.displayName;
        pill.className = `bd-map-price ${salon.slug === selectedSlug || !points.length ? "is-selected" : ""}`;
        const marker = L.marker([salon.latitude!, salon.longitude!], { icon: L.divIcon({ html: pill, className: "bd-map-marker", iconSize: [120, 44], iconAnchor: [60, 22] }), title: salon.displayName, keyboard: true, zIndexOffset: salon.slug === selectedSlug ? 1000 : 0 }).addTo(group!);
        marker.on("click", () => { const found = points.find(p => p.slug === salon.slug); if (found) selectRef.current?.(found); });
      });
      map.setView([latitude, longitude], map.getZoom(), { animate: false });
    });
    return () => { disposed = true; group?.remove(); };
  }, [latitude, longitude, name, salons, selectedSlug, ready]);
  return <div className="bd-live-map"><div ref={container} className="bd-live-map-canvas" aria-label={`Mapa salonów: ${name}`} />{error && <p className="bd-map-warning" role="status">Nie udało się wczytać części mapy. Możesz skorzystać z linku do trasy.</p>}{selected && <Link href={`/salony/${selected.slug}`} className="bd-map-floating-card"><SalonLogo url={selected.logoUrl} name={selected.displayName} /><span><strong>{selected.displayName}</strong><small>{[selected.addressLine1, selected.city].filter(Boolean).join(", ")}</small></span><span aria-hidden="true">↗</span></Link>}</div>;
}
