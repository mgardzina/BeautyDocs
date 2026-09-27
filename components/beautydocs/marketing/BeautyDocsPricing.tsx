"use client";

import { useT } from "../i18n";
import * as React from "react";
import Link from "next/link";
import { Check } from "lucide-react";

type BillingCycle = "monthly" | "annual";

interface PricingTier {
  readonly name: string;
  readonly tagline: string;
  readonly monthlyPrice?: number;
  readonly annualPrice?: number;
  readonly custom?: boolean;
  readonly highlighted?: boolean;
  readonly features: readonly string[];
  readonly ctaLabel: string;
}

const tiers: readonly PricingTier[] = [
  {
    name: "Start",
    tagline: "Dla pojedynczego salonu, który porządkuje dokumentację klientek.",
    monthlyPrice: 49,
    annualPrice: 39,
    features: [
      "1 salon",
      "Do 200 klientek",
      "Podstawowe formularze zgód",
      "Wsparcie e-mail",
    ],
    ctaLabel: "Wypróbuj Start",
  },
  {
    name: "Salon",
    tagline: "Pełna dokumentacja i cały zespół w jednym panelu.",
    monthlyPrice: 99,
    annualPrice: 79,
    highlighted: true,
    features: [
      "1 salon",
      "Nielimitowane klientki",
      "Wszystkie formularze",
      "Historia wizyt",
      "Role zespołu",
      "Wsparcie priorytetowe",
    ],
    ctaLabel: "Wybierz Salon",
  },
  {
    name: "Sieć",
    tagline: "Dla marek prowadzących kilka lokalizacji na wspólnym standardzie.",
    custom: true,
    features: [
      "Wiele salonów",
      "Wspólny katalog usług",
      "Logowanie SSO",
      "Dedykowany opiekun",
      "Umowa powierzenia (DPA)",
    ],
    ctaLabel: "Porozmawiajmy",
  },
] as const;

export function BeautyDocsPricing({ standalone = false }: { readonly standalone?: boolean }) {
  const t = useT();
  const [billing, setBilling] = React.useState<BillingCycle>("monthly");
  const Heading = standalone ? "h1" : "h2";
  return (
    <section className="bd-pricing bd-section" id="cennik">
      <div className="bd-container">
        <div className="bd-pricing-heading">
          <div><p className="bd-eyebrow">{t("Cennik / przestrzeń na rozwój")}</p>
            <Heading className="bd-heading">{t("Mały salon. Duży zespół.")}<br /><span className="bd-serif">{t("Twój plan.")}</span></Heading>
            <p className="bd-description">{t("Wybierz miejsce dla swojej dokumentacji. Dopasowane do tego, jak pracujesz.")}</p>
          </div>
          <div className="bd-billing" role="group" aria-label={t("Okres rozliczeniowy")}>
            {(["monthly", "annual"] as const).map((cycle) => <button key={cycle} type="button" aria-pressed={billing === cycle} onClick={() => setBilling(cycle)}>{cycle === "monthly" ? t("Miesięcznie") : t("Rocznie · około −20%")}</button>)}
          </div>
        </div>
        <div className="bd-price-grid">
          {tiers.map((tier) => {
            const price = billing === "annual" ? tier.annualPrice : tier.monthlyPrice;
            return <article className={`bd-price-card ${tier.highlighted ? "bd-price-featured" : ""}`} key={tier.name}>
              <div className="bd-plan-label"><h3>{tier.name}</h3>{tier.highlighted && <span>{t("Dla całego zespołu")}</span>}</div>
              <p className="bd-plan-description">{t(tier.tagline)}</p>
              <div className="bd-price" aria-live="polite" aria-atomic="true">
                <p>{tier.custom ? <strong className="bd-custom-price">{t("Porozmawiajmy")}</strong> : <><strong>{price}{" "}{t("zł")}</strong><span>{" "}{t("/ mies.")}</span></>}</p>
                <small>{tier.custom ? t("Oferta dopasowana do Twojej sieci") : billing === "annual" ? t("{value1} zł płatne raz w roku", { value1: (price ?? 0) * 12 }) : t("Rozliczenie co miesiąc")}</small>
              </div>
              <Link className={`bd-button ${tier.highlighted ? "bd-button-primary" : "bd-button-outline"}`} href={tier.custom ? "/kontakt" : "/konto?mode=register"}>{t(tier.ctaLabel)}</Link>
              <p className="bd-includes">{t("W Twoim planie")}</p>
              <ul>{tier.features.map(feature => <li key={feature}><Check size={16} aria-hidden="true" />{feature}</li>)}</ul>
            </article>;
          })}
        </div>
        <div className="bd-pricing-help"><span>{t("Nie wiesz, od czego zacząć?")}</span><Link href="/kontakt">{t("Pomożemy dobrać plan")}{" "}<span aria-hidden="true">↗</span></Link></div>
      </div>
    </section>
  );
}
