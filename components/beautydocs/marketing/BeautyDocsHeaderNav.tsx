"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, ArrowUpRight } from "lucide-react";

const links = [{ label: "Platforma", href: "/platforma" }, { label: "Salony", href: "/salony" }, { label: "Cennik", href: "/cennik" }, { label: "Katalog", href: "/katalog" }];

export function BeautyDocsHeaderNav() {
  const [open, setOpen] = useState(false);
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false); };
    const closeEscape = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); button.current?.focus(); } };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    return () => { document.removeEventListener("pointerdown", closeOutside); document.removeEventListener("keydown", closeEscape); };
  }, [open]);
  return <div className="bd-navigation" ref={ref} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <button className="bd-menu-button" type="button" ref={button} aria-controls={id} aria-expanded={open} aria-label={open ? "Zamknij nawigację" : "Otwórz nawigację"} onClick={() => setOpen(value => !value)}>{open ? <X size={21} /> : <Menu size={21} />}</button>
    <nav id={id} aria-label="Główna nawigacja" className={`bd-nav-links ${open ? "is-open" : ""}`}>
      {links.map(link => <Link key={link.href} href={link.href} aria-current={(pathname === link.href || (["/katalog", "/salony"].includes(link.href) && pathname.startsWith(`${link.href}/`))) ? "page" : undefined} onClick={() => setOpen(false)}>{link.label}</Link>)}
      <Link className="bd-mobile-link" href="/kontakt" onClick={() => setOpen(false)}>Kontakt <ArrowUpRight size={16} aria-hidden="true" /></Link>
      <Link className="bd-mobile-link" href="/konto?mode=login" onClick={() => setOpen(false)}>Zaloguj się <ArrowUpRight size={16} aria-hidden="true" /></Link>
    </nav>
  </div>;
}
