"use client";

import { useT } from "../i18n";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
export function BeautyDocsFinalCta() {
  const t = useT();
  return <section className="bd-final"><div className="bd-container"><p className="bd-eyebrow">{t("Mniej papieru. Więcej przestrzeni.")}</p><h2 className="bd-heading">{t("Zadbaj o swój salon.")}<br /><span className="bd-serif">{t("Tak jak o swoje klientki.")}</span></h2><Link className="bd-button bd-button-primary" href="/konto?mode=register">{t("Zacznij z BeautyDocs")}{" "}<ArrowUpRight size={18} aria-hidden="true" /></Link></div></section>;
}
