"use client";

import { BeautyDocsLanguageMenu, useT } from "../i18n";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BeautyDocsWordmark } from "../BeautyDocsWordmark";

export function BeautyDocsClientAuthShell({ children }: { readonly children: ReactNode }) {
  const t = useT();
  return <div className="bd-auth-page bd-client-auth">
    <header className="bd-auth-header">
      <Link href="/" aria-label={t("BeautyDocs — strona główna")}><span aria-hidden="true">✳</span><BeautyDocsWordmark /></Link>
      <span className="flex items-center gap-3"><BeautyDocsLanguageMenu account={null} /><Link href="/kontakt">{t("Potrzebujesz pomocy?")}{" "}<ArrowRight size={15} aria-hidden="true" /></Link></span>
    </header>
    <div className="bd-auth-layout">
      <aside className="bd-auth-story">
        <p className="bd-eyebrow">{t("Twoje konto osobiste")}</p>
        <h2>{t("Wszystko blisko.")}<br /><span className="bd-serif">{t("Wszystko dla Ciebie.")}</span></h2>
        <p>{t("Twoje wizyty, dokumenty i kontakt z salonem.")}<br />{t("W jednym spokojnym miejscu.")}</p>
      </aside>
      {children}
    </div>
    <footer className="bd-auth-footer"><span>© {new Date().getFullYear()}{" "}{t("BeautyDocs")}</span><Link href="/polityka-prywatnosci">{t("Prywatność")}</Link><Link href="/regulamin">{t("Regulamin")}</Link></footer>
  </div>;
}
