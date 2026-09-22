import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronDown, FileLock2, Scale } from "lucide-react";
import { BeautyDocsLegalPrint } from "./BeautyDocsLegalPrint";
import { BeautyDocsMarketingFooter } from "../marketing/BeautyDocsMarketingFooter";
import { BeautyDocsMarketingHeader } from "../marketing/BeautyDocsMarketingHeader";

export interface BeautyDocsLegalSection {
  readonly id: string;
  readonly title: string;
  readonly content: ReactNode;
}

interface BeautyDocsLegalPageProps {
  readonly activeDocument: "privacy" | "terms";
  readonly description: string;
  readonly lastUpdated: string;
  readonly notice?: ReactNode;
  readonly sections: readonly BeautyDocsLegalSection[];
  readonly title: string;
}

const legalDocuments = [
  {
    key: "privacy",
    label: "Polityka prywatności",
    href: "/polityka-prywatnosci",
    Icon: FileLock2,
  },
  {
    key: "terms",
    label: "Regulamin platformy",
    href: "/regulamin",
    Icon: Scale,
  },
] as const;

export function BeautyDocsLegalPage({
  activeDocument,
  description,
  lastUpdated,
  notice,
  sections,
  title,
}: BeautyDocsLegalPageProps) {
  const contents = (
    <ol>{sections.map((section, index) => (
      <li key={section.id}>
        <a href={`#${section.id}`}><span>{String(index + 1).padStart(2, "0")}</span>{section.title}</a>
      </li>
    ))}</ol>
  );

  return (
    <div className="bd-public-page bd-legal-page">
      <a className="bd-skip" href="#glowna-tresc">Przejdź do dokumentu</a>
      <BeautyDocsMarketingHeader />
      <main id="glowna-tresc" className="bd-container bd-legal-main">
        <header className="bd-legal-intro" id="dokument-poczatek">
          <p className="bd-eyebrow"><span className="bd-dot" /> BeautyDocs / Dokumenty prawne</p>
          <h1>{title}</h1>
          <p className="bd-description">{description}</p>
          <div className="bd-legal-meta"><p>Ostatnia aktualizacja: <strong>{lastUpdated}</strong></p><BeautyDocsLegalPrint /></div>
        </header>
        <nav className="bd-legal-documents" aria-label="Dokumenty prawne">
          {legalDocuments.map(({ key, label, href, Icon }) => (
            <Link key={key} href={href} aria-current={key === activeDocument ? "page" : undefined}>
              <Icon size={17} aria-hidden="true" />{label}
            </Link>
          ))}
        </nav>
        <div className="bd-legal-layout">
          <aside className="bd-legal-sidebar">
            <nav className="bd-legal-desktop-contents" aria-label="Spis treści"><h2>W tym dokumencie</h2>{contents}</nav>
            <details className="bd-legal-mobile-contents"><summary>Spis treści <ChevronDown size={17} aria-hidden="true" /></summary><nav aria-label="Spis treści">{contents}</nav></details>
            <Link className="bd-legal-help" href="/kontakt">Masz pytania? <ArrowUpRight size={16} aria-hidden="true" /></Link>
          </aside>
          <article className="bd-legal-document" aria-label={title}>
            {notice ? <div className="bd-legal-notice">{notice}</div> : null}
            {sections.map((section, index) => (
              <section className="bd-legal-section" id={section.id} key={section.id}>
                <div className="bd-legal-section-heading"><span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span><h2>{section.title}</h2></div>
                <div className="bd-legal-prose">{section.content}</div>
              </section>
            ))}
            <div className="bd-legal-end"><span>BeautyDocs / {title}</span><a href="#dokument-poczatek">Wróć na początek ↑</a></div>
          </article>
        </div>
      </main>
      <BeautyDocsMarketingFooter />
    </div>
  );
}
