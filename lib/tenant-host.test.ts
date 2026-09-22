import assert from "node:assert/strict";
import test from "node:test";
import {
  isReservedBeautyDocsSubdomain,
  isValidTenantSlug,
  parseBeautyDocsHost,
} from "./tenant-host";

test("resolves the production marketing hosts", () => {
  assert.deepEqual(parseBeautyDocsHost("beautydocs.pl"), {
    surface: "marketing",
    hostname: "beautydocs.pl",
    subdomain: null,
    isLocalDevelopment: false,
  });

  assert.equal(parseBeautyDocsHost("www.beautydocs.pl").surface, "marketing");
});

test("resolves reserved BeautyDocs surfaces", () => {
  assert.equal(parseBeautyDocsHost("app.beautydocs.pl").surface, "salon-app");
  assert.equal(
    parseBeautyDocsHost("forms.beautydocs.pl").surface,
    "public-forms",
  );
  assert.equal(
    parseBeautyDocsHost("admin.beautydocs.pl").surface,
    "platform-admin",
  );
  assert.equal(parseBeautyDocsHost("api.beautydocs.pl").surface, "api");
});

test("does not treat a salon label as a BeautyDocs subdomain", () => {
  assert.deepEqual(parseBeautyDocsHost("PowderBrows.BeautyDocs.PL:443"), {
    surface: "unknown",
    hostname: "powderbrows.beautydocs.pl",
    subdomain: null,
    isLocalDevelopment: false,
    reason: "unsupported-subdomain",
  });
});

test("supports shared localhost surfaces without salon subdomains", () => {
  assert.equal(
    parseBeautyDocsHost("localhost:3000").surface,
    "local-development",
  );

  assert.deepEqual(parseBeautyDocsHost("powderbrows.localhost:3000"), {
    surface: "unknown",
    hostname: "powderbrows.localhost",
    subdomain: null,
    isLocalDevelopment: true,
    reason: "unsupported-subdomain",
  });

  assert.equal(parseBeautyDocsHost("app.localhost:3000").surface, "salon-app");
  assert.equal(
    parseBeautyDocsHost("forms.localhost:3000").surface,
    "public-forms",
  );
  assert.equal(parseBeautyDocsHost("127.0.0.1:3000").surface, "local-development");
  assert.equal(parseBeautyDocsHost("[::1]:3000").surface, "local-development");
});

test("does not accept suffix attacks, nested subdomains or host lists", () => {
  const suffixAttack = parseBeautyDocsHost("beautydocs.pl.evil.example");
  const nestedSubdomain = parseBeautyDocsHost("a.b.beautydocs.pl");
  const forwardedList = parseBeautyDocsHost(
    "powderbrows.beautydocs.pl, evil.example",
  );

  assert.equal(suffixAttack.surface, "unknown");
  assert.equal(nestedSubdomain.surface, "unknown");
  assert.equal(forwardedList.surface, "unknown");

  if (nestedSubdomain.surface === "unknown") {
    assert.equal(nestedSubdomain.reason, "nested-subdomain");
  }
  if (forwardedList.surface === "unknown") {
    assert.equal(forwardedList.reason, "invalid-host");
  }
});

test("validates salon slugs and reserves platform labels", () => {
  assert.equal(isValidTenantSlug("powderbrows"), true);
  assert.equal(isValidTenantSlug("salon-2"), true);
  assert.equal(isValidTenantSlug("Salon-2"), false);
  assert.equal(isValidTenantSlug("-salon"), false);
  assert.equal(isValidTenantSlug("salon-"), false);
  assert.equal(isValidTenantSlug("app"), false);
  assert.equal(isValidTenantSlug("forms"), false);
  assert.equal(isReservedBeautyDocsSubdomain("ADMIN"), true);
  assert.equal(isReservedBeautyDocsSubdomain("powderbrows"), false);
});

test("keeps infrastructure labels unavailable to salons", () => {
  const infrastructureLabels = [
    "assets",
    "static",
    "support",
    "mail",
    "status",
  ] as const;

  for (const label of infrastructureLabels) {
    assert.equal(isValidTenantSlug(label), false);
    assert.equal(isReservedBeautyDocsSubdomain(label), true);

    const resolution = parseBeautyDocsHost(`${label}.beautydocs.pl`);
    assert.equal(resolution.surface, "unknown");

    if (resolution.surface === "unknown") {
      assert.equal(resolution.reason, "reserved-subdomain");
    }
  }
});

test("handles missing and malformed hosts", () => {
  assert.equal(parseBeautyDocsHost(null).surface, "unknown");
  assert.equal(parseBeautyDocsHost(" ").surface, "unknown");
  assert.equal(parseBeautyDocsHost("https://beautydocs.pl").surface, "unknown");
  assert.equal(parseBeautyDocsHost("beautydocs.pl:99999").surface, "unknown");
});
