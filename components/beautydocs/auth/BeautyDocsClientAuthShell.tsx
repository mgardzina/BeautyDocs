import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BeautyDocsWordmark } from "../BeautyDocsWordmark";

export function BeautyDocsClientAuthShell({ children }: { readonly children: ReactNode }) {
  return <div className="bd-auth-page bd-client-auth">
    <header className="bd-auth-header">
      <Link href="/" aria-label="BeautyDocs — strona główna"><span aria-hidden="true">✳</span><BeautyDocsWordmark /></Link>
      <Link href="/kontakt">Potrzebujesz pomocy? <ArrowRight size={15} aria-hidden="true" /></Link>
    </header>
    <div className="bd-auth-layout">
      <aside className="bd-auth-story">
        <p className="bd-eyebrow">Twoje konto osobiste</p>
        <h2>Wszystko blisko.<br /><span className="bd-serif">Wszystko dla Ciebie.</span></h2>
        <p>Twoje wizyty, dokumenty i kontakt z salonem.<br />W jednym spokojnym miejscu.</p>
      </aside>
      {children}
    </div>
    <footer className="bd-auth-footer"><span>© {new Date().getFullYear()} BeautyDocs</span><Link href="/polityka-prywatnosci">Prywatność</Link><Link href="/regulamin">Regulamin</Link></footer>
  </div>;
}
