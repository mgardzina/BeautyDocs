export type BeautyDocsMembershipRole =
  | "OWNER"
  | "ADMIN"
  | "STAFF"
  | "READ_ONLY";

export interface BeautyDocsAdminSession {
  readonly user: {
    readonly email: string;
    readonly displayName: string;
  };
  readonly memberships: readonly BeautyDocsAdminMembership[];
}

export type BeautyDocsMfaMethod = "SMS" | "TOTP";
export type BeautyDocsMfaChallengePurpose =
  | "ENROLLMENT"
  | "LOGIN"
  | "DISABLE"
  | "CHANGE";

export interface BeautyDocsMfaChangeAuthorization {
  readonly changeChallengeId: string;
  readonly expiresInSeconds: number;
}

export interface BeautyDocsMfaState {
  readonly enabled: boolean;
  readonly method: BeautyDocsMfaMethod | null;
  readonly destinationMasked: string | null;
  readonly enabledAt: string | null;
}

export interface BeautyDocsMfaLoginChallenge {
  readonly mfaRequired: true;
  readonly challengeId: string;
  readonly method: BeautyDocsMfaMethod;
  readonly destinationMasked: string | null;
  readonly expiresInSeconds: number;
  readonly devCode: string | null;
}

export interface BeautyDocsMfaChallenge {
  readonly challengeId: string;
  readonly purpose: BeautyDocsMfaChallengePurpose;
  readonly method: BeautyDocsMfaMethod;
  readonly destinationMasked: string | null;
  readonly expiresInSeconds: number;
  readonly devCode: string | null;
  readonly secret: string | null;
  readonly qrCodeDataUrl: string | null;
}

export interface BeautyDocsAdminMembership {
  readonly tenantSlug: string;
  readonly tenantDisplayName: string;
  readonly role: BeautyDocsMembershipRole;
}

export interface BeautyDocsBookingDay {
  readonly weekday: number;
  readonly enabled: boolean;
  readonly opensAt: string;
  readonly closesAt: string;
}

export interface BeautyDocsBookingSchedule {
  readonly slotIntervalMinutes: 15 | 30 | 60;
  readonly days: readonly BeautyDocsBookingDay[];
}

export interface BeautyDocsTenantSettings {
  readonly slug: string;
  readonly displayName: string;
  readonly legalName: string;
  readonly nip: string | null;
  readonly regon: string | null;
  readonly krs: string | null;
  readonly email: string;
  readonly privacyContactEmail: string;
  readonly phone: string | null;
  readonly websiteUrl: string | null;
  readonly logoImage: string | null;
  readonly addressLine1: string | null;
  readonly addressLine2: string | null;
  readonly postalCode: string | null;
  readonly city: string | null;
  readonly countryCode: string;
  readonly directoryVisible: boolean;
  readonly bookingSchedule: BeautyDocsBookingSchedule;
  readonly role: BeautyDocsMembershipRole;
  readonly canEdit: boolean;
  readonly canDelete: boolean;
}

export interface BeautyDocsTenantOverview {
  readonly tenant: {
    readonly slug: string;
    readonly displayName: string;
    readonly legalName: string;
  };
  readonly membership: {
    readonly role: BeautyDocsMembershipRole;
  };
  readonly capabilities: {
    readonly canViewClients: boolean;
    readonly canManageClients: boolean;
    readonly canManageForms: boolean;
    readonly canManageMembers: boolean;
  };
  readonly stats: {
    readonly clientsCount: number;
    readonly activeFormsCount: number;
    readonly formSubmissionsCount: number;
    readonly signedFormSubmissionsCount: number;
  };
}

export interface BeautyDocsTenantAnalytics {
  readonly weeks: readonly {
    readonly weekStart: string;
    readonly visits: number;
    readonly newClients: number;
    readonly submissions: number;
  }[];
  readonly treatments: readonly {
    readonly label: string;
    readonly count: number;
  }[];
}

export interface BeautyDocsAdminVisit {
  readonly id: string;
  readonly clientId: string;
  readonly clientName: string;
  readonly clientPhone: string | null;
  readonly treatmentName: string;
  readonly formCode: string | null;
  readonly formName: string | null;
  readonly startsAt: string;
  readonly endsAt: string | null;
  readonly status: "PLANNED" | "COMPLETED" | "CANCELLED";
  readonly formSubmitted: boolean;
}

export interface BeautyDocsAdminVisitList {
  readonly items: readonly BeautyDocsAdminVisit[];
  readonly dateFrom: string;
  readonly dateTo: string;
  readonly bookingSchedule: BeautyDocsBookingSchedule;
}

export interface BeautyDocsAdminClientListItem {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly phone: string | null;
  readonly email: string | null;
  readonly archivedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface BeautyDocsAdminClientList {
  readonly items: readonly BeautyDocsAdminClientListItem[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
}

export interface BeautyDocsAdminClient {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly phone: string | null;
  readonly email: string | null;
  readonly birthDate: string | null;
  readonly archivedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type BeautyDocsVisitStatus = "PLANNED" | "COMPLETED" | "CANCELLED";
export type BeautyDocsSubmissionStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "SIGNED"
  | "VOID";
export type BeautyDocsClientNoteCategory =
  | "NOTATKA"
  | "ALERGIA"
  | "UWAGA"
  | "PREFERENCJA";

export interface BeautyDocsAdminClientVisit {
  readonly id: string;
  readonly treatmentName: string;
  readonly startsAt: string;
  readonly endsAt: string | null;
  readonly status: BeautyDocsVisitStatus;
  readonly notes: string | null;
  readonly anaesthesia: string | null;
}

export interface BeautyDocsAdminClientNote {
  readonly id: string;
  readonly body: string;
  readonly category: BeautyDocsClientNoteCategory;
  readonly createdAt: string;
  readonly editedAt: string | null;
}

export interface BeautyDocsAdminClientForm {
  readonly id: string;
  readonly visitId: string | null;
  readonly templateCode: string;
  readonly templateName: string;
  readonly status: BeautyDocsSubmissionStatus;
  readonly submittedAt: string | null;
  readonly signedAt: string | null;
  readonly createdAt: string;
}

export interface BeautyDocsAdminClientCollection<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly truncated: boolean;
}

export interface BeautyDocsAdminClientProfile {
  readonly client: BeautyDocsAdminClient;
  readonly visits: BeautyDocsAdminClientCollection<BeautyDocsAdminClientVisit>;
  readonly notes: BeautyDocsAdminClientCollection<BeautyDocsAdminClientNote>;
  readonly forms: BeautyDocsAdminClientCollection<BeautyDocsAdminClientForm>;
}

export type BeautyDocsAdminFormAnswerKind =
  | "field"
  | "contraindication"
  | "consent"
  | "signature"
  | "treatment_area"
  | "place_and_date";

export interface BeautyDocsAdminFormAnswer {
  readonly key: string;
  readonly label: string;
  readonly kind: BeautyDocsAdminFormAnswerKind;
  readonly value: string | null;
  readonly detail: string | null;
}

export interface BeautyDocsAdminFormAnswerSection {
  readonly key: string;
  readonly title: string;
  readonly items: readonly BeautyDocsAdminFormAnswer[];
}

export interface BeautyDocsFormPrintMetadata {
  readonly salonName: string;
  readonly formName: string;
  readonly templateVersion: number | null;
  readonly clientSignedAt: string | null;
  readonly documentHash: string | null;
}

export interface BeautyDocsAdminClientFormDetail {
  readonly printMetadata?: BeautyDocsFormPrintMetadata | null;
  readonly client: {
    readonly id: string;
    readonly firstName: string;
    readonly lastName: string;
  };
  readonly submission: {
    readonly id: string;
    readonly visitId: string | null;
    readonly templateCode: string;
    readonly templateName: string;
    readonly templateVersion: number;
    readonly status: BeautyDocsSubmissionStatus;
    readonly submittedAt: string | null;
    readonly signedAt: string | null;
    readonly createdAt: string;
  };
  readonly sections: readonly BeautyDocsAdminFormAnswerSection[];
  readonly anatomy: {
    readonly model: "face" | "body" | "both";
    readonly faceZoneSet: string | null;
    readonly bodyZoneSet: string | null;
  } | null;
  readonly treatmentAreaIds: readonly string[];
  readonly signatureKeys: readonly string[];
  readonly practitioner: {
    readonly id: string;
    readonly displayName: string;
    readonly jobTitle: string | null;
    readonly signatureConfigured: boolean;
    readonly smsSigningReady: boolean;
    readonly canCurrentUserSign: boolean;
    readonly signedAt: string | null;
    readonly verificationDestinationMasked: string | null;
    readonly verificationVerifiedAt: string | null;
  } | null;
  readonly documentHash: string | null;
}

export interface BeautyDocsPractitionerVerificationStart {
  readonly verificationId: string;
  readonly destinationMasked: string;
  readonly expiresInSeconds: number;
  readonly devCode: string | null;
}

export interface BeautyDocsPractitionerSignatureResult {
  readonly submissionId: string;
  readonly status: "SIGNED";
  readonly practitionerSignedAt: string;
  readonly documentHash: string;
}

export interface BeautyDocsAdminTeamMember {
  readonly id: string;
  readonly displayName: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly jobTitle: string | null;
  readonly isOwner: boolean;
  readonly performsTreatments: boolean;
  readonly allTreatments: boolean;
  readonly treatmentCodes: readonly string[];
  readonly isActive: boolean;
  readonly hasPanelAccess: boolean;
  readonly signatureConfigured: boolean;
  readonly smsSigningReady: boolean;
  readonly signatureUpdatedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface BeautyDocsAdminTeam {
  readonly items: readonly BeautyDocsAdminTeamMember[];
  readonly canManage: boolean;
}

export interface BeautyDocsStaffInvitation {
  readonly email: string;
  readonly salonName: string;
  readonly expiresAt: string;
}

export interface BeautyDocsStaffInvitationCreated
  extends BeautyDocsStaffInvitation {
  readonly id: string;
  readonly activationUrl: string;
  readonly qrCodeDataUrl: string;
}

export interface BeautyDocsAdminClientListQuery {
  readonly search: string;
  readonly page: number;
  readonly pageSize: number;
}

/** One platform form template with the salon's enable state. */
export interface BeautyDocsAdminForm {
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly enabled: boolean;
  readonly displayOrder: number;
  readonly version: number | null;
  readonly questionCount: number;
  /** Expected treatment time used to size visits and calculate availability. */
  readonly durationMinutes: number;
}

export interface BeautyDocsAdminFormList {
  readonly forms: readonly BeautyDocsAdminForm[];
  readonly canManage: boolean;
}

/** Full published content of one form, for the owner to preview before enabling it. */
export interface BeautyDocsAdminFormPreview {
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly version: number;
  readonly definition: BeautyDocsFormDefinition;
  readonly legal: BeautyDocsFormLegalContent;
  readonly practitioners: readonly BeautyDocsAdminFormPreviewPractitioner[];
}

export interface BeautyDocsAdminFormPreviewPractitioner {
  readonly id: string;
  readonly displayName: string;
  readonly jobTitle: string | null;
}

export interface BeautyDocsFormDefinition {
  readonly treatment: string | null;
  readonly anatomy: {
    readonly model: "face" | "body" | "both";
    readonly faceZoneSet: string | null;
    readonly bodyZoneSet: string | null;
  } | null;
  readonly sections: readonly BeautyDocsFormSection[];
}

export type BeautyDocsFormSection =
  | {
      readonly kind: "fields";
      readonly key: string;
      readonly title: string;
      readonly fields: readonly {
        readonly key: string;
        readonly label: string;
        readonly type: string;
        readonly required: boolean;
      }[];
    }
  | {
      readonly kind: "contraindications";
      readonly key: string;
      readonly title: string;
      readonly categories: readonly string[];
      readonly items: readonly {
        readonly key: string;
        readonly question: string;
        readonly hasFollowUp: boolean;
        readonly followUpPlaceholder: string | null;
        readonly category: string | null;
      }[];
    };

export interface BeautyDocsFormLegalContent {
  readonly documentForm: string | null;
  readonly consents: readonly {
    readonly key: string;
    readonly title: string | null;
    readonly required: boolean;
    readonly text: string;
  }[];
  readonly documents: readonly {
    readonly key: string;
    readonly title: string;
    readonly text: string;
  }[];
}

export type BeautyDocsAdminNotificationKind =
  | "PRACTITIONER_SIGNATURE_REQUIRED";

export type BeautyDocsAdminNotificationSeverity = "INFO" | "ACTION_REQUIRED";

export interface BeautyDocsAdminNotification {
  readonly id: string;
  readonly kind: BeautyDocsAdminNotificationKind;
  readonly severity: BeautyDocsAdminNotificationSeverity;
  readonly title: string;
  readonly body: string;
  readonly actionLabel: string | null;
  readonly clientId: string | null;
  readonly submissionId: string | null;
  readonly clientName: string | null;
  readonly formName: string | null;
  readonly practitionerName: string | null;
  readonly createdAt: string;
  readonly readAt: string | null;
  readonly resolvedAt: string | null;
  readonly archivedAt: string | null;
}

export interface BeautyDocsAdminNotificationList {
  readonly items: readonly BeautyDocsAdminNotification[];
  readonly unreadCount: number;
}
