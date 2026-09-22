import assert from "node:assert/strict";
import test from "node:test";
import {
  catalogOfficialReferencePrice,
  catalogOfferTotal,
  catalogLowestPrice,
  catalogPriceComparisonMeta,
  catalogPriceOffers,
  formatCatalogMoney,
  formatPricePln,
} from "./beautydocs-catalog-offers";
import { catalogSellerIdentity } from "./beautydocs-catalog-sellers";

const details = {
  offers: [
    {
      seller: "Droższy sklep",
      pricePln: 79.99,
      shippingPricePln: null,
      availability: "IN_STOCK",
      sourceType: "STORE",
      updatedAt: "2026-08-23",
      url: "https://example.com/drozej",
    },
    {
      seller: "Tańszy sklep",
      pricePln: 52.12,
      shippingPricePln: 8.99,
      availability: "IN_STOCK",
      sourceType: "COMPARATOR",
      updatedAt: "2026-08-23",
      url: "https://example.com/taniej",
    },
  ],
  priceComparison: {
    currency: "PLN",
    status: "ACTIVE",
    updatedAt: "2026-08-23",
    notice: "Cena może się zmienić.",
  },
};

test("parses, sorts and summarizes trusted offer records", () => {
  const offers = catalogPriceOffers(details);
  assert.deepEqual(
    offers.map((offer) => offer.seller),
    ["Tańszy sklep", "Droższy sklep"],
  );
  assert.equal(catalogLowestPrice(details), 52.12);
  assert.equal(catalogOfferTotal(offers[0]), 61.11);
  assert.equal(catalogOfferTotal(offers[1]), null);
  assert.equal(catalogPriceComparisonMeta(details)?.status, "ACTIVE");
  assert.match(formatPricePln(52.12), /52,12/);
});

test("rejects malformed and unsafe offer data", () => {
  assert.deepEqual(
    catalogPriceOffers({
      offers: [
        { ...details.offers[0], url: "javascript:alert(1)" },
        { ...details.offers[0], pricePln: Number.NaN },
      ],
    }),
    [],
  );
});

test("parses quote-only comparison metadata and rejects unsafe quote URLs", () => {
  const quote = catalogPriceComparisonMeta({
    priceComparison: {
      currency: "PLN",
      status: "REQUEST_QUOTE",
      updatedAt: "2026-08-23",
      notice: "Cena zależy od konfiguracji.",
      quoteUrl: "https://example.com/contact",
    },
  });
  assert.equal(quote?.status, "REQUEST_QUOTE");
  assert.equal(quote?.quoteUrl, "https://example.com/contact");
  assert.equal(
    catalogPriceComparisonMeta({
      priceComparison: {
        currency: "PLN",
        status: "REQUEST_QUOTE",
        updatedAt: "2026-08-23",
        notice: "Cena zależy od konfiguracji.",
        quoteUrl: "javascript:alert(1)",
      },
    }),
    null,
  );
});

test("parses an official foreign-currency reference without treating it as PLN", () => {
  const reference = catalogOfficialReferencePrice({
    officialReferencePrice: {
      amount: 72,
      originalAmount: 85,
      currency: "EUR",
      seller: "INSTYTUTUM",
      availability: "IN_STOCK",
      url: "https://instytutum.com/en/product/example/",
      updatedAt: "2026-08-24",
    },
  });

  assert.equal(reference?.amount, 72);
  assert.equal(reference?.currency, "EUR");
  assert.match(formatCatalogMoney(72, "EUR"), /72/);
  assert.equal(catalogLowestPrice({ officialReferencePrice: reference }), null);
});

test("maps known sellers to logos and keeps a clean fallback name", () => {
  assert.equal(
    catalogSellerIdentity("Caudalie").logoPath,
    "/beautydocs/brands/caudalie.svg",
  );
  assert.deepEqual(catalogSellerIdentity("MAKEUP — 50 ml"), {
    displayName: "MAKEUP",
    logoPath: null,
  });
});
