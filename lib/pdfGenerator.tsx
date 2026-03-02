/**
 * Serwer-side generator PDF dla kart zgody
 * Używa @react-pdf/renderer — działa TYLKO po stronie serwera (Node.js / Next.js API Routes)
 */
import React from "react";
import path from "path";
import fs from "fs";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  Svg,
  Path,
  renderToBuffer,
  Font,
} from "@react-pdf/renderer";

// Ścieżka do logo — bezwzględna, wymagana przez @react-pdf/renderer
const LOGO_PATH = path.join(process.cwd(), "public", "logo.png");
const FACE_CHART_PATH = path.join(
  process.cwd(),
  "public",
  "women-face-chart.jpg",
);
const BODY_CHART_PATH = path.join(
  process.cwd(),
  "public",
  "women-body-chart.JPG",
);

// Pre-load images as base64 data URLs for embedding in PDF diagrams
const FACE_CHART_B64 = `data:image/jpeg;base64,${fs.readFileSync(FACE_CHART_PATH).toString("base64")}`;
const BODY_CHART_B64 = `data:image/jpeg;base64,${fs.readFileSync(BODY_CHART_PATH).toString("base64")}`;

// ─── Rejestracja fontu z obsługą polskich znaków ────────────────────────────
Font.register({
  family: "Roboto",
  fonts: [
    {
      src: "https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-regular-webfont.ttf",
      fontWeight: "normal",
    },
    {
      src: "https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-bold-webfont.ttf",
      fontWeight: "bold",
    },
    {
      src: "https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-italic-webfont.ttf",
      fontStyle: "italic",
    },
  ],
});

// ─── Mapowanie nazw stref zabiegowych (ID → polska nazwa) ──────────────────
const ZONE_NAME_MAP: Record<string, string> = {
  forehead: "Czoło",
  glabella: "Lwia Zmarszczka",
  nose: "Nos",
  eyebrow_right: "Brew Prawa",
  eyebrow_left: "Brew Lewa",
  left_eye: "Oko Lewe (Dolina łez)",
  right_eye: "Oko Prawe (Dolina łez)",
  left_cheek: "Policzek Lewy",
  right_cheek: "Policzek Prawy",
  lips: "Usta",
  chin: "Broda",
  marionette_lines: "Linie Marionetki",
  jaw_left: "Żuchwa (Lewa)",
  jaw_right: "Żuchwa (Prawa)",
  nasolabial_folds: "Bruzdy Nosowo-Wargowe",
  dekolt: "Dekolt",
  eyelid_left: "Powieka Lewa",
  eyelid_right: "Powieka Prawa",
  // Body zones
  arm_left: "Lewe Ramię",
  arm_right: "Prawe Ramię",
  forearm_left: "Lewe Przedramię",
  forearm_right: "Prawe Przedramię",
  belly: "Brzuch",
  chest: "Klatka Piersiowa",
  thight_left: "Lewe Udo",
  thight_right: "Prawe Udo",
  back: "Plecy",
  calf_left: "Lewa Łydka",
  calf_right: "Prawa Łydka",
  neck: "Szyja",
  shin_left: "Lewy Piszczel",
  shin_right: "Prawy Piszczel",
  bikini_area: "Bikini",
  ass: "Pośladki",
  face: "Twarz",
};

// Zbiory ID stref: twarz vs ciało
const FACE_ZONE_IDS = new Set([
  "forehead",
  "glabella",
  "nose",
  "eyebrow_right",
  "eyebrow_left",
  "left_eye",
  "right_eye",
  "left_cheek",
  "right_cheek",
  "lips",
  "chin",
  "marionette_lines",
  "jaw_left",
  "jaw_right",
  "nasolabial_folds",
  "dekolt",
  "eyelid_left",
  "eyelid_right",
  "neck",
]);

/** Rozdziela zone IDs na twarz i ciało */
function splitZonesByType(zones: string): { face: string[]; body: string[] } {
  const ids = zones
    .split(",")
    .map((z) => z.trim())
    .filter(Boolean);
  const face: string[] = [];
  const body: string[] = [];
  for (const id of ids) {
    if (FACE_ZONE_IDS.has(id)) {
      face.push(id);
    } else {
      body.push(id);
    }
  }
  return { face, body };
}

// ─── Import danych stref anatomicznych ────────────────────────────────────
import { ZONES as FACE_ZONES } from "@/types/face-zones";
import { BODY_ZONES } from "@/types/body-zones";

// ─── Import danych per-typ formularza ──────────────────────────────────────
import {
  modelowanieUstContraindications,
  modelowanieUstNaturalReactions,
  modelowanieUstPostCare,
  modelowanieUstComplications,
  wolumetriaTwarzyContraindications,
  wolumetriaTwarzyNaturalReactions,
  wolumetriaTwarzyPostCare,
  wolumetriaTwarzyComplications,
  mezoterapiaIglowaContraindications,
  mezoterapiaIglowaNaturalReactions,
  mezoterapiaIglowaPostCare,
  mezoterapiaIglowaComplications,
  mezoterapiaIglowaComplicationsVeryRare,
  lipolizaIniekcyjnaContraindications,
  lipolizaIniekcyjnaNaturalReactions,
  lipolizaIniekcyjnaPostCare,
  lipolizaIniekcyjnaComplications,
  makijazPermanentnyContraindications,
  makijazPermanentnyNaturalReactions,
  makijazPermanentnyPostCare,
  makijazPermanentnyComplications,
  depilacjaLaserowaContraindications,
  depilacjaLaserowaNaturalReactions,
  depilacjaLaserowaPostCare,
  depilacjaLaserowaComplications,
  laseroweUsuwanieContraindications,
  laseroweUsuwanieNaturalReactions,
  laseroweUsuwaniePostCare,
  laseroweUsuwanieComplications,
  biostymulatoryContraindications,
  biostymulatorySideEffects,
  biostymulatoryPostTreatment,
  biostymulatoryComplications,
  eyebrowTintingContraindications,
  eyebrowTintingPostCare,
  eyebrowLaminationContraindications,
  hyaluronicContraindications,
  hyaluronicNaturalReactions,
  hyaluronicPostCare,
  hyaluronicComplications,
  rodoInfo,
  ContraindicationWithFollowUp,
} from "@/types/booking";

// ─── Typy ─────────────────────────────────────────────────────────────────
interface ConsentFormData {
  id: string;
  type: string;
  createdAt: string;
  imieNazwisko: string;
  email?: string | null;
  ulica?: string | null;
  kodPocztowy?: string | null;
  miasto?: string | null;
  dataUrodzenia?: string | null;
  telefon: string;
  miejscowoscData: string;
  nazwaProduktu?: string | null;
  obszarZabiegu?: string | null;
  celEfektu?: string | null;
  przeciwwskazania: Record<string, string | boolean | null>;
  zgodaPrzetwarzanieDanych: boolean;
  zgodaMarketing: boolean;
  zgodaFotografie: boolean;
  zgodaPomocPrawna: boolean;
  miejscaPublikacjiFotografii?: string | null;
  podpisDane?: string | null;
  podpisMarketing?: string | null;
  podpisFotografie?: string | null;
  podpisRodo?: string | null;
  podpisRodo2?: string | null;
  informacjaDodatkowa?: string | null;
  zastrzeniaKlienta?: string | null;
  numerZabiegu?: string | null;
  osobaPrzeprowadzajacaZabieg?: string | null;
  planowanaIloscZabiegow?: string | null;
  odstepMiedzyZabiegami?: string | null;
  kolejneZabiegiOdstepy?: string | null;
  iloscProduktu?: string | null;
  signatureStatus?: string | null;
  signatureVerifiedAt?: string | null;
}

interface FormContent {
  title: string;
  subtitle: string;
  contraindications: Record<string, string | ContraindicationWithFollowUp>;
  naturalReactions?: string[];
  complications?: {
    czeste?: string[];
    rzadkie?: string[];
    bardzoRzadkie?: string[];
  };
  postCare?: string[];
  additionalComplications?: string[];
}

// ─── Mapowanie typ → dane formularza ──────────────────────────────────────
function getFormContent(type: string): FormContent {
  switch (type) {
    case "LIP_AUGMENTATION":
      return {
        title: "KARTA ZGODY NA ZABIEG MODELOWANIA UST",
        subtitle: "Modelowanie / Powiększanie Ust Kwasem Hialuronowym",
        contraindications: modelowanieUstContraindications,
        naturalReactions: modelowanieUstNaturalReactions,
        complications: modelowanieUstComplications,
        postCare: modelowanieUstPostCare,
      };
    case "FACIAL_VOLUMETRY":
    case "WRINKLE_REDUCTION":
      return {
        title: "KARTA ZGODY NA ZABIEG WOLUMETRII TWARZY",
        subtitle:
          "Wolumetria Twarzy / Niwelowanie Zmarszczek Kwasem Hialuronowym",
        contraindications: wolumetriaTwarzyContraindications,
        naturalReactions: wolumetriaTwarzyNaturalReactions,
        complications: wolumetriaTwarzyComplications,
        postCare: wolumetriaTwarzyPostCare,
      };
    case "NEEDLE_MESOTHERAPY":
      return {
        title: "KARTA ZGODY NA ZABIEG MEZOTERAPII IGŁOWEJ",
        subtitle: "Mezoterapia Igłowa",
        contraindications: mezoterapiaIglowaContraindications,
        naturalReactions: mezoterapiaIglowaNaturalReactions,
        complications: {
          czeste: mezoterapiaIglowaComplications,
          rzadkie: [],
          bardzoRzadkie: mezoterapiaIglowaComplicationsVeryRare,
        },
        postCare: mezoterapiaIglowaPostCare,
      };
    case "INJECTION_LIPOLYSIS":
      return {
        title: "KARTA ZGODY NA ZABIEG LIPOLIZY INIEKCYJNEJ",
        subtitle: "Lipoliza Iniekcyjna",
        contraindications: lipolizaIniekcyjnaContraindications,
        naturalReactions: lipolizaIniekcyjnaNaturalReactions,
        complications: lipolizaIniekcyjnaComplications,
        postCare: lipolizaIniekcyjnaPostCare,
      };
    case "PERMANENT_MAKEUP":
      return {
        title: "KARTA ZGODY NA MAKIJAŻ PERMANENTNY",
        subtitle: "Makijaż Permanentny",
        contraindications: makijazPermanentnyContraindications,
        naturalReactions: makijazPermanentnyNaturalReactions,
        complications: makijazPermanentnyComplications,
        postCare: makijazPermanentnyPostCare,
      };
    case "LASER_HAIR_REMOVAL":
      return {
        title: "KARTA ZGODY NA DEPILACJĘ LASEROWĄ",
        subtitle: "Depilacja Laserowa",
        contraindications: depilacjaLaserowaContraindications,
        naturalReactions: depilacjaLaserowaNaturalReactions,
        complications: depilacjaLaserowaComplications,
        postCare: depilacjaLaserowaPostCare,
      };
    case "LASER_TATTOO_REMOVAL":
    case "LASER":
      return {
        title: "KARTA ZGODY NA LASEROWE USUWANIE",
        subtitle: "Laserowe Usuwanie Tatuażu / Zmian Skórnych",
        contraindications: laseroweUsuwanieContraindications,
        naturalReactions: laseroweUsuwanieNaturalReactions,
        complications: laseroweUsuwanieComplications,
        postCare: laseroweUsuwaniePostCare,
      };
    case "TISSUE_STIMULATION":
      return {
        title: "KARTA ZGODY NA STYMULACJĘ TKANKOWĄ",
        subtitle: "Stymulacja Tkankowa (Biostymulatory)",
        contraindications: biostymulatoryContraindications,
        naturalReactions: biostymulatorySideEffects,
        complications: biostymulatoryComplications,
        postCare: biostymulatoryPostTreatment,
      };
    case "EYEBROW_TINTING":
      return {
        title: "KARTA ZGODY NA HENNA BRWI",
        subtitle: "Henna Brwi / Barwienie Brwi",
        contraindications: eyebrowTintingContraindications,
        postCare: eyebrowTintingPostCare,
      };
    case "EYEBROW_LAMINATION":
      return {
        title: "KARTA ZGODY NA LAMINACJĘ BRWI",
        subtitle: "Laminacja Brwi",
        contraindications: eyebrowLaminationContraindications,
      };
    case "EYELASH_EXTENSION":
      return {
        title: "KARTA ZGODY NA PRZEDŁUŻANIE RZĘS",
        subtitle: "Stylizacja / Przedłużanie Rzęs",
        contraindications: hyaluronicContraindications, // używa ogólnych
      };
    case "EYELID_LIFT":
      return {
        title: "KARTA ZGODY NA LIFTING POWIEK",
        subtitle: "Lifting Powiek",
        contraindications: hyaluronicContraindications,
      };
    // Legacy types
    case "HYALURONIC":
      return {
        title: "KARTA ZGODY NA ZABIEG KWASEM HIALURONOWYM",
        subtitle: "Zabieg z Kwasem Hialuronowym",
        contraindications: hyaluronicContraindications,
        naturalReactions: hyaluronicNaturalReactions,
        complications: hyaluronicComplications,
        postCare: hyaluronicPostCare,
      };
    case "PMU":
      return {
        title: "KARTA ZGODY NA MAKIJAŻ PERMANENTNY",
        subtitle: "Makijaż Permanentny (Legacy)",
        contraindications: makijazPermanentnyContraindications,
        naturalReactions: makijazPermanentnyNaturalReactions,
        complications: makijazPermanentnyComplications,
        postCare: makijazPermanentnyPostCare,
      };
    default:
      return {
        title: "KARTA ZGODY NA ZABIEG KOSMETYCZNY",
        subtitle: "Zabieg Kosmetyczny",
        contraindications: hyaluronicContraindications,
        naturalReactions: hyaluronicNaturalReactions,
        postCare: hyaluronicPostCare,
      };
  }
}

// ─── Kolory brandowe ───────────────────────────────────────────────────────
const GOLD = "#C9A84C";
const DARK = "#1a1a1a";
const GRAY = "#555555";
const LIGHT_GRAY = "#f5f5f5";
const WHITE = "#FFFFFF";
const RED = "#c0392b";
const GREEN_DARK = "#1a5c2a";

// ─── Style PDF ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  page: {
    paddingTop: 30,
    paddingBottom: 40,
    paddingHorizontal: 36,
    backgroundColor: WHITE,
    fontSize: 9,
    fontFamily: "Roboto",
    color: DARK,
  },
  // Header
  header: {
    borderBottomWidth: 2,
    borderBottomColor: GOLD,
    paddingBottom: 10,
    marginBottom: 14,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  salonName: {
    fontSize: 12,
    fontFamily: "Roboto",
    fontWeight: "bold",
    color: GOLD,
    marginTop: 2,
  },
  logoImage: {
    height: 60,
    width: 180,
    objectFit: "contain",
  },

  salonSubtitle: {
    fontSize: 8,
    color: GRAY,
    marginTop: 2,
  },
  headerDate: {
    fontSize: 8,
    color: GRAY,
    textAlign: "right",
  },
  docTitle: {
    marginTop: 10,
    fontSize: 13,
    fontFamily: "Roboto",
    fontWeight: "bold",
    color: DARK,
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  docSubtitle: {
    fontSize: 9,
    color: GOLD,
    textAlign: "center",
    marginTop: 3,
  },
  // Sekcje
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 8.5,
    fontFamily: "Roboto",
    fontWeight: "bold",
    color: GOLD,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    borderBottomWidth: 1,
    borderBottomColor: GOLD,
    paddingBottom: 3,
    marginBottom: 6,
  },
  // Dane osobowe
  row: {
    flexDirection: "row",
    marginBottom: 4,
  },
  label: {
    fontSize: 8,
    color: GRAY,
    width: 100,
    fontFamily: "Roboto",
    fontWeight: "bold",
  },
  value: {
    fontSize: 8.5,
    color: DARK,
    flex: 1,
  },
  // Przeciwwskazania
  contraindicationRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 3,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: "#e0e0e0",
  },
  contraindicationRowAlt: {
    backgroundColor: LIGHT_GRAY,
  },
  contraindicationText: {
    flex: 1,
    fontSize: 7.5,
    color: DARK,
    paddingRight: 6,
  },
  answerBadge: {
    width: 22,
    textAlign: "center",
    fontSize: 7.5,
    fontFamily: "Roboto",
    fontWeight: "bold",
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 2,
  },
  answerYes: {
    color: RED,
  },
  answerNo: {
    color: GREEN_DARK,
  },
  answerDetails: {
    fontSize: 7,
    color: GOLD,
    marginTop: 2,
    marginLeft: 4,
    flex: 1,
    fontFamily: "Roboto",
    fontStyle: "italic",
  },
  // Lista punktowana
  bulletItem: {
    flexDirection: "row",
    marginBottom: 2,
    alignItems: "flex-start",
  },
  bullet: {
    fontSize: 8,
    color: GOLD,
    width: 10,
  },
  goldDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: GOLD,
    marginRight: 6,
    marginTop: 3,
  },
  bulletText: {
    fontSize: 7.5,
    color: DARK,
    flex: 1,
  },
  // Podpis
  signatureSection: {
    marginTop: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: GOLD,
    borderRadius: 4,
  },
  signatureLabel: {
    fontSize: 8,
    color: GRAY,
    fontFamily: "Roboto",
    fontWeight: "bold",
    marginBottom: 4,
  },
  signatureImage: {
    height: 60,
    objectFit: "contain",
    marginBottom: 4,
  },
  signatureDate: {
    fontSize: 7.5,
    color: GRAY,
    textAlign: "right",
    fontFamily: "Roboto",
    fontStyle: "italic",
  },
  // Stopka
  footer: {
    position: "absolute",
    bottom: 18,
    left: 36,
    right: 36,
    borderTopWidth: 1,
    borderTopColor: GOLD,
    paddingTop: 4,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: {
    fontSize: 7,
    color: GRAY,
  },
  footerGold: {
    fontSize: 7,
    color: GOLD,
    fontFamily: "Roboto",
    fontWeight: "bold",
  },
  // Status badge
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    marginBottom: 10,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: GREEN_DARK,
    marginRight: 4,
  },
  statusText: {
    fontSize: 7.5,
    color: GREEN_DARK,
    fontFamily: "Roboto",
    fontWeight: "bold",
  },
  pageNumber: {
    fontSize: 7,
    color: GRAY,
    textAlign: "right",
  },
  consentBox: {
    backgroundColor: LIGHT_GRAY,
    padding: 8,
    borderRadius: 4,
    borderLeftWidth: 2,
    borderLeftColor: GOLD,
    marginBottom: 8,
  },
  consentText: {
    fontSize: 7.5,
    color: DARK,
    lineHeight: 1.4,
  },
  twoCol: {
    flexDirection: "row",
    gap: 8,
  },
  col: {
    flex: 1,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 2,
  },
  chip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: "#f0ebe0",
    borderRadius: 3,
    fontSize: 7.5,
  },
  zoneChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: "#f5f0e0",
    borderWidth: 1,
    borderColor: GOLD,
    borderRadius: 10,
    fontSize: 7,
    color: GOLD,
    fontFamily: "Roboto",
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  consentRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 3,
  },
  consentCheck: {
    width: 10,
    height: 10,
    borderWidth: 1,
    borderColor: GOLD,
    marginRight: 5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  consentCheckFilled: {
    width: 10,
    height: 10,
    borderWidth: 1,
    borderColor: GREEN_DARK,
    backgroundColor: GREEN_DARK,
    marginRight: 5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  checkMark: {
    fontSize: 8,
    color: WHITE,
    fontFamily: "Roboto",
    fontWeight: "bold",
  },
  consentLabel: {
    fontSize: 8,
    color: DARK,
    flex: 1,
  },
});

// ─── Helper: tekst przeciwwskazania ────────────────────────────────────────
function getContraText(val: string | ContraindicationWithFollowUp): string {
  if (typeof val === "string") return val;
  return val.text;
}

// ─── Komponenty schematów anatomicznych do PDF ──────────────────────────────

/** Schemat twarzy — zdjęcie twarzy z narośleżonymi strefami */
function FaceDiagramPDF({ selectedIds }: { selectedIds: string[] }) {
  const selected = new Set(selectedIds);
  return (
    <View style={{ width: 200, height: 200, position: "relative" }}>
      {/* Tło: zdjęcie twarzy */}
      <Image
        src={FACE_CHART_B64}
        style={{
          width: 200,
          height: 200,
          position: "absolute",
          top: 0,
          left: 0,
        }}
      />
      {/* Overlay SVG ze strefami */}
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 200,
          height: 200,
        }}
      >
        <Svg viewBox="0 0 980 980" style={{ width: 200, height: 200 }}>
          {FACE_ZONES.map((zone) =>
            selected.has(zone.id) ? (
              <Path
                key={zone.id}
                d={zone.d}
                fill="rgba(212, 175, 55, 0.55)"
                stroke="#D4AF37"
                strokeWidth={5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null,
          )}
        </Svg>
      </View>
    </View>
  );
}

/** Schemat ciała — zdjęcie ciała z narośleżonymi strefami */
function BodyDiagramPDF({ selectedIds }: { selectedIds: string[] }) {
  const selected = new Set(selectedIds);
  return (
    <View style={{ width: 140, height: 198, position: "relative" }}>
      {/* Tło: zdjęcie ciała */}
      <Image
        src={BODY_CHART_B64}
        style={{
          width: 140,
          height: 198,
          position: "absolute",
          top: 0,
          left: 0,
        }}
      />
      {/* Overlay SVG ze strefami */}
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 140,
          height: 198,
        }}
      >
        <Svg viewBox="0 0 724 1024" style={{ width: 140, height: 198 }}>
          {BODY_ZONES.map((zone) =>
            selected.has(zone.id) ? (
              <Path
                key={zone.id}
                d={zone.d}
                fill="rgba(212, 175, 55, 0.55)"
                stroke="#D4AF37"
                strokeWidth={5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null,
          )}
        </Svg>
      </View>
    </View>
  );
}

// ─── Komponent PDF ─────────────────────────────────────────────────────────
function ConsentFormPDF({
  form,
  content,
}: {
  form: ConsentFormData;
  content: FormContent;
}) {
  const formatDate = (d?: string | null) => {
    if (!d) return "—";
    // Already in dd.mm.rrrr format
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(d)) return d;
    try {
      const date = new Date(d);
      if (isNaN(date.getTime())) return d;
      return date.toLocaleDateString("pl-PL", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch {
      return d;
    }
  };

  const today = new Date().toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const kontraEntries = Object.entries(content.contraindications);
  const hasComplications =
    content.complications &&
    ((content.complications.czeste?.length ?? 0) > 0 ||
      (content.complications.rzadkie?.length ?? 0) > 0 ||
      (content.complications.bardzoRzadkie?.length ?? 0) > 0);

  return (
    <Document
      title={content.title}
      author={rodoInfo.firmaNazwa}
      subject="Karta Zgody na Zabieg"
    >
      {/* ═══ STRONA 1: Dane osobowe + Przeciwwskazania ═══ */}
      <Page size="A4" style={styles.page} wrap>
        {/* Header ze logo */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Image src={LOGO_PATH} style={styles.logoImage} />
              <Text style={styles.salonSubtitle}>{rodoInfo.adres}</Text>
            </View>
            <View>
              <Text style={styles.headerDate}>Data wydruku: {today}</Text>
              <Text style={styles.headerDate}>
                Nr doc.: {form.id.substring(0, 8).toUpperCase()}
              </Text>
            </View>
          </View>
          <Text style={styles.docTitle}>{content.title}</Text>
          <Text style={styles.docSubtitle}>{content.subtitle}</Text>
        </View>

        {/* Status podpisu SMS */}
        {form.signatureStatus === "VERIFIED" ||
        form.signatureStatus === "SIGNED" ? (
          <View style={styles.statusBadge}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>
              Podpis zweryfikowany elektronicznie
              {form.signatureVerifiedAt
                ? ` • ${formatDate(form.signatureVerifiedAt)}`
                : ""}
            </Text>
          </View>
        ) : null}

        {/* Dane osobowe */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dane Klienta</Text>
          <View style={styles.twoCol}>
            <View style={styles.col}>
              <View style={styles.row}>
                <Text style={styles.label}>Imię i nazwisko:</Text>
                <Text style={styles.value}>{form.imieNazwisko}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Data urodzenia:</Text>
                <Text style={styles.value}>
                  {formatDate(form.dataUrodzenia)}
                </Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Telefon:</Text>
                <Text style={styles.value}>{form.telefon}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Email:</Text>
                <Text style={styles.value}>{form.email || "—"}</Text>
              </View>
            </View>
            <View style={styles.col}>
              <View style={styles.row}>
                <Text style={styles.label}>Adres:</Text>
                <Text style={styles.value}>
                  {form.ulica ? `${form.ulica}, ` : ""}
                  {form.kodPocztowy ? `${form.kodPocztowy} ` : ""}
                  {form.miasto || "—"}
                </Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Data zabiegu:</Text>
                <Text style={styles.value}>{form.miejscowoscData}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Specjalista:</Text>
                <Text style={styles.value}>
                  {form.osobaPrzeprowadzajacaZabieg || "—"}
                </Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Typ zabiegu:</Text>
                <Text style={styles.value}>{content.subtitle}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Szczegóły zabiegu */}
        {(form.nazwaProduktu || form.iloscProduktu || form.celEfektu) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Szczegóły Zabiegu</Text>
            <View style={styles.twoCol}>
              <View style={styles.col}>
                {form.nazwaProduktu && (
                  <View style={styles.row}>
                    <Text style={styles.label}>Preparat:</Text>
                    <Text style={styles.value}>{form.nazwaProduktu}</Text>
                  </View>
                )}
                {form.iloscProduktu && (
                  <View style={styles.row}>
                    <Text style={styles.label}>Ilość:</Text>
                    <Text style={styles.value}>{form.iloscProduktu}</Text>
                  </View>
                )}
              </View>
              <View style={styles.col}>
                {form.celEfektu && (
                  <View style={styles.row}>
                    <Text style={styles.label}>Cel / efekt:</Text>
                    <Text style={styles.value}>{form.celEfektu}</Text>
                  </View>
                )}
              </View>
            </View>
            {/* Seria zabiegowa */}
            {form.planowanaIloscZabiegow && (
              <View style={styles.row}>
                <Text style={styles.label}>Seria:</Text>
                <Text style={styles.value}>
                  {form.planowanaIloscZabiegow} zabieg(i), odstęp:{" "}
                  {form.odstepMiedzyZabiegami || "—"}, kolejne:{" "}
                  {form.kolejneZabiegiOdstepy || "—"}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Obszar Zabiegu — tekstowe chipy stref + diagramy anatomiczne */}
        {form.obszarZabiegu &&
          (() => {
            const { face, body } = splitZonesByType(form.obszarZabiegu);
            const FORMS_WITH_FACE_SELECTOR: string[] = [
              "FACIAL_VOLUMETRY",
              "WRINKLE_REDUCTION",
              "TISSUE_STIMULATION",
              "PERMANENT_MAKEUP",
              "LASER_TATTOO_REMOVAL",
            ];
            const FORMS_WITH_BODY_SELECTOR: string[] = [
              "LASER_TATTOO_REMOVAL",
              "LASER_HAIR_REMOVAL",
            ];
            const showFaceDiagram =
              FORMS_WITH_FACE_SELECTOR.includes(form.type) && face.length > 0;
            const showBodyDiagram =
              FORMS_WITH_BODY_SELECTOR.includes(form.type) && body.length > 0;
            return (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Obszar Zabiegu</Text>
                <View style={{ gap: 6 }}>
                  {face.length > 0 && (
                    <View>
                      <Text
                        style={{
                          fontSize: 7.5,
                          fontFamily: "Roboto",
                          fontWeight: "bold",
                          color: GRAY,
                          marginBottom: 3,
                        }}
                      >
                        Zaznaczone strefy — Twarz:
                      </Text>
                      <View style={styles.chipRow}>
                        {face.map((id, i) => (
                          <Text key={i} style={styles.zoneChip}>
                            {ZONE_NAME_MAP[id] || id}
                          </Text>
                        ))}
                      </View>
                    </View>
                  )}
                  {body.length > 0 && (
                    <View>
                      <Text
                        style={{
                          fontSize: 7.5,
                          fontFamily: "Roboto",
                          fontWeight: "bold",
                          color: GRAY,
                          marginBottom: 3,
                        }}
                      >
                        Zaznaczone strefy — Ciało:
                      </Text>
                      <View style={styles.chipRow}>
                        {body.map((id, i) => (
                          <Text key={i} style={styles.zoneChip}>
                            {ZONE_NAME_MAP[id] || id}
                          </Text>
                        ))}
                      </View>
                    </View>
                  )}
                  {/* Diagramy anatomiczne — tylko dla formularzy z selektorem */}
                  {(showFaceDiagram || showBodyDiagram) && (
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "center",
                        alignItems: "flex-start",
                        gap: 16,
                        marginTop: 8,
                      }}
                    >
                      {showFaceDiagram && <FaceDiagramPDF selectedIds={face} />}
                      {showBodyDiagram && <BodyDiagramPDF selectedIds={body} />}
                    </View>
                  )}
                </View>
              </View>
            );
          })()}

        {/* Przeciwwskazania — na osobnej stronie */}
        <View style={styles.section} break>
          <Text style={styles.sectionTitle}>
            Wywiad Medyczny — Przeciwwskazania
          </Text>
          {kontraEntries.map(([key, val], idx) => {
            const questionText = getContraText(val);
            const answer = form.przeciwwskazania[key];
            const isYes = answer === true;
            const detailsKey = `${key}_details`;
            const details = form.przeciwwskazania[detailsKey] as
              | string
              | undefined;
            const isContraindicationWithFollowUp =
              typeof val === "object" && val.hasFollowUp;

            return (
              <View
                key={key}
                style={[
                  styles.contraindicationRow,
                  idx % 2 === 0 ? styles.contraindicationRowAlt : {},
                ]}
              >
                <Text style={styles.contraindicationText}>{questionText}</Text>
                <Text
                  style={[
                    styles.answerBadge,
                    isYes ? styles.answerYes : styles.answerNo,
                  ]}
                >
                  {isYes ? "TAK" : "NIE"}
                </Text>
                {isYes && isContraindicationWithFollowUp && details && (
                  <Text style={styles.answerDetails}>→ {details}</Text>
                )}
              </View>
            );
          })}
        </View>

        {/* Informacja dodatkowa */}
        {form.informacjaDodatkowa && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Informacje Dodatkowe</Text>
            <Text style={styles.consentText}>{form.informacjaDodatkowa}</Text>
          </View>
        )}

        {/* Stopka */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {rodoInfo.firmaNazwa} • Karta Zgody nr{" "}
            {form.id.substring(0, 8).toUpperCase()}
          </Text>
          <Text
            style={styles.footerGold}
            render={({ pageNumber, totalPages }) =>
              `Strona ${pageNumber}/${totalPages}`
            }
          />
        </View>
      </Page>

      {/* ═══ STRONA 2: Skutki, Zalecenia, RODO ═══ */}
      <Page size="A4" style={styles.page} wrap>
        {/* Nagłówek kontynuacji ze logo */}
        <View style={[styles.header, { paddingBottom: 6 }]}>
          <View style={styles.headerTop}>
            <Image
              src={LOGO_PATH}
              style={[styles.logoImage, { height: 45, width: 135 }]}
            />
            <Text style={[styles.docTitle, { fontSize: 10 }]}>
              {content.title} — Ciąg Dalszy
            </Text>
          </View>
        </View>

        {/* Naturalne reakcje */}
        {content.naturalReactions && content.naturalReactions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Możliwe Reakcje Po Zabiegu (Częste)
            </Text>
            {content.naturalReactions.map((r, i) => (
              <View key={i} style={styles.bulletItem}>
                <View style={styles.goldDot} />
                <Text style={styles.bulletText}>{r}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Powikłania */}
        {hasComplications && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Możliwe Powikłania</Text>
            <View style={styles.twoCol}>
              {content.complications!.czeste &&
                content.complications!.czeste.length > 0 && (
                  <View style={styles.col}>
                    <Text
                      style={{
                        fontSize: 7.5,
                        fontFamily: "Roboto",
                        fontWeight: "bold",
                        color: GRAY,
                        marginBottom: 3,
                      }}
                    >
                      Częste:
                    </Text>
                    {content.complications!.czeste.map((c, i) => (
                      <View key={i} style={styles.bulletItem}>
                        <View style={styles.goldDot} />
                        <Text style={styles.bulletText}>{c}</Text>
                      </View>
                    ))}
                  </View>
                )}
              {(content.complications!.rzadkie?.length ?? 0) +
                (content.complications!.bardzoRzadkie?.length ?? 0) >
                0 && (
                <View style={styles.col}>
                  {content.complications!.rzadkie &&
                    content.complications!.rzadkie.length > 0 && (
                      <>
                        <Text
                          style={{
                            fontSize: 7.5,
                            fontFamily: "Roboto",
                            fontWeight: "bold",
                            color: GRAY,
                            marginBottom: 3,
                          }}
                        >
                          Rzadkie:
                        </Text>
                        {content.complications!.rzadkie.map((c, i) => (
                          <View key={i} style={styles.bulletItem}>
                            <View style={styles.goldDot} />
                            <Text style={styles.bulletText}>{c}</Text>
                          </View>
                        ))}
                      </>
                    )}
                  {content.complications!.bardzoRzadkie &&
                    content.complications!.bardzoRzadkie.length > 0 && (
                      <>
                        <Text
                          style={{
                            fontSize: 7.5,
                            fontFamily: "Roboto",
                            fontWeight: "bold",
                            color: GRAY,
                            marginBottom: 3,
                            marginTop: 4,
                          }}
                        >
                          Bardzo rzadkie:
                        </Text>
                        {content.complications!.bardzoRzadkie.map((c, i) => (
                          <View key={i} style={styles.bulletItem}>
                            <View style={styles.goldDot} />
                            <Text style={styles.bulletText}>{c}</Text>
                          </View>
                        ))}
                      </>
                    )}
                </View>
              )}
            </View>
          </View>
        )}

        {/* Zalecenia pozabiegowe */}
        {content.postCare && content.postCare.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Zalecenia Pozabiegowe</Text>
            {content.postCare.map((p, i) => (
              <View key={i} style={styles.bulletItem}>
                <View style={styles.goldDot} />
                <Text
                  style={[
                    styles.bulletText,
                    p.startsWith("UWAGA")
                      ? { fontFamily: "Roboto", fontWeight: "bold", color: RED }
                      : {},
                  ]}
                >
                  {p}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* RODO Zgoda */}
        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>
            RODO — Zgoda na Przetwarzanie Danych
          </Text>
          <View style={styles.consentBox}>
            <Text style={styles.consentText}>{rodoInfo.consentText}</Text>
          </View>
          {form.podpisRodo && (
            <View
              style={[
                styles.signatureSection,
                { width: "50%", alignSelf: "flex-end", marginTop: 4 },
              ]}
              wrap={false}
            >
              <Text style={styles.signatureLabel}>
                RODO (Przetwarzanie Danych):
              </Text>
              <Image
                src={form.podpisRodo}
                style={[styles.signatureImage, { height: 40, marginBottom: 2 }]}
              />
              <Text style={styles.signatureDate}>{form.miejscowoscData}</Text>
            </View>
          )}
        </View>

        {/* RODO Klauzula */}
        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>Klauzula Informacyjna RODO</Text>
          <View style={styles.consentBox}>
            <Text style={styles.consentText}>{rodoInfo.clauseText}</Text>
          </View>
          {form.podpisRodo2 && (
            <View
              style={[
                styles.signatureSection,
                { width: "50%", alignSelf: "flex-end", marginTop: 4 },
              ]}
              wrap={false}
            >
              <Text style={styles.signatureLabel}>RODO (Klauzula):</Text>
              <Image
                src={form.podpisRodo2}
                style={[styles.signatureImage, { height: 40, marginBottom: 2 }]}
              />
              <Text style={styles.signatureDate}>{form.miejscowoscData}</Text>
            </View>
          )}
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {rodoInfo.firmaNazwa} • Karta Zgody nr{" "}
            {form.id.substring(0, 8).toUpperCase()}
          </Text>
          <Text
            style={styles.footerGold}
            render={({ pageNumber, totalPages }) =>
              `Strona ${pageNumber}/${totalPages}`
            }
          />
        </View>
      </Page>

      {/* ═══ STRONA 3: Dodatkowe Zgody + Podpisy zabiegowe ═══ */}
      <Page size="A4" style={styles.page} wrap>
        <View style={[styles.header, { paddingBottom: 6 }]}>
          <View style={styles.headerTop}>
            <Image
              src={LOGO_PATH}
              style={[styles.logoImage, { height: 45, width: 135 }]}
            />
            <Text style={[styles.docTitle, { fontSize: 10 }]}>
              {content.title} — Zgody i Podpisy
            </Text>
          </View>
        </View>

        {/* Zgody i Oświadczenia */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Udzielone Zgody (Zaznaczone = X)
          </Text>
          <View style={styles.consentRow}>
            <View
              style={
                form.zgodaPrzetwarzanieDanych
                  ? styles.consentCheckFilled
                  : styles.consentCheck
              }
            >
              {form.zgodaPrzetwarzanieDanych && (
                <Text style={styles.checkMark}>X</Text>
              )}
            </View>
            <Text style={styles.consentLabel}>
              Zgoda na przetwarzanie danych osobowych (RODO)
            </Text>
          </View>
          <View style={styles.consentRow}>
            <View
              style={
                form.zgodaMarketing
                  ? styles.consentCheckFilled
                  : styles.consentCheck
              }
            >
              {form.zgodaMarketing && <Text style={styles.checkMark}>X</Text>}
            </View>
            <Text style={styles.consentLabel}>
              Zgoda marketingowa (SMS/Email)
            </Text>
          </View>
          <View style={styles.consentRow}>
            <View
              style={
                form.zgodaFotografie
                  ? styles.consentCheckFilled
                  : styles.consentCheck
              }
            >
              {form.zgodaFotografie && <Text style={styles.checkMark}>X</Text>}
            </View>
            <Text style={styles.consentLabel}>
              Zgoda na wykorzystanie wizerunku
              {form.miejscaPublikacjiFotografii
                ? `: ${form.miejscaPublikacjiFotografii}`
                : ""}
            </Text>
          </View>
          <View style={styles.consentRow}>
            <View
              style={
                form.zgodaPomocPrawna
                  ? styles.consentCheckFilled
                  : styles.consentCheck
              }
            >
              {form.zgodaPomocPrawna && <Text style={styles.checkMark}>X</Text>}
            </View>
            <Text style={styles.consentLabel}>
              Świadoma zgoda na przeprowadzenie zabiegu
            </Text>
          </View>
        </View>

        {/* Oświadczenia (Teksty Zgód) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Treść Oświadczeń i Zgód i Podpisy
          </Text>

          <View style={[styles.consentBox, { marginBottom: 4 }]} wrap={false}>
            <Text
              style={[
                styles.consentText,
                { fontFamily: "Roboto", fontWeight: "bold" },
              ]}
            >
              Świadoma Zgoda na Zabieg
            </Text>
            <Text style={styles.consentText}>
              Składając podpis potwierdzam, że udzieliłam/em pełnych i
              prawdziwych odpowiedzi na pytania zawarte w ankiecie zdrowotnej.
              Zapoznałam/em się z informacjami o zabiegu, ryzykiem powikłań (w
              tym możliwością wystąpienia typowych i rzadkich reakcji
              niepożądanych) oraz zaleceniami pozabiegowymi. Decyzję o poddaniu
              się procedurze podejmuję w pełni świadomie i dobrowolnie.
            </Text>
          </View>
          {form.podpisDane && (
            <View
              style={[
                styles.signatureSection,
                {
                  width: "50%",
                  alignSelf: "flex-end",
                  marginTop: 0,
                  marginBottom: 8,
                },
              ]}
              wrap={false}
            >
              <Text style={styles.signatureLabel}>
                Świadoma Zgoda (Wymagane):
              </Text>
              <Image
                src={form.podpisDane}
                style={[styles.signatureImage, { height: 40, marginBottom: 2 }]}
              />
              <Text style={styles.signatureDate}>{form.miejscowoscData}</Text>
            </View>
          )}

          {form.zgodaMarketing && (
            <View wrap={false}>
              <View style={[styles.consentBox, { marginBottom: 4 }]}>
                <Text
                  style={[
                    styles.consentText,
                    { fontFamily: "Roboto", fontWeight: "bold" },
                  ]}
                >
                  Zgoda Marketingowa
                </Text>
                <Text style={styles.consentText}>
                  Wyrażam zgodę na otrzymywanie informacji o nowościach,
                  promocjach i ofertach specjalnych od firmy{" "}
                  {rodoInfo.firmaNazwa} drogą elektroniczną (SMS / E-mail).
                </Text>
              </View>
              {form.podpisMarketing && (
                <View
                  style={[
                    styles.signatureSection,
                    {
                      width: "50%",
                      alignSelf: "flex-end",
                      marginTop: 0,
                      marginBottom: 8,
                    },
                  ]}
                  wrap={false}
                >
                  <Text style={styles.signatureLabel}>Zgoda Marketingowa:</Text>
                  <Image
                    src={form.podpisMarketing}
                    style={[
                      styles.signatureImage,
                      { height: 40, marginBottom: 2 },
                    ]}
                  />
                  <Text style={styles.signatureDate}>
                    {form.miejscowoscData}
                  </Text>
                </View>
              )}
            </View>
          )}

          {form.zgodaFotografie && (
            <View wrap={false}>
              <View style={[styles.consentBox, { marginBottom: 4 }]}>
                <Text
                  style={[
                    styles.consentText,
                    { fontFamily: "Roboto", fontWeight: "bold" },
                  ]}
                >
                  Zgoda na Wykorzystanie Wizerunku
                </Text>
                <Text style={styles.consentText}>
                  Wyrażam nieodpłatną zgodę na utrwalenie i rozpowszechnianie
                  mojego wizerunku (zdjęcia/video) w celach promocyjnych.
                </Text>
              </View>
              {form.podpisFotografie && (
                <View
                  style={[
                    styles.signatureSection,
                    {
                      width: "50%",
                      alignSelf: "flex-end",
                      marginTop: 0,
                      marginBottom: 8,
                    },
                  ]}
                  wrap={false}
                >
                  <Text style={styles.signatureLabel}>Zgoda na Wizerunek:</Text>
                  <Image
                    src={form.podpisFotografie}
                    style={[
                      styles.signatureImage,
                      { height: 40, marginBottom: 2 },
                    ]}
                  />
                  <Text style={styles.signatureDate}>
                    {form.miejscowoscData}
                  </Text>
                </View>
              )}
            </View>
          )}

          {form.zastrzeniaKlienta && (
            <View style={styles.consentBox} wrap={false}>
              <Text
                style={[
                  styles.consentText,
                  { fontFamily: "Roboto", fontWeight: "bold" },
                ]}
              >
                Zastrzeżenia Klienta
              </Text>
              <Text style={styles.consentText}>{form.zastrzeniaKlienta}</Text>
            </View>
          )}
        </View>

        {/* Podsumowanie prawne */}
        <View
          style={[
            styles.consentBox,
            { marginTop: 0, marginBottom: 0, padding: 6 },
          ]}
        >
          <Text style={[styles.consentText, { fontSize: 6.5, color: GRAY }]}>
            Niniejszy dokument stanowi kartę zgody i wywiad medyczny wypełniony
            elektronicznie przez klienta. Podpisy złożone na tym dokumencie mają
            charakter podpisu elektronicznego zgodnie z Art. 78¹ KC (forma
            dokumentowa). Weryfikacja tożsamości: weryfikacja SMS na numer{" "}
            {form.telefon}.
            {form.signatureStatus === "VERIFIED" && form.signatureVerifiedAt
              ? ` Podpis zweryfikowany: ${formatDate(form.signatureVerifiedAt)}.`
              : ""}{" "}
            Administrator danych: {rodoInfo.firmaNazwa}, NIP: {rodoInfo.nip}.
          </Text>
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {rodoInfo.firmaNazwa} • Karta Zgody nr{" "}
            {form.id.substring(0, 8).toUpperCase()}
          </Text>
          <Text
            style={styles.footerGold}
            render={({ pageNumber, totalPages }) =>
              `Strona ${pageNumber}/${totalPages} • Dokument wygenerowany: ${today}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}

// ─── Główna funkcja eksportowana ───────────────────────────────────────────
export async function generateConsentFormPdf(
  form: ConsentFormData,
): Promise<Buffer> {
  const content = getFormContent(form.type);
  const pdfBuffer = await renderToBuffer(
    <ConsentFormPDF form={form} content={content} />,
  );
  return Buffer.from(pdfBuffer);
}
