import assert from "node:assert/strict";
import test from "node:test";
import {
  catalogProductPath,
  catalogProductSlug,
  isCatalogProductSlug,
} from "./beautydocs-catalog-path";

const product = {
  source: "BEAUTYDOCS" as const,
  externalId: "professional-cosmetic:cicaplast-baume-b5-plus",
  details: { catalogProfile: "PROFESSIONAL_PRODUCT" },
};

test("creates a stable public path for every professional catalogue prefix", () => {
  assert.equal(catalogProductSlug(product), "cicaplast-baume-b5-plus");
  assert.equal(catalogProductPath(product), "/katalog/cicaplast-baume-b5-plus");
  assert.equal(
    catalogProductPath({
      ...product,
      externalId: "professional-device:stellar-m22",
    }),
    "/katalog/stellar-m22",
  );
  assert.equal(
    catalogProductPath({
      ...product,
      externalId: "professional-medicine:dexamethasone-8mg",
    }),
    "/katalog/dexamethasone-8mg",
  );
});

test("does not expose private, malformed or non-product catalogue entries", () => {
  assert.equal(catalogProductPath({ ...product, source: "SALON" }), null);
  assert.equal(
    catalogProductPath({ ...product, externalId: "professional-cosmetic:../sekret" }),
    null,
  );
  assert.equal(
    catalogProductPath({ ...product, details: { catalogProfile: "EDITORIAL" } }),
    null,
  );
  assert.equal(isCatalogProductSlug("revolax-deep-1-1ml"), true);
  assert.equal(isCatalogProductSlug("Revolax Deep"), false);
});
