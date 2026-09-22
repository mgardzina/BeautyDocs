import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
export function BeautyDocsFinalCta() {
  return <section className="bd-final"><div className="bd-container"><p className="bd-eyebrow">Mniej papieru. Więcej przestrzeni.</p><h2 className="bd-heading">Zadbaj o swój salon.<br /><span className="bd-serif">Tak jak o swoje klientki.</span></h2><Link className="bd-button bd-button-primary" href="/konto?mode=register">Zacznij z BeautyDocs <ArrowUpRight size={18} aria-hidden="true" /></Link></div></section>;
}
