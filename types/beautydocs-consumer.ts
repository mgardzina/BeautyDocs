import type { BeautyDocsAdminFormAnswerSection, BeautyDocsFormPrintMetadata } from "./beautydocs-admin";

export interface BeautyDocsConsumerProfile {
  readonly fullName: string;
  readonly phone: string | null;
  readonly email: string | null;
  readonly birthDate: string | null;
  readonly street: string | null;
  readonly houseNumber: string | null;
  readonly apartmentNumber: string | null;
  readonly postalCode: string | null;
  readonly city: string | null;
  readonly medicalAnswers: Record<string, ConsumerMedicalAnswer>;
  readonly medicalProfileUpdatedAt: string | null;
  readonly signatureConfigured: boolean;
  readonly signatureUpdatedAt: string | null;
}

export interface ConsumerMedicalAnswer {
  readonly answer?: "yes" | "no" | null;
  readonly followUp?: string;
}

export interface BeautyDocsConsumerState {
  readonly profile: BeautyDocsConsumerProfile;
  readonly signInMethods: readonly ("password" | "google")[];
  readonly phoneVerified: boolean;
}

export interface BeautyDocsConsumerMedicalQuestion {
  readonly key: string;
  readonly question: string;
  readonly hasFollowUp: boolean;
  readonly followUpPlaceholder: string | null;
  readonly category: string | null;
  readonly sourceForms: readonly string[];
}

export interface BeautyDocsConsumerMedicalCatalog {
  readonly questions: readonly BeautyDocsConsumerMedicalQuestion[];
}

export interface BeautyDocsGoogleLoginConfig {
  readonly enabled: boolean;
  readonly clientId: string | null;
}

export interface BeautyDocsConsumerDocument {
  readonly submissionId: string;
  readonly tenantSlug: string;
  readonly salonName: string;
  readonly formCode: string;
  readonly formName: string;
  readonly status: string;
  readonly signedAt: string | null;
  readonly practitionerSignedAt: string | null;
  readonly sharedAt: string;
}

export interface BeautyDocsConsumerSalonForm {
  readonly code: string;
  readonly displayName: string;
}

export interface BeautyDocsConsumerSalon {
  readonly logoUrl?: string | null;
  readonly coverUrl?: string | null;
  readonly introduction?: string;
  readonly startingPrice?: number | null;
  readonly slug: string;
  readonly displayName: string;
  readonly city: string | null;
  readonly postalCode: string | null;
  readonly addressLine1: string | null;
  readonly addressLine2: string | null;
  readonly phone: string | null;
  readonly websiteUrl: string | null;
  readonly activeForms: readonly BeautyDocsConsumerSalonForm[];
}

export interface BeautyDocsConsumerSalonList {
  readonly items: readonly BeautyDocsConsumerSalon[];
}

export interface BeautyDocsConsumerAppointmentSlot {
  readonly startsAt: string;
  readonly endsAt: string;
}

export interface BeautyDocsConsumerAppointmentAvailability {
  readonly date: string;
  readonly timeZone: string;
  readonly slotMinutes: number;
  readonly slotIntervalMinutes: number;
  readonly slots: readonly BeautyDocsConsumerAppointmentSlot[];
}

export interface BeautyDocsConsumerAppointmentMonthDay {
  readonly date: string;
  readonly availableSlots: number;
}

export interface BeautyDocsConsumerAppointmentMonthAvailability {
  readonly month: string;
  readonly timeZone: string;
  readonly slotMinutes: number;
  readonly days: readonly BeautyDocsConsumerAppointmentMonthDay[];
}

export interface BeautyDocsConsumerAppointment {
  readonly id: string;
  readonly tenantSlug: string;
  readonly salonName: string;
  readonly formCode: string;
  readonly formName: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly status: "PLANNED" | "COMPLETED" | "CANCELLED";
  readonly formSubmitted: boolean;
}

export interface BeautyDocsConsumerAppointmentCreated
  extends BeautyDocsConsumerAppointment {
  readonly bookingToken: string;
}

export interface BeautyDocsConsumerAppointmentList {
  readonly items: readonly BeautyDocsConsumerAppointment[];
}

export interface BeautyDocsConsumerAppointmentFormAccess {
  readonly appointmentId: string;
  readonly tenantSlug: string;
  readonly formCode: string;
  readonly bookingToken: string;
}

export interface BeautyDocsConsumerDocumentDetail
  extends BeautyDocsConsumerDocument {
  readonly printMetadata?: BeautyDocsFormPrintMetadata | null;
  readonly client: Record<string, unknown>;
  readonly answers: Record<string, unknown>;
  readonly sections: readonly BeautyDocsAdminFormAnswerSection[];
  readonly anatomy: {
    readonly model: "face" | "body" | "both";
    readonly faceZoneSet: string | null;
    readonly bodyZoneSet: string | null;
  } | null;
  readonly treatmentAreaIds: readonly string[];
  readonly signatureKeys: readonly string[];
  readonly clientSignedAt: string | null;
  readonly practitioner: Record<string, unknown> | null;
}

export interface BeautyDocsConsumerLoginChallenge {
  readonly challengeId: string;
  readonly destinationMasked: string;
  readonly expiresInSeconds: number;
  readonly devCode: string | null;
}

export interface BeautyDocsConsumerEmailChallenge {
  readonly email: string;
  readonly expiresInSeconds: number;
  readonly devCode: string | null;
}

export interface BeautyDocsConsumerRegistrationToken {
  readonly email: string;
  readonly registrationToken: string;
}
