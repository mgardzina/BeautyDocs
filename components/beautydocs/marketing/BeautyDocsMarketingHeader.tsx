"use client";

import { BeautyDocsLanguageMenu, useT } from "../i18n";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { BeautyDocsWordmark } from "../BeautyDocsWordmark";
import { BeautyDocsHeaderNav } from "./BeautyDocsHeaderNav";

export function BeautyDocsMarketingHeader() {
  const t = useT();
  return <header className="bd-header"><div className="bd-header-inner">
    <Link className="bd-logo" aria-label={t("BeautyDocs — strona główna")} href="/"><span className="bd-brand-symbol" aria-hidden="true">✳</span><BeautyDocsWordmark className="text-[#173d35]" /></Link>
    <BeautyDocsHeaderNav />
    <div className="bd-header-actions"><BeautyDocsLanguageMenu account={null} /><Link className="bd-login" href="/konto?mode=login">{t("Zaloguj się")}</Link><Link className="bd-button bd-button-primary" href="/konto?mode=register">{t("Załóż konto")}{" "}<ArrowUpRight size={16} aria-hidden="true" /></Link></div>
  </div></header>;
}
