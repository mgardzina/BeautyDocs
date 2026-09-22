import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  ClipboardCheck,
  FileText,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  BeautyDocsFinalCta,
  BeautyDocsMarketingFooter,
  BeautyDocsMarketingHeader,
} from "../../components/beautydocs/marketing";
import { PlatformFeatureMock } from "../../components/beautydocs/marketing/platform-feature-mocks";

export const metadata: Metadata = {
  title: { absolute: "Platforma BeautyDocs — dokumentacja salonu beauty" },
  description:
    "Poznaj platformę BeautyDocs: wywiady i zgody online, kartoteka klientek, formularze pod usługi oraz zgodność z RODO w jednym panelu.",
  robots: { index: true, follow: true },
};

interface PlatformSection {
  readonly id: string;
  readonly eyebrow: string;
  readonly title: string;
  readonly accent: string;
  readonly description: string;
  readonly bullets: readonly string[];
  readonly Icon: LucideIcon;
}

const sections: readonly PlatformSection[] = [
  {
    id: "wywiady",
    eyebrow: "Wywiady i zgody",
    title: "Klientka wypełnia dokumenty",
    accent: "przed wizytą.",
    description:
      "Wyślij link do formularza, a klientka uzupełni wywiad i podpisze zgody z telefonu — jeszcze zanim wejdzie do gabinetu. Recepcja przestaje tonąć w papierze.",
    bullets: [
      "Formularz działa na telefonie i komputerze",
      "Podpis odręczny na ekranie",
      "Dokumenty dostępne przy profilu klientki",
    ],
    Icon: ClipboardCheck,
  },
  {
    id: "kartoteka",
    eyebrow: "Kartoteka klientek",
    title: "Cała historia klientki",
    accent: "w jednym miejscu.",
    description:
      "Zabiegi, notatki, formularze i zgody spięte przy jednej klientce. Cały zespół widzi ten sam, aktualny obraz — zastępstwa przestają być problemem.",
    bullets: [
      "Wspólny widok dla całego zespołu",
      "Notatki i historia zabiegów",
      "Szybkie wyszukiwanie klientki",
    ],
    Icon: UsersRound,
  },
  {
    id: "formularze",
    eyebrow: "Formularze pod usługi",
    title: "Gotowe szablony dobrane",
    accent: "do Twoich zabiegów.",
    description:
      "Zamiast składać dokumenty od zera, wybierasz gotowe formularze dopasowane do usług salonu i włączasz je jednym kliknięciem.",
    bullets: [
      "Biblioteka gotowych formularzy",
      "Włączasz tylko to, czego używasz",
      "Aktualizowane centralnie",
    ],
    Icon: FileText,
  },
  {
    id: "zgodnosc",
    eyebrow: "Zgodność i RODO",
    title: "Zgody i podpisy zawsze",
    accent: "pod kontrolą.",
    description:
      "Każda zgoda ma swoją wersję, datę i podpis. Salon pozostaje administratorem danych klientek, a BeautyDocs pomaga uporządkować dostęp do dokumentacji.",
    bullets: [
      "Wersjonowanie zgód i dokumentów",
      "Podpis powiązany z dokumentem",
      "Dostęp do dokumentacji według roli",
    ],
    Icon: ShieldCheck,
  },
];

function PlatformSectionBlock({ section, index }: { readonly section: PlatformSection; readonly index: number }) {
  const { id, eyebrow, title, accent, description, bullets, Icon } = section;
  return <section className={`bd-platform-feature ${index % 2 ? "is-reversed" : ""}`} id={id}>
    <div className="bd-platform-feature-copy"><p className="bd-eyebrow"><span>0{index + 1}</span> / {eyebrow}</p>
      <h2 className="bd-heading">{title}<br /><span className="bd-serif">{accent}</span></h2>
      <p className="bd-description">{description}</p>
      <ul>{bullets.map(bullet => <li key={bullet}><Check size={16} aria-hidden="true" />{bullet}</li>)}</ul>
    </div>
    <figure className={`bd-platform-demo bd-platform-demo-${index}`}><div className="bd-demo-label"><Icon size={18} aria-hidden="true" /><span>BeautyDocs / {eyebrow}</span></div><PlatformFeatureMock id={id} /><figcaption>Wypróbuj przykładowy widok · fikcyjne dane</figcaption></figure>
  </section>;
}

export default function BeautyDocsPlatformPreviewPage() {
  return <div className="bd-public-page"><a className="bd-skip" href="#platforma-tresc">Przejdź do treści</a><BeautyDocsMarketingHeader />
    <main id="platforma-tresc"><section className="bd-platform-intro bd-container"><div><p className="bd-eyebrow"><span className="bd-dot" /> Poznaj platformę</p><h1>Dobry dzień w salonie.<br /><span className="bd-serif">Wszystko pod ręką.</span></h1></div><div><p className="bd-description">Od pierwszego wywiadu do kolejnej wizyty. Dokumentacja, klientki i zespół w jednym, uporządkowanym miejscu.</p><Link className="bd-button bd-button-primary" href="/konto?mode=register">Zacznij z BeautyDocs <ArrowRight size={17} aria-hidden="true" /></Link></div></section>
      <nav className="bd-platform-sections bd-container" aria-label="Możliwości platformy">{sections.map(({id,eyebrow,Icon},i) => <a href={`#${id}`} key={id}><Icon size={18} aria-hidden="true" /><span>{eyebrow}</span><small>0{i+1}</small></a>)}</nav>
      <div className="bd-container">{sections.map((section,index) => <PlatformSectionBlock key={section.id} section={section} index={index} />)}</div>
      <BeautyDocsFinalCta />
    </main><BeautyDocsMarketingFooter /></div>;
}
