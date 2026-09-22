export type BeautyDocsCatalogKind =
  | "MEDICINE"
  | "TREATMENT_SUBSTANCE"
  | "DEVICE"
  | "COSMETIC";

export type BeautyDocsCatalogSource = "RPL" | "BEAUTYDOCS" | "SALON";

export interface BeautyDocsCatalogItem {
  readonly externalId: string;
  readonly kind: BeautyDocsCatalogKind;
  readonly source: BeautyDocsCatalogSource;
  readonly name: string;
  readonly brand: string | null;
  readonly summary: string;
  readonly details: Readonly<Record<string, unknown>>;
  readonly sourceLabel: string;
  readonly sourceUrl: string;
}

export interface BeautyDocsCatalogSearchResult {
  readonly items: readonly BeautyDocsCatalogItem[];
  readonly rplAvailable: boolean;
  readonly medicalNotice: string;
}

export interface BeautyDocsMedicineCatalogPage {
  readonly items: readonly BeautyDocsCatalogItem[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
  readonly rplAvailable: boolean;
  readonly medicalNotice: string;
}

export interface BeautyDocsCatalogProductList {
  readonly items: readonly BeautyDocsCatalogItem[];
}

export interface BeautyDocsSalonCatalogItem {
  readonly id: string;
  readonly source: BeautyDocsCatalogSource;
  readonly externalId: string | null;
  readonly kind: BeautyDocsCatalogKind;
  readonly name: string;
  readonly brand: string | null;
  readonly summary: string | null;
  readonly details: Readonly<Record<string, unknown>>;
  readonly sourceLabel: string | null;
  readonly sourceUrl: string | null;
  readonly usedInTreatments: boolean;
  readonly recommendedAftercare: boolean;
  readonly treatmentCodes: readonly string[];
  readonly recommendationNote: string | null;
  readonly isSponsored: boolean;
  readonly sponsorName: string | null;
  readonly isActive: boolean;
}

export interface BeautyDocsSalonCatalog {
  readonly items: readonly BeautyDocsSalonCatalogItem[];
  readonly canManage: boolean;
}

export interface BeautyDocsConsumerAftercare {
  readonly salonName: string;
  readonly treatmentCode: string;
  readonly items: readonly BeautyDocsSalonCatalogItem[];
  readonly notice: string;
}

export interface BeautyDocsSalonCatalogCreate {
  readonly source: BeautyDocsCatalogSource;
  readonly externalId: string | null;
  readonly kind: BeautyDocsCatalogKind;
  readonly name: string;
  readonly brand: string | null;
  readonly summary: string | null;
  readonly details: Readonly<Record<string, unknown>>;
  readonly sourceLabel: string | null;
  readonly sourceUrl: string | null;
  readonly usedInTreatments: boolean;
  readonly recommendedAftercare: boolean;
  readonly treatmentCodes: readonly string[];
  readonly recommendationNote: string | null;
}

export interface BeautyDocsSalonCatalogUpdate {
  readonly usedInTreatments: boolean;
  readonly recommendedAftercare: boolean;
  readonly treatmentCodes: readonly string[];
  readonly recommendationNote: string | null;
}
