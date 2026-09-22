import Link from "next/link";
import { ArrowRight, Check, FileCheck2, UsersRound, LayoutDashboard, Files, Settings2, Search, Plus, ArrowUpRight } from "lucide-react";

export function BeautyDocsHero() {
  return (
    <section className="bd-hero" id="poczatek">
      <div className="bd-container">
        <div className="bd-hero-copy">
          <p className="bd-eyebrow"><span className="bd-dot" /> Dla ludzi, którzy dbają o innych</p>
          <h1>Mniej dokumentów.<br />Więcej <span className="bd-serif">beauty.</span></h1>
          <p>Wywiady, zgody i historia klientek w jednym miejscu.<br className="hidden sm:block" /> Ty zajmujesz się salonem. BeautyDocs pomaga zadbać o resztę.</p>
          <div className="bd-hero-actions"><Link className="bd-button bd-button-primary" href="/konto?mode=register">Uporządkuj swój salon <ArrowRight size={18} aria-hidden="true" /></Link><Link className="bd-button bd-button-outline" href="#jak-to-dziala">Zobacz, jak to działa</Link></div>
          <div className="bd-hero-notes"><span><Check size={15} aria-hidden="true" /> Formularze online</span><span><Check size={15} aria-hidden="true" /> Jeden panel dla zespołu</span></div>
        </div>
        <figure className="bd-product-scene">
          <div className="bd-product-window">
            <aside className="bd-preview-sidebar" aria-hidden="true"><strong>BeautyDocs<span>TWÓJ SALON</span></strong>{[[LayoutDashboard,"Pulpit"],[UsersRound,"Klientki"],[Files,"Dokumenty"],[Settings2,"Ustawienia"]].map(([Icon,label],i) => { const ItemIcon = Icon as typeof Files; return <div className={i === 0 ? "selected" : ""} key={String(label)}><ItemIcon size={17} />{String(label)}</div>; })}<p><span>AS</span> Atelier Studio</p></aside>
            <div className="bd-preview-main">
              <div className="bd-preview-top"><span>Twój salon / Pulpit</span><span aria-hidden="true"><Search size={16} /> AS</span></div>
              <div className="bd-preview-title"><div><p>Wszystko na swoim miejscu</p><h2>Dzień dobry, Anno <span aria-hidden="true">✳</span></h2></div><span className="bd-preview-add"><Plus size={14} aria-hidden="true" /> Nowy formularz</span></div>
              <div className="bd-preview-stats"><div><span><UsersRound size={16} aria-hidden="true" /> Kartoteka klientek</span><strong>128<small>W jednym miejscu</small></strong></div><div><span><FileCheck2 size={16} aria-hidden="true" /> Podpisane dokumenty</span><strong>96<small>Gotowe do wglądu</small></strong></div><div><span><Files size={16} aria-hidden="true" /> Aktywne formularze</span><strong>8<small>Dopasowane do usług</small></strong></div></div>
              <div className="bd-preview-documents"><h3>Ostatnie dokumenty <ArrowUpRight size={16} aria-hidden="true" /></h3><div className="bd-preview-table-head"><span>Klientka / zabieg</span><span>Status</span></div>{[{initials:"MK",name:"Maria K.",service:"Pielęgnacja twarzy",done:true},{initials:"JW",name:"Julia W.",service:"Stylizacja brwi",done:true},{initials:"AZ",name:"Aleksandra Z.",service:"Konsultacja kosmetologiczna",done:false}].map(row => <div className="bd-preview-row" key={row.initials}><span className="bd-avatar">{row.initials}</span><div><strong>{row.name}</strong><span>{row.service}</span></div><span className={row.done ? "bd-status" : "bd-status bd-status-pending"}>{row.done ? <Check size={12} aria-hidden="true" /> : null}{row.done ? "Podpisano" : "Do podpisu"}</span></div>)}</div>
            </div>
          </div>
          <figcaption><span className="bd-dot" /> Przykładowy widok panelu · fikcyjne dane</figcaption>
        </figure>
        <div className="bd-audiences"><span>Twój standard pracy. Niezależnie od specjalizacji.</span><div><strong>Kosmetologia</strong><strong>Stylizacja brwi</strong><strong>Medycyna estetyczna</strong><strong>Pielęgnacja</strong></div></div>
      </div>
    </section>
  );
}
