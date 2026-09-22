import assert from "node:assert/strict";
import test from "node:test";
import {
  BeautyDocsAdminContractError,
  isBeautyDocsClientId,
  isBeautyDocsNotificationId,
  isBeautyDocsSignatureKey,
  isBeautyDocsSubmissionId,
  isBeautyDocsTeamMemberId,
  parseBeautyDocsAdminClientList,
  parseBeautyDocsAdminClientFormDetail,
  parseBeautyDocsAdminClientFormDetailResponse,
  parseBeautyDocsAdminClientListResponse,
  parseBeautyDocsAdminClientProfile,
  parseBeautyDocsAdminClientProfileResponse,
  parseBeautyDocsAdminFormEntry,
  parseBeautyDocsAdminNotificationList,
  parseBeautyDocsMfaChallenge,
  parseBeautyDocsMfaLoginChallenge,
  parseBeautyDocsMfaState,
  parseBeautyDocsAdminSession,
  parseBeautyDocsAdminSessionResponse,
  parseBeautyDocsAdminTeam,
  parseBeautyDocsAdminTeamMemberResponse,
  parseBeautyDocsAdminTeamResponse,
  parseBeautyDocsLoginCredentials,
  parseBeautyDocsClientListQuery,
  parseBeautyDocsTenantOverview,
  parseBeautyDocsTenantOverviewResponse,
} from "./beautydocs-admin-contract";
import {
  filterBeautyDocsConsumerSessionCookie,
  filterBeautyDocsSessionCookie,
  selectBeautyDocsConsumerSessionSetCookie,
  selectBeautyDocsSessionSetCookie,
  validatedSameOrigin,
} from "./beautydocs-bff-security";
import {
  parseBeautyDocsStaffInvitationPayload,
  parseBeautyDocsTeamMemberCreatePayload,
  parseBeautyDocsTeamMemberUpdatePayload,
} from "./beautydocs-team-request";

const sessionToken = "A".repeat(43);
const validSession = {
  user: {
    email: "owner@example.com",
    displayName: "Anna Nowak",
  },
  memberships: [
    {
      tenantSlug: "powderbrows",
      tenantDisplayName: "PowderBrows Academy",
      role: "OWNER",
    },
  ],
};
const validOverview = {
  tenant: {
    slug: "powderbrows",
    displayName: "PowderBrows Academy",
    legalName: "PowderBrows Academy Malwina Zięba",
  },
  membership: { role: "OWNER" },
  capabilities: {
    canViewClients: true,
    canManageClients: true,
    canManageForms: true,
    canManageMembers: true,
  },
  stats: {
    clientsCount: 10,
    activeFormsCount: 4,
    formSubmissionsCount: 25,
    signedFormSubmissionsCount: 18,
  },
};

test("team-member payloads reject an owner-managed phone field", () => {
  const createPayload = {
    displayName: "Anna Nowak",
    email: "anna@example.test",
    jobTitle: "Kosmetolog",
    performsTreatments: true,
    allTreatments: true,
    treatmentCodes: ["permanent-makeup"],
  };

  assert.deepEqual(parseBeautyDocsTeamMemberCreatePayload(createPayload), createPayload);
  assert.equal(
    parseBeautyDocsTeamMemberCreatePayload({
      ...createPayload,
      phone: "+48500600700",
    }),
    null,
  );
  assert.deepEqual(parseBeautyDocsTeamMemberUpdatePayload({
    ...createPayload,
    isActive: true,
  }), {
    ...createPayload,
    isActive: true,
  });
  assert.equal(
    parseBeautyDocsTeamMemberUpdatePayload({
      ...createPayload,
      phone: "+48500600700",
      isActive: true,
    }),
    null,
  );
});

test("staff invitation payload accepts only a normalized e-mail field", () => {
  assert.deepEqual(parseBeautyDocsStaffInvitationPayload({
    email: " anna@example.test ",
  }), { email: "anna@example.test" });
  assert.equal(parseBeautyDocsStaffInvitationPayload({
    email: "anna@example.test",
    performsTreatments: false,
  }), null);
});
const clientId = "11111111-1111-4111-8111-111111111111";
const visitId = "22222222-2222-4222-8222-222222222222";
const teamMemberId = "55555555-5555-4555-8555-555555555555";
const validClientList = {
  items: [
    {
      id: clientId,
      firstName: "Anna",
      lastName: "Nowak",
      phone: "+48 500 600 700",
      email: "anna@example.com",
      archivedAt: null,
      createdAt: "2026-07-19T10:00:00Z",
      updatedAt: "2026-07-19T11:00:00+00:00",
    },
  ],
  total: 1,
  page: 1,
  pageSize: 20,
  totalPages: 1,
};
const validClientProfile = {
  client: {
    ...validClientList.items[0],
    birthDate: "1990-05-12",
  },
  visits: {
    items: [
      {
        id: visitId,
        treatmentName: "Makijaż permanentny brwi",
        startsAt: "2026-07-19T10:00:00Z",
        endsAt: "2026-07-19T12:00:00Z",
        status: "COMPLETED",
        notes: null,
        anaesthesia: "Krem",
      },
    ],
    total: 1,
    truncated: false,
  },
  notes: {
    items: [
      {
        id: "33333333-3333-4333-8333-333333333333",
        body: "Klientka preferuje delikatny efekt.",
        category: "PREFERENCJA",
        createdAt: "2026-07-19T10:00:00Z",
        editedAt: null,
      },
    ],
    total: 1,
    truncated: false,
  },
  forms: {
    items: [
      {
        id: "44444444-4444-4444-8444-444444444444",
        visitId,
        templateCode: "permanent-makeup",
        templateName: "Makijaż permanentny",
        status: "SIGNED",
        submittedAt: "2026-07-19T09:00:00Z",
        signedAt: "2026-07-19T09:05:00Z",
        createdAt: "2026-07-19T08:00:00Z",
      },
    ],
    total: 1,
    truncated: false,
  },
};
const validClientFormDetail = {
  client: {
    id: clientId,
    firstName: "Anna",
    lastName: "Nowak",
  },
  submission: {
    id: "44444444-4444-4444-8444-444444444444",
    visitId,
    templateCode: "modelowanie-ust",
    templateName: "Modelowanie ust",
    templateVersion: 2,
    status: "SIGNED",
    submittedAt: "2026-07-19T09:00:00Z",
    signedAt: "2026-07-19T09:05:00Z",
    createdAt: "2026-07-19T08:00:00Z",
  },
  sections: [
    {
      key: "wywiad",
      title: "Wywiad medyczny",
      items: [
        {
          key: "alergia",
          label: "Czy występują alergie?",
          kind: "contraindication",
          value: "yes",
          detail: "Lateks",
        },
      ],
    },
  ],
  anatomy: {
    model: "body",
    faceZoneSet: null,
    bodyZoneSet: "body",
  },
  treatmentAreaIds: ["calf_left", "calf_right"],
  signatureKeys: ["podpisDane"],
  practitioner: null,
  documentHash: "a".repeat(64),
};
const validTeamMember = {
  id: teamMemberId,
  displayName: "Anna Nowak",
  email: "anna@example.com",
  phone: "+48 700 800 900",
  jobTitle: "Kosmetolog",
  isOwner: false,
  performsTreatments: true,
  allTreatments: true,
  treatmentCodes: [],
  isActive: true,
  hasPanelAccess: false,
  signatureConfigured: true,
  smsSigningReady: true,
  signatureUpdatedAt: "2026-07-19T09:00:00Z",
  createdAt: "2026-07-19T08:00:00Z",
  updatedAt: "2026-07-19T09:00:00Z",
};
const validTeam = {
  items: [validTeamMember],
  canManage: true,
};
const notificationId = "66666666-6666-4666-8666-666666666666";
const validNotificationList = {
  items: [
    {
      id: notificationId,
      kind: "PRACTITIONER_SIGNATURE_REQUIRED",
      severity: "ACTION_REQUIRED",
      title: "Formularz wymaga podpisu",
      body: "Anna Nowak zakończyła formularz.",
      actionLabel: "Otwórz formularz",
      clientId,
      submissionId: "44444444-4444-4444-8444-444444444444",
      clientName: "Anna Nowak",
      formName: "Makijaż permanentny",
      practitionerName: "Ewa Testowa",
      createdAt: "2026-08-09T12:00:00Z",
      readAt: null,
      resolvedAt: null,
      archivedAt: null,
    },
  ],
  unreadCount: 1,
};

test("parses strict login, session and overview contracts", () => {
  assert.deepEqual(
    parseBeautyDocsLoginCredentials({
      email: "owner@example.com",
      password: "secret password",
    }),
    { email: "owner@example.com", password: "secret password" },
  );
  assert.deepEqual(parseBeautyDocsAdminSession(validSession), validSession);
  assert.deepEqual(parseBeautyDocsTenantOverview(validOverview), validOverview);
});

test("parses form duration and keeps a safe fallback for an older API", () => {
  const form = {
    code: "brows",
    name: "Makijaż permanentny",
    description: null,
    enabled: true,
    displayOrder: 0,
    version: 1,
    questionCount: 20,
  };

  assert.equal(
    parseBeautyDocsAdminFormEntry({ ...form, durationMinutes: 90 })
      .durationMinutes,
    90,
  );
  assert.equal(parseBeautyDocsAdminFormEntry(form).durationMinutes, 60);
});

test("parses the strict salon notification inbox contract", () => {
  assert.deepEqual(
    parseBeautyDocsAdminNotificationList(validNotificationList),
    validNotificationList,
  );
  assert.equal(isBeautyDocsNotificationId(notificationId), true);
  assert.throws(
    () =>
      parseBeautyDocsAdminNotificationList({
        ...validNotificationList,
        items: [{ ...validNotificationList.items[0], unknown: true }],
      }),
    BeautyDocsAdminContractError,
  );
});

test("parses strict optional MFA state and challenge contracts", () => {
  assert.deepEqual(
    parseBeautyDocsMfaState({
      enabled: false,
      method: null,
      destinationMasked: null,
      enabledAt: null,
    }),
    {
      enabled: false,
      method: null,
      destinationMasked: null,
      enabledAt: null,
    },
  );
  assert.equal(
    parseBeautyDocsMfaLoginChallenge({
      mfaRequired: true,
      challengeId: notificationId,
      method: "SMS",
      destinationMasked: "+48••••••700",
      expiresInSeconds: 300,
      devCode: null,
    }).method,
    "SMS",
  );
  assert.equal(
    parseBeautyDocsMfaChallenge({
      challengeId: notificationId,
      purpose: "ENROLLMENT",
      method: "TOTP",
      destinationMasked: null,
      expiresInSeconds: 300,
      devCode: null,
      secret: "JBSWY3DPEHPK3PXP",
      qrCodeDataUrl: "data:image/png;base64,AAAA",
    }).purpose,
    "ENROLLMENT",
  );
  assert.throws(
    () =>
      parseBeautyDocsMfaState({
        enabled: false,
        method: "SMS",
        destinationMasked: null,
        enabledAt: null,
      }),
    BeautyDocsAdminContractError,
  );
});

test("rejects snake_case, missing fields and unsupported roles", () => {
  assert.throws(
    () =>
      parseBeautyDocsAdminSession({
        ...validSession,
        memberships: [
          {
            tenant_slug: "powderbrows",
            tenantDisplayName: "PowderBrows Academy",
            role: "OWNER",
          },
        ],
      }),
    BeautyDocsAdminContractError,
  );
  assert.throws(
    () =>
      parseBeautyDocsTenantOverview({
        ...validOverview,
        capabilities: {
          ...validOverview.capabilities,
          canManageMembers: "yes",
        },
      }),
    BeautyDocsAdminContractError,
  );
  assert.throws(
    () =>
      parseBeautyDocsTenantOverview({
        ...validOverview,
        membership: { role: "PLATFORM_ADMIN" },
      }),
    BeautyDocsAdminContractError,
  );
  assert.throws(
    () => parseBeautyDocsLoginCredentials({ email: "owner@example.com" }),
    BeautyDocsAdminContractError,
  );
});

test("maps auth and overview API statuses without forwarding error details", () => {
  assert.deepEqual(parseBeautyDocsAdminSessionResponse(401, "not-json"), {
    status: "unauthorized",
  });
  assert.deepEqual(parseBeautyDocsAdminSessionResponse(503, "not-json"), {
    status: "unavailable",
  });
  assert.equal(
    parseBeautyDocsAdminSessionResponse(200, JSON.stringify(validSession)).status,
    "ok",
  );

  assert.deepEqual(parseBeautyDocsTenantOverviewResponse(403, "secret details"), {
    status: "forbidden",
  });
  assert.deepEqual(parseBeautyDocsTenantOverviewResponse(404, "secret details"), {
    status: "not-found",
  });
  assert.deepEqual(parseBeautyDocsTenantOverviewResponse(503, "secret details"), {
    status: "unavailable",
  });
  assert.equal(
    parseBeautyDocsTenantOverviewResponse(200, JSON.stringify(validOverview)).status,
    "ok",
  );
});

test("parses strict client list query, list and profile contracts", () => {
  assert.deepEqual(parseBeautyDocsClientListQuery({}), {
    search: "",
    page: 1,
    pageSize: 20,
  });
  assert.deepEqual(
    parseBeautyDocsClientListQuery({
      search: "  Anna Nowak  ",
      page: "2",
      pageSize: "50",
    }),
    { search: "Anna Nowak", page: 2, pageSize: 50 },
  );
  assert.deepEqual(parseBeautyDocsAdminClientList(validClientList), validClientList);
  assert.deepEqual(
    parseBeautyDocsAdminClientProfile(validClientProfile),
    validClientProfile,
  );
  assert.equal(isBeautyDocsClientId(clientId), true);
  assert.equal(isBeautyDocsClientId("not-a-uuid"), false);
  assert.deepEqual(
    parseBeautyDocsAdminClientFormDetail(validClientFormDetail),
    validClientFormDetail,
  );
  assert.equal(
    isBeautyDocsSubmissionId(validClientFormDetail.submission.id),
    true,
  );
  assert.equal(isBeautyDocsSignatureKey("podpisDane"), true);
  assert.equal(isBeautyDocsSignatureKey("podpis-rodo_2"), true);
  assert.equal(isBeautyDocsSignatureKey("../podpisDane"), false);
  assert.equal(isBeautyDocsSignatureKey("podpis dane"), false);
});

test("rejects unsafe client filters and inconsistent client responses", () => {
  assert.throws(
    () => parseBeautyDocsClientListQuery({ search: "a" }),
    BeautyDocsAdminContractError,
  );
  assert.throws(
    () => parseBeautyDocsClientListQuery({ page: "0" }),
    BeautyDocsAdminContractError,
  );
  assert.throws(
    () =>
      parseBeautyDocsAdminClientList({
        ...validClientList,
        totalPages: 2,
      }),
    BeautyDocsAdminContractError,
  );
  assert.throws(
    () =>
      parseBeautyDocsAdminClientList({
        ...validClientList,
        items: [{ ...validClientList.items[0], first_name: "Anna" }],
      }),
    BeautyDocsAdminContractError,
  );
  assert.throws(
    () =>
      parseBeautyDocsAdminClientProfile({
        ...validClientProfile,
        visits: {
          ...validClientProfile.visits,
          items: [{ ...validClientProfile.visits.items[0], status: "UNKNOWN" }],
        },
      }),
    BeautyDocsAdminContractError,
  );
  assert.throws(
    () =>
      parseBeautyDocsAdminClientProfile({
        ...validClientProfile,
        notes: { ...validClientProfile.notes, total: 2, truncated: false },
      }),
    BeautyDocsAdminContractError,
  );
});

test("maps client API statuses and invalid bodies without leaking details", () => {
  assert.equal(
    parseBeautyDocsAdminClientListResponse(
      200,
      JSON.stringify(validClientList),
    ).status,
    "ok",
  );
  assert.equal(
    parseBeautyDocsAdminClientProfileResponse(
      200,
      JSON.stringify(validClientProfile),
    ).status,
    "ok",
  );
  assert.deepEqual(parseBeautyDocsAdminClientListResponse(422, "details"), {
    status: "invalid-request",
  });
  assert.deepEqual(parseBeautyDocsAdminClientProfileResponse(404, "details"), {
    status: "not-found",
  });
  assert.deepEqual(parseBeautyDocsAdminClientListResponse(200, "{}"), {
    status: "unavailable",
  });
  assert.equal(
    parseBeautyDocsAdminClientFormDetailResponse(
      200,
      JSON.stringify(validClientFormDetail),
    ).status,
    "ok",
  );
  assert.deepEqual(
    parseBeautyDocsAdminClientFormDetailResponse(404, "private details"),
    { status: "not-found" },
  );
  assert.deepEqual(
    parseBeautyDocsAdminClientFormDetailResponse(
      200,
      JSON.stringify({
        ...validClientFormDetail,
        signatureKeys: ["podpisDane", "podpisDane"],
      }),
    ),
    { status: "unavailable" },
  );
});

test("parses team profiles and accepts the create endpoint's 201 response", () => {
  assert.deepEqual(parseBeautyDocsAdminTeam(validTeam), validTeam);
  assert.equal(isBeautyDocsTeamMemberId(teamMemberId), true);
  assert.equal(isBeautyDocsTeamMemberId(clientId), true);
  assert.equal(isBeautyDocsTeamMemberId("not-a-uuid"), false);
  assert.deepEqual(
    parseBeautyDocsAdminTeamResponse(200, JSON.stringify(validTeam)),
    { status: "ok", data: validTeam },
  );
  assert.deepEqual(
    parseBeautyDocsAdminTeamMemberResponse(
      201,
      JSON.stringify(validTeamMember),
    ),
    { status: "ok", data: validTeamMember },
  );
  assert.deepEqual(parseBeautyDocsAdminTeamResponse(403, "private details"), {
    status: "forbidden",
  });
});

test("parses immutable practitioner attribution in a filled form", () => {
  const attributedForm = {
    ...validClientFormDetail,
    practitioner: {
      id: teamMemberId,
      displayName: "Anna Nowak",
      jobTitle: "Kosmetolog",
      signatureConfigured: true,
      smsSigningReady: true,
      canCurrentUserSign: false,
      signedAt: "2026-07-19T09:05:00Z",
      verificationDestinationMasked: "+48••••••900",
      verificationVerifiedAt: "2026-07-19T09:04:00Z",
    },
  };

  assert.deepEqual(
    parseBeautyDocsAdminClientFormDetail(attributedForm),
    attributedForm,
  );
  assert.throws(
    () =>
      parseBeautyDocsAdminClientFormDetail({
        ...attributedForm,
        practitioner: {
          ...attributedForm.practitioner,
          signatureConfigured: "yes",
        },
      }),
    BeautyDocsAdminContractError,
  );
});

test("validates same-origin mutations without trusting forwarded headers", () => {
  assert.equal(
    validatedSameOrigin({
      origin: "https://app.beautydocs.pl",
      host: "app.beautydocs.pl",
      requestProtocol: "https:",
      forwardedHost: "attacker.example",
      forwardedProto: "http",
    }),
    "https://app.beautydocs.pl",
  );
  assert.equal(
    validatedSameOrigin({
      origin: "https://attacker.example",
      host: "app.beautydocs.pl",
      requestProtocol: "https:",
      forwardedHost: "attacker.example",
    }),
    null,
  );
  assert.equal(
    validatedSameOrigin({
      origin: "http://localhost:3000",
      host: "localhost:3000",
      requestProtocol: "http:",
    }),
    "http://localhost:3000",
  );
  assert.equal(
    validatedSameOrigin({
      origin: "http://app.beautydocs.pl",
      host: "app.beautydocs.pl",
      requestProtocol: "http:",
    }),
    null,
  );
});

test("forwards only an exact BeautyDocs session token", () => {
  assert.equal(
    filterBeautyDocsSessionCookie(
      `legacy=value; beautydocs_session=${sessionToken}; analytics=123`,
    ),
    `beautydocs_session=${sessionToken}`,
  );
  assert.equal(
    filterBeautyDocsSessionCookie("beautydocs_session=too-short"),
    null,
  );
  assert.equal(
    filterBeautyDocsSessionCookie(
      `beautydocs_session=${sessionToken}; beautydocs_session=${sessionToken}`,
    ),
    null,
  );
  assert.equal(filterBeautyDocsSessionCookie("legacy=value"), null);
});

test("accepts a protected host-only Set-Cookie and requires Secure on HTTPS", () => {
  const secureCookie = `beautydocs_session=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Secure`;
  const localCookie = `beautydocs_session=${sessionToken}; Path=/; HttpOnly; SameSite=Lax`;

  assert.equal(selectBeautyDocsSessionSetCookie([secureCookie], true), secureCookie);
  assert.equal(selectBeautyDocsSessionSetCookie([localCookie], false), localCookie);
  assert.equal(selectBeautyDocsSessionSetCookie([localCookie], true), null);
});

test("rejects unsafe session cookie attributes", () => {
  const base = `beautydocs_session=${sessionToken}`;

  assert.equal(
    selectBeautyDocsSessionSetCookie(
      [`${base}; Path=/; HttpOnly; SameSite=Lax; Secure; Domain=beautydocs.pl`],
      true,
    ),
    null,
  );
  assert.equal(
    selectBeautyDocsSessionSetCookie(
      [`${base}; Path=/; SameSite=Lax; Secure`],
      true,
    ),
    null,
  );
  assert.equal(
    selectBeautyDocsSessionSetCookie(
      [`${base}; Path=/; HttpOnly; Secure`],
      true,
    ),
    null,
  );
  assert.equal(
    selectBeautyDocsSessionSetCookie(
      [`${base}; HttpOnly; SameSite=Lax; Secure`],
      true,
    ),
    null,
  );
});

test("accepts only a protected explicit session deletion cookie", () => {
  const deletion =
    "beautydocs_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Secure";

  assert.equal(selectBeautyDocsSessionSetCookie([deletion], true), deletion);
  assert.equal(
    selectBeautyDocsSessionSetCookie(
      ["beautydocs_session=; Path=/; HttpOnly; SameSite=Lax; Secure"],
      true,
    ),
    null,
  );
});

test("isolates and validates the consumer session cookie", () => {
  const secureCookie =
    `beautydocs_consumer_session=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Secure`;
  const deletion =
    "beautydocs_consumer_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Secure";

  assert.equal(
    filterBeautyDocsConsumerSessionCookie(
      `beautydocs_session=${sessionToken}; beautydocs_consumer_session=${sessionToken}; analytics=123`,
    ),
    `beautydocs_consumer_session=${sessionToken}`,
  );
  assert.equal(
    filterBeautyDocsConsumerSessionCookie(
      `beautydocs_consumer_session=${sessionToken}; beautydocs_consumer_session=${sessionToken}`,
    ),
    null,
  );
  assert.equal(
    selectBeautyDocsConsumerSessionSetCookie([secureCookie], true),
    secureCookie,
  );
  assert.equal(
    selectBeautyDocsConsumerSessionSetCookie([deletion], true),
    deletion,
  );
  assert.equal(
    selectBeautyDocsConsumerSessionSetCookie(
      [
        `beautydocs_consumer_session=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Secure; Domain=beautydocs.pl`,
      ],
      true,
    ),
    null,
  );
});
