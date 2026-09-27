import { getServerTranslator } from "../../../lib/i18n/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, CalendarDays, MapPin, Phone, Globe, Clock3 } from "lucide-react";
import { BeautyDocsMarketingHeader, BeautyDocsMarketingFooter } from "@/components/beautydocs/marketing";
import { SalonGallery } from "@/components/beautydocs/salons/SalonGallery";
import { SalonLogo } from "@/components/beautydocs/salons/SalonLogo";
import { SalonMap } from "@/components/beautydocs/salons/SalonMap";
import { fetchPublicTenantConfig } from "@/lib/beautydocs-api";
import { resolveBeautyDocsInternalApiUrl } from "@/lib/beautydocs-internal-api";
import { isValidTenantSlug } from "@/lib/tenant-host";
import { salonPrice, type PublicSalon, type SalonService } from "@/types/beautydocs-salon";
import type { TenantActiveForm } from "@/types/tenant";

export const dynamic = "force-dynamic";
export const metadata = { title: "Poznaj salon — BeautyDocs" };

// Best-effort link from a free-text price-list entry to the matching
// bookable form, so "Umów wizytę" on that service can jump straight past
// step 1 of the booking dialog (choosing the treatment) into the calendar.
// Salons that used "Importuj z formularzy" get an exact match for free,
// since their service names are copied verbatim from the form names.
function normalizeTreatmentName(value: string): string {
  return value
    .toLowerCase()
    .replace(/ł/g, "l")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function matchFormForService(
  serviceName: string,
  forms: readonly TenantActiveForm[],
): TenantActiveForm | null {
  const normalizedService = normalizeTreatmentName(serviceName);
  if (!normalizedService) return null;
  let bestMatch: TenantActiveForm | null = null;
  for (const form of forms) {
    const normalizedForm = normalizeTreatmentName(form.displayName);
    if (!normalizedForm) continue;
    if (normalizedService === normalizedForm) return form;
    if (
      normalizedService.includes(normalizedForm) ||
      normalizedForm.includes(normalizedService)
    ) {
      bestMatch ??= form;
    }
  }
  return bestMatch;
}

export default async function SalonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { t } = await getServerTranslator();
  const { slug } = await params;
  if (!isValidTenantSlug(slug)) notFound();
  const url = resolveBeautyDocsInternalApiUrl(`/api/v1/public/salons/${slug}`);
  if (!url) throw new Error("Salon API unavailable");
  const [response, tenantConfig] = await Promise.all([
    fetch(url, { cache: "no-store", headers: { host: "app.beautydocs.pl" }, signal: AbortSignal.timeout(10000) }),
    fetchPublicTenantConfig(slug),
  ]);
  if (response.status === 404) notFound();
  if (!response.ok) throw new Error("Salon API unavailable");
  const salon: PublicSalon = await response.json();
  const activeForms = tenantConfig.status === "ok" ? tenantConfig.config.activeForms : [];
  const address = [salon.addressLine1, salon.addressLine2, [salon.postalCode, salon.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  // Deep-links straight into the client portal's booking dialog for this
  // salon; the portal resolves the slug and opens "Umów wizytę" immediately,
  // prompting login first if the visitor isn't signed in yet.
  const bookHref = `/klient?section=salons&book=${encodeURIComponent(slug)}`;
  const serviceBookHref = (service: SalonService) => {
    const matchedForm = matchFormForService(service.name, activeForms);
    return matchedForm ? `${bookHref}&form=${encodeURIComponent(matchedForm.code)}` : bookHref;
  };

  return (
    <div className="bd-public-page bd-salons-page">
      <a className="bd-skip" href="#salon">{t("Przejdź do profilu salonu")}</a>
      <BeautyDocsMarketingHeader />
      <main id="salon" className="bd-container bd-salon-detail">
        <Link className="bd-salon-back" href="/salony"><ArrowLeft size={17} />{" "}{t("Wszystkie salony")}</Link>
        <header className="bd-salon-title">
          <p className="bd-eyebrow">{salon.city || t("Poznaj miejsce")}</p>
          <h1><SalonLogo url={salon.logoUrl} name={salon.displayName} />{salon.displayName}</h1>
          {salon.introduction && <p>{salon.introduction}</p>}
          {address && <a href="#lokalizacja"><MapPin size={17} />{address}</a>}
        </header>
        <SalonGallery photos={salon.photos} name={salon.displayName} />
        <div className="bd-salon-detail-grid">
          <div>
            <nav className="bd-salon-anchor-nav" aria-label={t("Na stronie salonu")}>
              <a href="#o-salonie">{t("O salonie")}</a>
              <a href="#oferta">{t("Usługi i ceny")}</a>
              <a href="#lokalizacja">{t("Lokalizacja")}</a>
            </nav>
            <section id="o-salonie" className="bd-salon-section">
              <p className="bd-eyebrow">{t("Ludzie i miejsce")}</p>
              <h2>{t("Poznaj nas bliżej.")}</h2>
              <p className="bd-salon-about">{salon.about || t("Salon nie dodał jeszcze opisu. Skontaktuj się bezpośrednio, aby poznać szczegóły oferty.")}</p>
            </section>
            <section id="oferta" className="bd-salon-section">
              <p className="bd-eyebrow">{t("Chwila dla Ciebie")}</p>
              <h2>{t("Usługi i ceny")}</h2>
              {salon.services.length ? (
                <ul className="bd-salon-services">
                  {salon.services.map((service, i) => (
                    <li key={i}>
                      <div className="bd-salon-service-info">
                        <h3>{service.name}</h3>
                        {service.description && <p>{t(service.description)}</p>}
                        {service.durationMinutes && <span><Clock3 size={14} /> {service.durationMinutes}{" "}{t("min")}</span>}
                      </div>
                      <div className="bd-salon-service-action">
                        <strong>{salonPrice(service)}</strong>
                        <Link className="bd-button bd-button-primary bd-book-cta bd-service-book" href={serviceBookHref(service)}>
                          <CalendarDays size={15} />{" "}{t("Umów wizytę")}
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>{t("Zapytaj salon o aktualną ofertę i ceny.")}</p>
              )}
              <p className="bd-salon-price-note">{t("Ceny podaje salon i mają charakter informacyjny. Szczegóły usługi ustalisz bezpośrednio z salonem. Nie realizujemy tutaj płatności.")}</p>
            </section>
            <section id="lokalizacja" className="bd-salon-section">
              <p className="bd-eyebrow">{t("Do zobaczenia")}</p>
              <h2>{t("Znajdziesz nas tutaj.")}</h2>
              {address && <p>{address}</p>}
              <SalonMap name={salon.displayName} address={address} latitude={salon.latitude} longitude={salon.longitude} />
            </section>
          </div>
          <aside className="bd-salon-contact">
            <p className="bd-eyebrow">{t("Porozmawiajmy")}</p>
            <h2>{t("Zrób pierwszy krok.")}</h2>
            <p>{t("Wybierz zabieg z cennika albo umów się ogólnie — resztę ustalisz w kalendarzu.")}</p>
            <Link className="bd-button bd-button-primary bd-book-cta" href={bookHref}><CalendarDays size={17} />{" "}{t("Umów wizytę")}</Link>
            {salon.phone && <a className="bd-button bd-button-secondary" href={`tel:${salon.phone.replace(/[^+\d]/g, "")}`}><Phone size={17} />{salon.phone}</a>}
            {salon.websiteUrl && <a className="bd-button bd-button-secondary" target="_blank" rel="noreferrer" href={salon.websiteUrl}><Globe size={17} />{" "}{t("Strona salonu")}{" "}<ArrowUpRight size={15} /></a>}
            <Link className="bd-salon-client-link" href="/klient?section=salons">{t("Przejdź do konta osobistego")}{" "}<ArrowUpRight size={16} /></Link>
            <small>{t("W swoim koncie znajdziesz wiadomości, wizyty i dokumenty.")}</small>
          </aside>
        </div>
      </main>
      <BeautyDocsMarketingFooter />
    </div>
  );
}
