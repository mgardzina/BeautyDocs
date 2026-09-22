/** Wire contracts for the SQLAlchemy-backed single-salon admin. */
export type LegacyJson = string | number | boolean | null | LegacyJson[] | { [key: string]: LegacyJson };

export interface LegacyClient {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  imieNazwisko: string;
  telefon: string | null;
}

export interface LegacyClientNote {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  content: string;
  category: "NOTATKA" | "ALERGIA" | "UWAGA" | "PREFERENCJA";
  clientId: string;
}

export interface LegacyConsentForm {
  id: string;
  type: "LIP_AUGMENTATION" | "FACIAL_VOLUMETRY" | "NEEDLE_MESOTHERAPY" | "INJECTION_LIPOLYSIS" | "PERMANENT_MAKEUP" | "LASER_HAIR_REMOVAL" | "LASER_TATTOO_REMOVAL" | "WRINKLE_REDUCTION" | "EYELID_LIFT" | "TISSUE_STIMULATION" | "EYEBROW_TINTING" | "EYELASH_EXTENSION" | "EYEBROW_LAMINATION" | "FACIAL_CLEANSING" | "HYALURONIC" | "PMU" | "LASER";
  createdAt: Date;
  imieNazwisko: string;
  email: string | null;
  ulica: string | null;
  kodPocztowy: string | null;
  miasto: string | null;
  dataUrodzenia: string | null;
  telefon: string;
  miejscowoscData: string;
  nazwaProduktu: string | null;
  obszarZabiegu: string | null;
  celEfektu: string | null;
  znieczulenie: string | null;
  przeciwwskazania: LegacyJson;
  zgodaPrzetwarzanieDanych: boolean;
  zgodaMarketing: boolean;
  zgodaFotografie: boolean;
  zgodaPomocPrawna: boolean;
  miejscaPublikacjiFotografii: string | null;
  podpisDane: string | null;
  podpisMarketing: string | null;
  podpisFotografie: string | null;
  podpisRodo: string | null;
  podpisRodo2: string | null;
  informacjaDodatkowa: string | null;
  zastrzeniaKlienta: string | null;
  numerZabiegu: string | null;
  osobaPrzeprowadzajacaZabieg: string | null;
  metodaZabiegu: string | null;
  planowanaIloscZabiegow: string | null;
  odstepMiedzyZabiegami: string | null;
  kolejneZabiegiOdstepy: string | null;
  iloscProduktu: string | null;
  signatureStatus: string | null;
  signatureVerifiedAt: Date | null;
  auditLog: LegacyJson;
  clientId: string | null;
}

export interface LegacyOtpVerification {
  id: string;
  phoneNumber: string;
  code: string;
  formId: string | null;
  expiresAt: Date;
  verified: boolean;
  attempts: number;
  createdAt: Date;
}

export interface LegacyAdminUser {
  id: string;
  email: string;
  phoneNumber: string | null;
  passwordHash: string;
  name: string | null;
}

export interface LegacyTreatmentHistory {
  id: string;
  createdAt: Date;
  date: Date;
  description: string;
  znieczulenie: string | null;
  formId: string;
}
