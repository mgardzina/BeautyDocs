"use client";

import { useT } from "../i18n";
import { ExternalLink, Info, ShieldAlert, Truck } from "lucide-react";
import Image from "next/image";
import {
  catalogOfferTotal,
  catalogOfficialReferencePrice,
  catalogPriceComparisonMeta,
  catalogPriceOffers,
  formatCatalogMoney,
  formatPricePln,
} from "@/lib/beautydocs-catalog-offers";
import {
  catalogSellerIdentity,
  type CatalogSellerIdentity,
} from "@/lib/beautydocs-catalog-sellers";

export function ProductPriceComparison({
  details,
  productName,
}: {
  readonly details: Readonly<Record<string, unknown>>;
  readonly productName: string;
}) {
  const t = useT();
  const offers = catalogPriceOffers(details);
  const meta = catalogPriceComparisonMeta(details);
  const officialReferencePrice = catalogOfficialReferencePrice(details);
  if (!meta && offers.length === 0 && officialReferencePrice === null) return null;

  const availableOffers = offers.filter(
    (offer) => offer.availability !== "OUT_OF_STOCK",
  );
  const lowest = availableOffers[0]?.pricePln ?? null;

  return (
    <section
      aria-labelledby="porownanie-cen-tytul"
      className="mt-20 scroll-mt-28 border-t border-[#dce3d5] pt-12 sm:pt-16"
      data-testid="price-comparison"
      id="ceny"
    >
      <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.17em] text-[#245c4d]">
            {t("Porównywarka BeautyDocs")}
          </p>
          <h2
            className="mt-2 font-serif text-3xl font-medium text-[#173d35] sm:text-4xl"
            id="porownanie-cen-tytul"
          >
            {t("Porównaj ceny")}
          </h2>
          {lowest !== null ? (
            <div className="mt-7 border-y border-[#dce3d5] py-5">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-stone-400">
                {t("Cena produktu od")}
              </p>
              <p className="mt-1 font-serif text-4xl text-[#173d35]">
                {formatPricePln(lowest)}
              </p>
              <p className="mt-2 text-xs leading-5 text-stone-500">
                {availableOffers.length} {t(offerCountLabel(availableOffers.length))}{" "}{t("• najniższa cena samego produktu")}
              </p>
            </div>
          ) : null}
          {officialReferencePrice !== null ? (
            <a
              className="mt-4 block border-y border-[#dce3d5] py-5 transition hover:border-[#739f94]"
              href={officialReferencePrice.url}
              rel="nofollow noreferrer"
              target="_blank"
            >
              <span className="flex items-center justify-between gap-3">
                <span>
                  <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-stone-400">
                    {t("Cena w sklepie producenta")}
                  </span>
                  <span className="mt-1 block font-serif text-3xl text-[#173d35]">
                    {formatCatalogMoney(
                      officialReferencePrice.amount,
                      officialReferencePrice.currency,
                    )}
                  </span>
                </span>
                <ExternalLink aria-hidden="true" className="size-4 text-[#245c4d]" />
              </span>
              <span className="mt-2 block text-[11px] font-bold leading-5 text-stone-500">
                {officialReferencePrice.seller}{" "}{t("• cena w")}{" "}{officialReferencePrice.currency}{t(", bez przeliczenia na PLN")}
              </span>
            </a>
          ) : null}
        </div>

        <div>
          {meta?.status === "INFORMATION_ONLY" ? (
            <div className="rounded-[26px] border border-amber-200 bg-amber-50 px-5 py-6 text-amber-950">
              <p className="flex items-center gap-2 text-sm font-black">
                <ShieldAlert aria-hidden="true" className="size-5" />{" "}{t("Pozycja wyłącznie informacyjna")}
              </p>
              <p className="mt-3 text-sm leading-7 text-amber-900/80">{meta.notice}</p>
              <p className="mt-3 text-[11px] font-bold text-amber-900/60">
                {t("Aktualizacja informacji:")}{" "}{formatDate(meta.updatedAt)}
              </p>
            </div>
          ) : meta?.status === "REQUEST_QUOTE" ? (
            <div className="rounded-[26px] border border-[#d1d8c8] bg-[#eef3e8] px-5 py-7 sm:px-7">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#245c4d]">
                {t("Sprzedaż B2B")}
              </p>
              <h3 className="mt-2 font-serif text-3xl text-[#173d35]">
                {t("Cena ustalana indywidualnie")}
              </h3>
              <p className="mt-4 max-w-xl text-sm leading-7 text-stone-600">
                {meta.notice}
              </p>
              <a
                className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#173d35] px-6 text-sm font-black text-white transition hover:bg-[#245c4d]"
                href={meta.quoteUrl ?? undefined}
                rel="nofollow noreferrer"
                target="_blank"
              >
                {t("Zapytaj producenta o wycenę")}
                <ExternalLink aria-hidden="true" className="size-4" />
              </a>
              <p className="mt-4 text-[11px] font-bold text-stone-400">
                {t("Weryfikacja informacji:")}{" "}{formatDate(meta.updatedAt)}
              </p>
            </div>
          ) : (
            <>
              {meta?.status === "REGULATORY_CHECK" ? (
                <div className="mb-4 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-6 text-amber-950">
                  <ShieldAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                  <span>
                    {t("Przed zamówieniem zweryfikuj status produktu, pełny skład, instrukcję oraz uprawnienia sprzedawcy. Widoczna cena nie jest rekomendacją użycia.")}
                  </span>
                </div>
              ) : null}

              <div className="overflow-hidden rounded-[26px] border border-[#dce3d5] bg-white">
                <div className="hidden grid-cols-[minmax(138px,1.1fr)_0.58fr_0.62fr_0.68fr_180px] gap-4 border-b border-[#e8e1dd] bg-[#f4f7ef] px-5 py-3 text-[9px] font-black uppercase tracking-[0.12em] text-stone-400 sm:grid">
                  <span>{t("Sklep")}</span>
                  <span>{t("Cena")}</span>
                  <span>{t("Dostawa")}</span>
                  <span>{t("Razem")}</span>
                  <span className="sr-only">{t("Przejdź do oferty")}</span>
                </div>
                <div className="divide-y divide-[#e8e1dd]">
                  {offers.map((offer) => {
                    const total = catalogOfferTotal(offer);
                    const unavailable = offer.availability === "OUT_OF_STOCK";
                    const sellerIdentity = catalogSellerIdentity(offer.seller);
                    const isLowest =
                      !unavailable &&
                      availableOffers.length > 1 &&
                      offer.pricePln === lowest;
                    return (
                      <article
                        className={`grid gap-5 px-5 py-5 sm:grid-cols-[minmax(138px,1.1fr)_0.58fr_0.62fr_0.68fr_180px] sm:items-center sm:gap-4 ${
                          unavailable ? "bg-stone-50 opacity-70" : "bg-white"
                        }`}
                        key={`${offer.seller}:${offer.url}:${offer.pricePln}`}
                      >
                        <div className="flex items-center justify-between gap-4 sm:block">
                          <SellerLogo identity={sellerIdentity} seller={offer.seller} />
                          <div className="mt-0 flex flex-col items-end gap-1.5 sm:mt-2 sm:items-start">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.08em] ${
                                unavailable
                                  ? "bg-stone-200 text-stone-600"
                                  : "bg-emerald-50 text-emerald-700"
                              }`}
                            >
                              {t(availabilityLabel(offer.availability))}
                            </span>
                            {isLowest ? (
                              <span className="text-[9px] font-black uppercase tracking-[0.08em] text-[#245c4d]">
                                {t("Najniższa cena")}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-[0.11em] text-stone-400 sm:hidden">
                            {t("Cena")}
                          </p>
                          <p className="mt-1 text-base font-black text-[#173d35] sm:mt-0">
                            {formatPricePln(offer.pricePln)}
                          </p>
                          <p className="mt-1 text-[10px] text-stone-400">
                            {t("cena produktu")}
                          </p>
                        </div>
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-[0.11em] text-stone-400 sm:hidden">
                            {t("Dostawa")}
                          </p>
                          <p className="mt-1 flex items-center gap-1.5 text-sm font-black text-[#173d35] sm:mt-0">
                            <Truck aria-hidden="true" className="size-3.5 text-[#61978a]" />
                            {t(shippingLabel(offer.shippingPricePln))}
                          </p>
                          <p className="mt-1 text-[10px] text-stone-400">
                            {offer.shippingPricePln === null
                              ? "koszt w sklepie"
                              : t("koszt wysyłki")}
                          </p>
                        </div>
                        <div
                          className="rounded-xl bg-[#f4f7f1] px-3 py-2.5 sm:bg-transparent sm:px-0 sm:py-0"
                          title={
                            total === null
                              ? t("Suma będzie znana po sprawdzeniu kosztu dostawy w sklepie.")
                              : undefined
                          }
                        >
                          <p className="text-[9px] font-black uppercase tracking-[0.11em] text-stone-400 sm:hidden">
                            {t("Razem")}
                          </p>
                          <p className="mt-1 font-serif text-xl font-medium text-[#173d35] sm:mt-0">
                            {total === null ? "—" : formatPricePln(total)}
                          </p>
                          <p className="mt-1 text-[10px] leading-4 text-stone-400">
                            {total === null ? "po sprawdzeniu dostawy" : "produkt + dostawa"}
                          </p>
                        </div>
                        <a
                          aria-label={t("Sprawdź ofertę {productName} w {seller}", { productName: productName, seller: offer.seller })}
                          className={`inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full px-4 text-xs font-black transition sm:w-auto ${
                            unavailable
                              ? "border border-stone-300 text-stone-500 hover:bg-stone-100"
                              : "bg-[#173d35] text-white hover:bg-[#245c4d]"
                          }`}
                          href={offer.url}
                          rel="nofollow noreferrer"
                          target="_blank"
                        >
                          {unavailable ? t("Zobacz źródło") : t("Sprawdź ofertę")}
                          <ExternalLink aria-hidden="true" className="size-3.5" />
                        </a>
                      </article>
                    );
                  })}
                  {offers.length === 0 ? (
                    <p className="px-5 py-8 text-sm leading-7 text-stone-500">
                      {t("Nie mamy jeszcze aktywnej, zweryfikowanej oferty dla tego produktu.")}
                    </p>
                  ) : null}
                </div>
              </div>
            </>
          )}

          {meta &&
          meta.status !== "INFORMATION_ONLY" &&
          meta.status !== "REQUEST_QUOTE" ? (
            <div className="mt-4 flex gap-2.5 text-[11px] leading-5 text-stone-500">
              <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <p>
                {meta.notice}{" "}{t("Aktualizacja:")}{" "}{formatDate(meta.updatedAt)}.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function SellerLogo({
  identity,
  seller,
}: {
  readonly identity: CatalogSellerIdentity;
  readonly seller: string;
}) {
  return (
    <div
      aria-label={`${seller} — sklep`}
      className="flex min-h-14 w-36 shrink-0 items-center justify-center rounded-xl border border-[#e4e9dd] bg-white px-3 py-2 shadow-[0_4px_12px_rgba(42,61,56,0.04)]"
      role="img"
    >
      {identity.logoPath ? (
        <Image
          alt=""
          className="max-h-9 w-auto max-w-[116px] object-contain"
          height={42}
          src={identity.logoPath}
          width={128}
        />
      ) : (
        <span
          aria-hidden="true"
          className="max-w-full text-center text-[12px] font-black leading-4 tracking-[-0.025em] text-[#173d35]"
        >
          {identity.displayName}
        </span>
      )}
    </div>
  );
}

function shippingLabel(value: number | null): string {
  if (value === null) return "Sprawdź";
  if (value === 0) return "Darmowa";
  return formatPricePln(value);
}

function availabilityLabel(
  value: "IN_STOCK" | "OUT_OF_STOCK" | "PREORDER" | "UNKNOWN",
): string {
  if (value === "IN_STOCK") return "Dostępny";
  if (value === "OUT_OF_STOCK") return "Brak w magazynie";
  if (value === "PREORDER") return "Przedsprzedaż";
  return "Dostępność do sprawdzenia";
}

function formatDate(value: string): string {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}.${month}.${year}` : value;
}

function offerCountLabel(count: number): string {
  if (count === 1) return "oferta";
  if (count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14)) {
    return "oferty";
  }
  return "ofert";
}
