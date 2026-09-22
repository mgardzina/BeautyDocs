import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { BeautyDocsWordmark } from "../BeautyDocsWordmark";
import { BeautyDocsHeaderNav } from "./BeautyDocsHeaderNav";

export function BeautyDocsMarketingHeader() {
  return <header className="bd-header"><div className="bd-header-inner">
    <Link className="bd-logo" aria-label="BeautyDocs — strona główna" href="/"><span className="bd-brand-symbol" aria-hidden="true">✳</span><BeautyDocsWordmark className="text-[#173d35]" /></Link>
    <BeautyDocsHeaderNav />
    <div className="bd-header-actions"><Link className="bd-login" href="/konto?mode=login">Zaloguj się</Link><Link className="bd-button bd-button-primary" href="/konto?mode=register">Załóż konto <ArrowUpRight size={16} aria-hidden="true" /></Link></div>
  </div></header>;
}
