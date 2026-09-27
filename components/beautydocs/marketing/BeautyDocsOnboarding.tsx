"use client";
import { useT } from "../i18n";

const steps = [
  { number: "01", title: "Stwórz miejsce dla salonu", description: "Załóż konto, uzupełnij dane salonu i zaproś osoby, z którymi pracujesz." },
  { number: "02", title: "Dobierz formularze", description: "Wybierz dokumenty do swoich usług. Udostępnij klientce wywiad i zgodę do wypełnienia." },
  { number: "03", title: "Wróć do tego, co lubisz", description: "Dokumentacja trafia do jednego panelu. Ty i Twój zespół możecie skupić się na kolejnej wizycie." },
];
export function BeautyDocsOnboarding() {
  const t = useT();
  return <section className="bd-section bd-onboarding" id="jak-to-dziala"><div className="bd-container"><div className="bd-onboarding-heading"><p className="bd-eyebrow">{t("Od pierwszego dnia")}</p><h2 className="bd-heading">{t("Dobry porządek.")}<br /><span className="bd-serif">{t("Prosty początek.")}</span></h2><p>{t("Nowy sposób pracy nie musi być skomplikowany.")}<br />{t("Zacznij od trzech prostych kroków.")}</p></div><ol>{steps.map(step => <li key={step.number}><span className="bd-step-number">{step.number}</span><div><h3>{t(step.title)}</h3><p>{t(step.description)}</p></div></li>)}</ol></div></section>;
}
