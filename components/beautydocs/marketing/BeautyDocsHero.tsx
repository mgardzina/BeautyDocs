"use client";

import { useT } from "../i18n";
import Link from "next/link";
import { ArrowRight, Check, FileCheck2, UsersRound, LayoutDashboard, Files, Settings2, Search, Plus, ArrowUpRight } from "lucide-react";

export function BeautyDocsHero() {
  const t = useT();
  return (
    <section className="bd-hero" id="poczatek">
      <div className="bd-container">
        <div className="bd-hero-copy">
          <p className="bd-eyebrow"><span className="bd-dot" />{" "}{t("Dla ludzi, którzy dbają o innych")}</p>
          <h1>{t("Mniej dokumentów.")}<br />{t("Więcej")}{" "}<span className="bd-serif">{t("beauty.")}</span></h1>
          <p>{t("Wywiady, zgody i historia klientek w jednym miejscu.")}<br className="hidden sm:block" />{" "}{t("Ty zajmujesz się salonem. BeautyDocs pomaga zadbać o resztę.")}</p>
          <div className="bd-hero-actions"><Link className="bd-button bd-button-primary" href="/konto?mode=register">{t("Uporządkuj swój salon")}{" "}<ArrowRight size={18} aria-hidden="true" /></Link><Link className="bd-button bd-button-outline" href="#jak-to-dziala">{t("Zobacz, jak to działa")}</Link></div>
          <div className="bd-hero-notes"><span><Check size={15} aria-hidden="true" />{" "}{t("Formularze online")}</span><span><Check size={15} aria-hidden="true" />{" "}{t("Jeden panel dla zespołu")}</span></div>
        </div>
        <figure className="bd-product-scene">
          <div className="bd-product-window">
            <aside className="bd-preview-sidebar" aria-hidden="true"><strong>{t("BeautyDocs")}<span>{t("TWÓJ SALON")}</span></strong>{[[LayoutDashboard,t("Pulpit")],[UsersRound,t("Klientki")],[Files,t("Dokumenty")],[Settings2,t("Ustawienia")]].map(([Icon,label],i) => { const ItemIcon = Icon as typeof Files; return <div className={i === 0 ? "selected" : ""} key={String(label)}><ItemIcon size={17} />{String(label)}</div>; })}<p><span>{t("AS")}</span>{" "}{t("Atelier Studio")}</p></aside>
            <div className="bd-preview-main">
              <div className="bd-preview-top"><span>{t("Twój salon / Pulpit")}</span><span aria-hidden="true"><Search size={16} />{" "}{t("AS")}</span></div>
              <div className="bd-preview-title"><div><p>{t("Wszystko na swoim miejscu")}</p><h2>{t("Dzień dobry, Anno")}{" "}<span aria-hidden="true">✳</span></h2></div><span className="bd-preview-add"><Plus size={14} aria-hidden="true" />{" "}{t("Nowy formularz")}</span></div>
              <div className="bd-preview-stats"><div><span><UsersRound size={16} aria-hidden="true" />{" "}{t("Kartoteka klientek")}</span><strong>128<small>{t("W jednym miejscu")}</small></strong></div><div><span><FileCheck2 size={16} aria-hidden="true" />{" "}{t("Podpisane dokumenty")}</span><strong>96<small>{t("Gotowe do wglądu")}</small></strong></div><div><span><Files size={16} aria-hidden="true" />{" "}{t("Aktywne formularze")}</span><strong>8<small>{t("Dopasowane do usług")}</small></strong></div></div>
              <div className="bd-preview-documents"><h3>{t("Ostatnie dokumenty")}{" "}<ArrowUpRight size={16} aria-hidden="true" /></h3><div className="bd-preview-table-head"><span>{t("Klientka / zabieg")}</span><span>{t("Status")}</span></div>{[{initials:"MK",name:t("Maria K."),service:t("Pielęgnacja twarzy"),done:true},{initials:"JW",name:t("Julia W."),service:t("Stylizacja brwi"),done:true},{initials:"AZ",name:t("Aleksandra Z."),service:t("Konsultacja kosmetologiczna"),done:false}].map(row => <div className="bd-preview-row" key={row.initials}><span className="bd-avatar">{row.initials}</span><div><strong>{row.name}</strong><span>{row.service}</span></div><span className={row.done ? "bd-status" : "bd-status bd-status-pending"}>{row.done ? <Check size={12} aria-hidden="true" /> : null}{row.done ? t("Podpisano") : t("Do podpisu")}</span></div>)}</div>
            </div>
          </div>
          <figcaption><span className="bd-dot" />{" "}{t("Przykładowy widok panelu · fikcyjne dane")}</figcaption>
        </figure>
        <div className="bd-audiences"><span>{t("Twój standard pracy. Niezależnie od specjalizacji.")}</span><div><strong>{t("Kosmetologia")}</strong><strong>{t("Stylizacja brwi")}</strong><strong>{t("Medycyna estetyczna")}</strong><strong>{t("Pielęgnacja")}</strong></div></div>
      </div>
    </section>
  );
}
