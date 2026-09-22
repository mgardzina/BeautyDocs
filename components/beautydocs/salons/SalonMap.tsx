"use client";
import dynamic from "next/dynamic";
import type { PublicSalon } from "@/types/beautydocs-salon";
const InteractiveSalonMap = dynamic(() => import("./InteractiveSalonMap"), { ssr: false, loading: () => <div className="bd-salon-map-empty" role="status">Wczytywanie mapy…</div> });
import { MapPin, ArrowUpRight } from "lucide-react";

export function SalonMap({ latitude, longitude, address, name, salons, selectedSlug, onSelect }: { latitude: number | null; longitude: number | null; address: string; name: string; salons?: PublicSalon[]; selectedSlug?: string; onSelect?: (salon: PublicSalon) => void }) {
  const hasCoordinates = latitude !== null && longitude !== null;
  const destination = hasCoordinates ? `${latitude},${longitude}` : `${name} ${address}`;
  return <div className="bd-salon-map">
    {hasCoordinates ? <InteractiveSalonMap latitude={latitude} longitude={longitude} name={name} salons={salons} selectedSlug={selectedSlug} onSelect={onSelect} /> : <div className="bd-salon-map-empty"><MapPin size={32} /><p>{address || "Salon nie podał jeszcze adresu."}</p></div>}
    {(address || hasCoordinates) && <a className="bd-map-directions" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`}>Wyznacz trasę <ArrowUpRight size={17} /></a>}
  </div>;
}
