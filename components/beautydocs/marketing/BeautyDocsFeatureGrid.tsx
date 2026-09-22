import Link from "next/link";
import { ArrowUpRight, FileStack, PenLine, UsersRound } from "lucide-react";
const features = [
  { icon: FileStack, number: "01", title: "Cała historia. Jedna kartoteka.", description: "Wywiady, zgody i notatki przy profilu klientki. Przy kolejnej wizycie wracasz do tego, co ważne.", href: "/platforma#kartoteka", color: "bd-feature-sage" },
  { icon: PenLine, number: "02", title: "Mniej papieru przed wizytą.", description: "Formularze dopasowane do zabiegu i podpis na ekranie. Dokumentacja bez drukowania i segregatorów.", href: "/platforma#wywiady", color: "bd-feature-peach" },
  { icon: UsersRound, number: "03", title: "Zespół, który jest na bieżąco.", description: "Wspólny panel i dostęp dopasowany do roli. Każdy wie, gdzie znaleźć potrzebne informacje.", href: "/platforma#zgodnosc", color: "bd-feature-lilac" },
];
export function BeautyDocsFeatureGrid() {
  return <section className="bd-section bd-features" id="mozliwosci"><div className="bd-container"><div className="bd-section-heading"><p className="bd-eyebrow">Porządek, który robi różnicę</p><h2 className="bd-heading">Wszystko, czego potrzebujesz.<br /><span className="bd-serif">Dokładnie tam, gdzie trzeba.</span></h2></div><div className="bd-feature-grid">{features.map(({ icon: Icon, ...feature }) => <article className={`bd-feature ${feature.color}`} key={feature.number}><div className="bd-feature-top"><Icon size={32} strokeWidth={1.3} aria-hidden="true" /><span>{feature.number}</span></div><h3>{feature.title}</h3><p>{feature.description}</p><Link href={feature.href} aria-label={`Poznaj możliwości: ${feature.title}`}>Poznaj możliwości <ArrowUpRight size={17} aria-hidden="true" /></Link></article>)}</div></div></section>;
}
