import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
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
import { PlatformFilm } from "../../components/beautydocs/marketing/PlatformFilm";
import { getServerTranslator } from "../../lib/i18n/server";
import type { Translate } from "../../lib/i18n/translate";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslator();
  return {
    title: { absolute: t("Platforma BeautyDocs — dokumentacja salonu beauty") },
    description: t(
      "Zobacz prawdziwy panel BeautyDocs: klientka wypełnia wywiad i podpisuje zgody na telefonie, a salon od razu ma komplet dokumentów, kartotekę i kalendarz.",
    ),
    robots: { index: true, follow: true },
  };
}

type Shot =
  | { readonly kind: "window"; readonly src: string; readonly alt: string; readonly address: string }
  | { readonly kind: "phones"; readonly shots: readonly { readonly src: string; readonly alt: string }[] };

interface PlatformSection {
  readonly id: string;
  readonly eyebrow: string;
  readonly title: string;
  readonly accent: string;
  readonly description: string;
  readonly bullets: readonly string[];
  readonly Icon: LucideIcon;
  readonly shot: Shot;
}

// Real screens of the product recorded on a demo salon with fictional data
// (regenerate: apps/api/scripts/seed_demo_salon.py + docs/platform-media.md).
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
    shot: {
      kind: "phones",
      shots: [
        { src: "/platforma/phone-medical.webp", alt: "Wywiad medyczny wypełniany na telefonie — odpowiedzi Tak / Nie" },
        { src: "/platforma/phone-consent.webp", alt: "Zgoda na zabieg podpisana palcem na ekranie telefonu" },
      ],
    },
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
    shot: {
      kind: "window",
      src: "/platforma/desktop-client.webp",
      alt: "Profil klientki w panelu BeautyDocs: dane kontaktowe, liczba wizyt, formularzy i notatek oraz historia zabiegów",
      address: "panel / klientki / Zofia Wiśniewska",
    },
  },
  {
    id: "kalendarz",
    eyebrow: "Kalendarz wizyt",
    title: "Wizyty i formularze",
    accent: "w jednym kalendarzu.",
    description:
      "Każda wizyta jest połączona z właściwym formularzem zabiegowym. Od razu widzisz, kto przyjdzie dzisiaj i czy ma już komplet dokumentów.",
    bullets: [
      "Widok dnia i tygodnia",
      "Czas wizyty pobierany z formularza",
      "Wizyty bez formularza widoczne od razu",
    ],
    Icon: CalendarDays,
    shot: {
      kind: "window",
      src: "/platforma/desktop-calendar.webp",
      alt: "Tygodniowy kalendarz salonu z wizytami klientek i nazwami zabiegów",
      address: "panel / kalendarz",
    },
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
    shot: {
      kind: "window",
      src: "/platforma/desktop-forms.webp",
      alt: "Katalog formularzy salonu z przełącznikami, liczbą pytań i czasem zabiegu",
      address: "panel / formularze",
    },
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
    shot: {
      kind: "window",
      src: "/platforma/desktop-document-signatures.webp",
      alt: "Podpisany dokument: podpis osoby wykonującej zabieg i odcisk SHA-256 potwierdzający integralność",
      address: "panel / klientki / dokument",
    },
  },
];

function SectionShot({ shot, t }: { readonly shot: Shot; readonly t: Translate }) {
  if (shot.kind === "phones") {
    return (
      <div className="bd-shot-phones">
        {shot.shots.map((item) => (
          <div className="bd-film-phone" key={item.src}>
            <div className="bd-film-screen">
              <Image alt={t(item.alt)} height={1328} sizes="(max-width: 700px) 45vw, 260px" src={item.src} width={780} />
            </div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="bd-film-window">
      <div aria-hidden="true" className="bd-film-chrome">
        <span /><span /><span />
        <p>{t(shot.address)}</p>
      </div>
      <div className="bd-film-screen">
        <Image alt={t(shot.alt)} height={1500} sizes="(max-width: 900px) 92vw, 620px" src={shot.src} width={2400} />
      </div>
    </div>
  );
}

function PlatformSectionBlock({
  section,
  index,
  t,
}: {
  readonly section: PlatformSection;
  readonly index: number;
  readonly t: Translate;
}) {
  const { id, eyebrow, title, accent, description, bullets, shot } = section;
  return (
    <section className={`bd-platform-feature ${index % 2 ? "is-reversed" : ""}`} id={id}>
      <div className="bd-platform-feature-copy">
        <p className="bd-eyebrow"><span>0{index + 1}</span> / {t(eyebrow)}</p>
        <h2 className="bd-heading">{t(title)}<br /><span className="bd-serif">{t(accent)}</span></h2>
        <p className="bd-description">{t(description)}</p>
        <ul>{bullets.map((bullet) => <li key={bullet}><Check aria-hidden="true" size={16} />{t(bullet)}</li>)}</ul>
      </div>
      <figure className="bd-platform-shot">
        <SectionShot shot={shot} t={t} />
      </figure>
    </section>
  );
}

// Chapter starts (seconds) come from the recording script's markers.
const CLIENT_FLOW_CHAPTERS = [
  { start: 0, title: "Dane klientki", description: "Link lub kod QR otwiera formularz salonu na telefonie." },
  { start: 7.3, title: "Wywiad medyczny", description: "Pytania o przeciwwskazania, odpowiedzi Tak / Nie." },
  { start: 22.8, title: "Weryfikacja SMS", description: "Kod SMS potwierdza, że to numer klientki." },
  { start: 29.7, title: "Zgody i podpisy", description: "Każda decyzja ma własny podpis — także odmowa." },
  { start: 52.2, title: "Komplet w salonie", description: "Dokument trafia do panelu, gotowy do podpisu salonu." },
] as const;

export default async function BeautyDocsPlatformPreviewPage() {
  const { t } = await getServerTranslator();
  return (
    <div className="bd-public-page">
      <a className="bd-skip" href="#platforma-tresc">{t("Przejdź do treści")}</a>
      <BeautyDocsMarketingHeader />
      <main id="platforma-tresc">
        <section className="bd-platform-intro bd-container">
          <div>
            <p className="bd-eyebrow"><span className="bd-dot" /> {t("Poznaj platformę")}</p>
            <h1>{t("Dobry dzień w salonie.")}<br /><span className="bd-serif">{t("Wszystko pod ręką.")}</span></h1>
          </div>
          <div>
            <p className="bd-description">{t("Od pierwszego wywiadu do kolejnej wizyty. Dokumentacja, klientki i zespół w jednym, uporządkowanym miejscu.")}</p>
            <Link className="bd-button bd-button-primary" href="/konto?mode=register">{t("Zacznij z BeautyDocs")} <ArrowRight aria-hidden="true" size={17} /></Link>
          </div>
        </section>

        <section aria-labelledby="platforma-panel" className="bd-platform-hero-film bd-container">
          <h2 className="bd-visually-hidden" id="platforma-panel">{t("Panel salonu w działaniu")}</h2>
          <PlatformFilm
            address="app.beautydocs.pl / panel / atelier-aurora"
            frame="window"
            label={t("Nagranie panelu salonu: przegląd dnia, kalendarz, kartoteka klientki i podpisany dokument")}
            poster="/platforma/desktop-overview.webp"
            src="/platforma/panel-tour.webm"
          />
          <p className="bd-platform-film-note">{t("Prawdziwy panel BeautyDocs. Salon i klientki w nagraniach są fikcyjne.")}</p>
        </section>

        <section aria-labelledby="jak-to-dziala-tytul" className="bd-platform-flow bd-container" id="jak-to-dziala">
          <div className="bd-platform-flow-copy">
            <p className="bd-eyebrow"><span className="bd-dot" /> {t("Jak to działa")}</p>
            <h2 className="bd-heading" id="jak-to-dziala-tytul">{t("Od linku do podpisu.")}<br /><span className="bd-serif">{t("W niecałą minutę.")}</span></h2>
            <p className="bd-description">{t("Tak klientka wypełnia formularz na telefonie. Wybierz etap, aby przejść do tego miejsca w nagraniu.")}</p>
          </div>
          <PlatformFilm
            chapters={CLIENT_FLOW_CHAPTERS.map((chapter) => ({ ...chapter, title: t(chapter.title), description: t(chapter.description) }))}
            frame="phone"
            label={t("Nagranie z telefonu: klientka wypełnia wywiad, potwierdza numer kodem SMS i podpisuje zgody")}
            poster="/platforma/phone-form-start.webp"
            src="/platforma/phone-flow.webm"
          />
        </section>

        <nav aria-label={t("Możliwości platformy")} className="bd-platform-sections bd-container">
          {sections.map(({ id, eyebrow, Icon }, i) => (
            <a href={`#${id}`} key={id}><Icon aria-hidden="true" size={18} /><span>{t(eyebrow)}</span><small>0{i + 1}</small></a>
          ))}
        </nav>
        <div className="bd-container">
          {sections.map((section, index) => <PlatformSectionBlock index={index} key={section.id} section={section} t={t} />)}
        </div>
        <BeautyDocsFinalCta />
      </main>
      <BeautyDocsMarketingFooter />
    </div>
  );
}
