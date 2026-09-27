"use client";

import { useT } from "../i18n";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { BeautyDocsWordmark } from "../BeautyDocsWordmark";

const columns = [
  {
    title: "Platforma",
    links: [
      { label: "Poznaj BeautyDocs", href: "/platforma" },
      { label: "Jak to działa", href: "/#jak-to-dziala" },
      { label: "Cennik", href: "/cennik" },
      { label: "Katalog produktów", href: "/katalog" },
    ],
  },
  {
    title: "Dla Twojego salonu",
    links: [
      { label: "Wywiady i zgody", href: "/platforma#wywiady" },
      { label: "Kartoteka klientek", href: "/platforma#kartoteka" },
      { label: "Formularze", href: "/platforma#formularze" },
      { label: "Panel salonu", href: "/panel" },
    ],
  },
  {
    title: "Bądźmy w kontakcie",
    links: [
      { label: "Znajdź salon", href: "/salony" },
      { label: "Kontakt i wsparcie", href: "/kontakt" },
      { label: "Załóż konto", href: "/konto?mode=register" },
      { label: "Zaloguj się", href: "/konto?mode=login" },
    ],
  },
];

export function BeautyDocsMarketingFooter() {
  const t = useT();
  return (
    <footer className="bd-footer bd-footer-editorial">
      <div className="bd-container">
        <div className="bd-footer-editorial-top">
          <nav className="bd-footer-columns" aria-label={t("Nawigacja w stopce")}>
            {columns.map(column => (
              <div key={column.title}>
                <h2>{t(column.title)}</h2>
                <ul>{column.links.map(link => (
                  <li key={link.href}><Link href={link.href}>{t(link.label)}</Link></li>
                ))}</ul>
              </div>
            ))}
          </nav>
          <div className="bd-footer-invitation">
            <p className="bd-footer-label">{t("Przestrzeń dla Twojego salonu")}</p>
            <p className="bd-footer-message">{t("Dobry porządek.")}<br /><span className="bd-serif">{t("Jeszcze lepszy dzień.")}</span></p>
            <Link className="bd-footer-contact" href="/kontakt">
              {t("Porozmawiajmy o Twoim salonie")}
              <span><ArrowUpRight size={22} aria-hidden="true" /></span>
            </Link>
          </div>
        </div>
        <div className="bd-footer-signature">
          <Link href="/" aria-label={t("BeautyDocs — strona główna")} className="bd-footer-brand">
            <span aria-hidden="true">✳</span><BeautyDocsWordmark className="text-white" />
          </Link>
          <p>{t("Z troską o ludzi.")}<br />{t("Z myślą o Twoim salonie.")}</p>
        </div>
        <div className="bd-footer-bottom">
          <span>© {new Date().getFullYear()}{" "}{t("BeautyDocs")}</span>
          <nav aria-label={t("Dokumenty prawne")}>
            <Link href="/polityka-prywatnosci">{t("Polityka prywatności")}</Link>
            <Link href="/regulamin">{t("Regulamin platformy")}</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
