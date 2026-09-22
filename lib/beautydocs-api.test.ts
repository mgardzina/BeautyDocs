import assert from "node:assert/strict";
import test from "node:test";
import {
  BeautyDocsApiContractError,
  parsePlatformStats,
  parsePlatformStatsResponse,
  parseTenantPublicConfig,
  parseTenantPublicConfigResponse,
  platformStatsEndpointPath,
  publicTenantConfigEndpointPath,
} from "./beautydocs-api-contract";

const validConfig = {
  slug: "powderbrows",
  displayName: "PowderBrows Academy",
  legalName: "PowderBrows Academy Malwina Zięba",
  legal: {
    nip: "8652314272",
    address: {
      street: "ul. Przykładowa 1",
      postalCode: "37-450",
      city: "Stalowa Wola",
      countryCode: "PL",
    },
    privacyContactEmail: "privacy@example.com",
  },
  contact: {
    phone: "+48 733 702 282",
    email: "salon@example.com",
    websiteUrl: "https://example.com",
  },
  activeForms: [
    { code: "lip-augmentation", displayName: "Modelowanie ust", displayOrder: 2 },
    { code: "permanent-makeup", displayName: "Makijaż permanentny", displayOrder: 1 },
  ],
};

test("builds a path-scoped endpoint without a salon host", () => {
  assert.equal(
    publicTenantConfigEndpointPath("powderbrows"),
    "/api/v1/public/tenants/powderbrows",
  );
  assert.throws(
    () => publicTenantConfigEndpointPath("powderbrows.beautydocs.pl"),
    BeautyDocsApiContractError,
  );
});

test("parses the strict camelCase public tenant contract", () => {
  const config = parseTenantPublicConfig(validConfig);

  assert.equal(config.slug, "powderbrows");
  assert.deepEqual(
    config.activeForms.map((form) => form.code),
    ["permanent-makeup", "lip-augmentation"],
  );
});

test("accepts public text fields at their database contract limits", () => {
  const config = parseTenantPublicConfig({
    ...validConfig,
    legalName: "L".repeat(250),
    legal: {
      ...validConfig.legal,
      address: {
        ...validConfig.legal.address,
        street: "S".repeat(501),
      },
    },
    activeForms: [
      {
        ...validConfig.activeForms[0],
        displayName: "F".repeat(250),
      },
    ],
  });

  assert.equal(config.legalName.length, 250);
  assert.equal(config.legal.address?.street.length, 501);
  assert.equal(config.activeForms[0]?.displayName.length, 250);
});

test("rejects values beyond public database and catalogue limits", () => {
  assert.throws(
    () =>
      parseTenantPublicConfig({
        ...validConfig,
        legal: { ...validConfig.legal, nip: "1".repeat(21) },
      }),
    BeautyDocsApiContractError,
  );
  assert.throws(
    () =>
      parseTenantPublicConfig({
        ...validConfig,
        activeForms: Array.from({ length: 101 }, (_, index) => ({
          code: `form-${index}`,
          displayName: `Formularz ${index}`,
          displayOrder: index,
        })),
      }),
    BeautyDocsApiContractError,
  );
});

test("rejects a snake_case backend response", () => {
  assert.throws(
    () =>
      parseTenantPublicConfig({
        ...validConfig,
        display_name: validConfig.displayName,
        displayName: undefined,
      }),
    BeautyDocsApiContractError,
  );
});

test("rejects a form code that cannot be used as a canonical path slug", () => {
  assert.throws(
    () =>
      parseTenantPublicConfig({
        ...validConfig,
        activeForms: [
          {
            ...validConfig.activeForms[0],
            code: "LIP_AUGMENTATION",
          },
        ],
      }),
    BeautyDocsApiContractError,
  );
});

test("rejects missing required nested fields", () => {
  const incompleteLegal = {
    nip: validConfig.legal.nip,
    address: validConfig.legal.address,
  };

  assert.throws(
    () =>
      parseTenantPublicConfig({
        ...validConfig,
        legal: incompleteLegal,
      }),
    BeautyDocsApiContractError,
  );
});

test("rejects unknown fields and unsafe website schemes", () => {
  assert.throws(
    () => parseTenantPublicConfig({ ...validConfig, theme: "gold" }),
    BeautyDocsApiContractError,
  );
  assert.throws(
    () =>
      parseTenantPublicConfig({
        ...validConfig,
        contact: { ...validConfig.contact, websiteUrl: "javascript:alert(1)" },
      }),
    BeautyDocsApiContractError,
  );
});

test("maps API 404 and failure statuses to safe frontend states", () => {
  assert.deepEqual(parseTenantPublicConfigResponse(404, "not json"), {
    status: "not-found",
  });
  assert.deepEqual(parseTenantPublicConfigResponse(503, "not json"), {
    status: "unavailable",
    reason: "api",
  });
});

test("rejects an invalid 200 API body", () => {
  assert.deepEqual(parseTenantPublicConfigResponse(200, "{}"), {
    status: "unavailable",
    reason: "invalid-response",
  });
  assert.deepEqual(parseTenantPublicConfigResponse(200, "not json"), {
    status: "unavailable",
    reason: "invalid-response",
  });
});

test("builds the platform stats endpoint path", () => {
  assert.equal(platformStatsEndpointPath(), "/api/v1/public/platform-stats");
});

test("parses the platform stats contract and rejects bad counts", () => {
  assert.deepEqual(
    parsePlatformStats({
      companyCount: 120,
      signedFormCount: 8000,
      availableFormCount: 8,
    }),
    { companyCount: 120, signedFormCount: 8000, availableFormCount: 8 },
  );

  // Negative, fractional, string, missing and unknown fields must all fail.
  for (const bad of [
    { companyCount: -1, signedFormCount: 0, availableFormCount: 0 },
    { companyCount: 1.5, signedFormCount: 0, availableFormCount: 0 },
    { companyCount: "1", signedFormCount: 0, availableFormCount: 0 },
    { companyCount: 1, signedFormCount: 0 },
    { companyCount: 1, signedFormCount: 0, availableFormCount: 0, extra: 1 },
  ]) {
    assert.throws(() => parsePlatformStats(bad), BeautyDocsApiContractError);
  }
});

test("maps platform stats API failures to an unavailable state", () => {
  assert.deepEqual(
    parsePlatformStatsResponse(
      200,
      JSON.stringify({ companyCount: 3, signedFormCount: 10, availableFormCount: 8 }),
    ),
    { status: "ok", stats: { companyCount: 3, signedFormCount: 10, availableFormCount: 8 } },
  );
  assert.deepEqual(parsePlatformStatsResponse(503, ""), { status: "unavailable" });
  assert.deepEqual(parsePlatformStatsResponse(200, "not json"), {
    status: "unavailable",
  });
});
