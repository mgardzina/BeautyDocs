"use client";
import { useT } from "../i18n";
import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Images, X } from "lucide-react";
import type { PublicSalon } from "@/types/beautydocs-salon";

export function SalonGallery({ photos, name }: { photos: PublicSalon["photos"]; name: string }) {
  const t = useT();
  const dialog = useRef<HTMLDialogElement>(null);
  const [active, setActive] = useState(0);
  const opener = useRef<HTMLButtonElement | null>(null);
  if (!photos.length) return <div className="bd-salon-cover-placeholder"><span>{name.slice(0, 1)}</span><p>{t("Przestrzeń dla Ciebie.")}</p></div>;
  const open = (index: number, button: HTMLButtonElement) => { opener.current = button; setActive(index); dialog.current?.showModal(); };
  return <><div className={`bd-salon-gallery photos-${Math.min(photos.length, 3)}`}>{photos.slice(0, 3).map((photo, i) => <button key={photo.url} onClick={event => open(i, event.currentTarget)} aria-label={t("Powiększ zdjęcie {value1}: {value2}", { value1: i + 1, value2: photo.caption || name })}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.url} alt={photo.caption || t("{name} — zdjęcie {value2}", { name: name, value2: i + 1 })} />{i === 0 && <span><Images size={17} />{" "}{t("Wszystkie zdjęcia ·")}{" "}{photos.length}</span>}
  </button>)}</div><dialog aria-label={t("Galeria salonu {name}", { name: name })} className="bd-gallery-dialog" ref={dialog} onClose={() => opener.current?.focus()} onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }} onKeyDown={event => { if (event.key === "ArrowRight") { event.preventDefault(); setActive(i => (i + 1) % photos.length); } if (event.key === "ArrowLeft") { event.preventDefault(); setActive(i => (i + photos.length - 1) % photos.length); } }}><div className="bd-gallery-inner"><button className="bd-gallery-close" aria-label={t("Zamknij galerię")} onClick={() => dialog.current?.close()}><X /></button>
    {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photos[active].url} alt={photos[active].caption || t("{name} — zdjęcie {value2}", { name: name, value2: active + 1 })} /><div className="bd-gallery-controls"><button aria-label={t("Poprzednie zdjęcie")} disabled={photos.length === 1} onClick={() => setActive(i => (i + photos.length - 1) % photos.length)}><ArrowLeft /></button><p aria-live="polite">{active + 1} / {photos.length}{photos[active].caption && ` · ${photos[active].caption}`}</p><button aria-label={t("Następne zdjęcie")} disabled={photos.length === 1} onClick={() => setActive(i => (i + 1) % photos.length)}><ArrowRight /></button></div></div></dialog></>;
}
