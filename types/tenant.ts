/**
 * Public, read-only salon data that may be exposed to an unauthenticated page.
 *
 * Keep credentials, billing data, internal identifiers and feature permissions
 * out of this contract. A path-derived slug is only a lookup key; it is never
 * an authorization boundary.
 */
export interface TenantPublicConfig {
  readonly slug: string;
  readonly displayName: string;
  readonly legalName: string;
  readonly logoUrl: string | null;
  readonly legal: TenantLegalDetails;
  readonly contact: TenantPublicContact;
  readonly activeForms: readonly TenantActiveForm[];
}

export interface TenantLegalDetails {
  readonly nip: string | null;
  readonly address: TenantPostalAddress | null;
  readonly privacyContactEmail: string | null;
}

export interface TenantPostalAddress {
  readonly street: string;
  readonly postalCode: string;
  readonly city: string;
  readonly countryCode: string;
}

export interface TenantPublicContact {
  readonly phone: string | null;
  readonly email: string | null;
  readonly websiteUrl: string | null;
}

/** A centrally managed BeautyDocs form enabled for this salon. */
export interface TenantActiveForm {
  readonly code: string;
  readonly displayName: string;
  readonly displayOrder: number;
}

/**
 * Published content of a strictly-defined BeautyDocs form, served to the public
 * salon page only when the salon has enabled it. The salon chooses which forms
 * appear; the platform defines their content.
 */
export interface PublicFormContent {
  readonly code: string;
  readonly displayName: string;
  readonly description: string | null;
  readonly version: number;
  readonly definition: FormDefinition;
  readonly legal: FormLegalContent;
  readonly practitioners: readonly PublicPractitioner[];
}

export interface PublicPractitioner {
  readonly id: string;
  readonly displayName: string;
  readonly jobTitle: string | null;
  readonly smsSigningReady: boolean;
}
export interface FormDefinition {
  readonly treatment: string | null;
  readonly anatomy: FormAnatomy | null;
  readonly sections: readonly FormSection[];
}

export interface FormAnatomy {
  readonly model: "face" | "body" | "both";
  readonly faceZoneSet: string | null;
  readonly bodyZoneSet: string | null;
}

export type FormSection = FormFieldSection | FormContraindicationsSection;

export interface FormFieldSection {
  readonly kind: "fields";
  readonly key: string;
  readonly title: string;
  readonly fields: readonly FormField[];
}

export interface FormField {
  readonly key: string;
  readonly label: string;
  /** text | date | tel | email | consent | signature */
  readonly type: string;
  readonly required: boolean;
}

export interface FormContraindicationsSection {
  readonly kind: "contraindications";
  readonly key: string;
  readonly title: string;
  readonly categories: readonly string[];
  readonly items: readonly FormContraindicationItem[];
}

export interface FormContraindicationItem {
  readonly key: string;
  readonly question: string;
  readonly hasFollowUp: boolean;
  readonly followUpPlaceholder: string | null;
  readonly category: string | null;
}

export interface FormLegalContent {
  readonly documentForm: string | null;
  readonly consents: readonly FormConsent[];
  readonly documents: readonly FormLegalDocument[];
}

/** A full document (e.g. treatment consent, RODO clause) tied to a signature field. */
export interface FormLegalDocument {
  readonly key: string;
  readonly title: string;
  readonly text: string;
}

export interface FormConsent {
  readonly key: string;
  readonly title: string | null;
  readonly required: boolean;
  readonly text: string;
}

export type BeautyDocsHostSurface =
  | "marketing"
  | "salon-app"
  | "public-forms"
  | "platform-admin"
  | "api"
  | "local-development"
  | "unknown";

interface BaseHostResolution {
  readonly hostname: string | null;
  readonly isLocalDevelopment: boolean;
}

export type BeautyDocsHostResolution =
  | (BaseHostResolution & {
      readonly surface: "marketing";
      readonly subdomain: "www" | null;
    })
  | (BaseHostResolution & {
      readonly surface: "salon-app";
      readonly subdomain: "app";
    })
  | (BaseHostResolution & {
      readonly surface: "public-forms";
      readonly subdomain: "forms";
    })
  | (BaseHostResolution & {
      readonly surface: "platform-admin";
      readonly subdomain: "admin";
    })
  | (BaseHostResolution & {
      readonly surface: "api";
      readonly subdomain: "api";
    })
  | (BaseHostResolution & {
      readonly surface: "local-development";
      readonly subdomain: null;
    })
  | (BaseHostResolution & {
      readonly surface: "unknown";
      readonly subdomain: null;
      readonly reason:
        | "missing-host"
        | "invalid-host"
        | "external-domain"
        | "nested-subdomain"
        | "invalid-subdomain"
        | "reserved-subdomain"
        | "unsupported-subdomain";
    });
