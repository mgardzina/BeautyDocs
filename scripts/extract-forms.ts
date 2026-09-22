/**
 * Extract the real per-treatment medical questionnaire (contraindications /
 * wywiad) from the legacy PowderBrows source of truth in `types/booking.ts`
 * and write a language-neutral JSON catalogue that the BeautyDocs provisioner
 * (`apps/api/scripts/provision_powderbrows_forms.py`) merges into each form
 * template version's schema.
 *
 * Run from the repo root:
 *   npx tsx scripts/extract-forms.ts
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  contraindicationsByFormType,
  mezoterapiaIglowaCategoryBreaks,
  makijazPermanentnyCategoryBreaks,
  oczyszczanieTwarzyCategoryBreaks,
} from "../types/booking";

const CODE_BY_TYPE: Record<string, string> = {
  LIP_AUGMENTATION: "modelowanie-ust",
  FACIAL_VOLUMETRY: "wolumetria-twarzy",
  NEEDLE_MESOTHERAPY: "mezoterapia-iglowa",
  INJECTION_LIPOLYSIS: "lipoliza-iniekcyjna",
  PERMANENT_MAKEUP: "makijaz-permanentny",
  LASER_HAIR_REMOVAL: "depilacja-laserowa",
  LASER_TATTOO_REMOVAL: "usuwanie-tatuazu",
  WRINKLE_REDUCTION: "niwelowanie-zmarszczek",
  EYELID_LIFT: "lifting-powiek",
  TISSUE_STIMULATION: "stymulacja-tkankowa",
  EYEBROW_TINTING: "farbowanie-rzes-brwi",
  EYELASH_EXTENSION: "przedluzanie-rzes",
  EYEBROW_LAMINATION: "laminacja-rzes-brwi",
  FACIAL_CLEANSING: "oczyszczanie-twarzy",
};

const BREAKS_BY_TYPE: Record<string, Record<number, string> | undefined> = {
  NEEDLE_MESOTHERAPY: mezoterapiaIglowaCategoryBreaks,
  PERMANENT_MAKEUP: makijazPermanentnyCategoryBreaks,
  FACIAL_CLEANSING: oczyszczanieTwarzyCategoryBreaks,
};

interface ExtractedQuestion {
  key: string;
  question: string;
  hasFollowUp: boolean;
  followUpPlaceholder: string | null;
  category: string | null;
}

const MEDICATION_FOLLOW_UP_KEYS = new Set([
  "antykoagulanty",
  "antykoagulantyLekiRozrzedzajace",
  "lekiKrzepliwosc",
  "lekiMiejscowe",
  "lekiRozrzedzajace",
  "lekiRozrzedzajaceKrew",
]);
const MEDICATION_FOLLOW_UP_PLACEHOLDER =
  "Podaj nazwę leku, dawkę i częstotliwość stosowania";

const out: Record<string, unknown> = {};
let grandTotal = 0;

for (const [formType, rawMap] of Object.entries(contraindicationsByFormType)) {
  const code = CODE_BY_TYPE[formType];
  if (!code) continue;

  const map = rawMap as Record<string, unknown>;
  const breaks = BREAKS_BY_TYPE[formType] ?? {};
  let currentCategory: string | null = null;

  const questions: ExtractedQuestion[] = Object.keys(map).map((key, index) => {
    if (breaks[index]) currentCategory = breaks[index];
    const value = map[key];
    const requiresMedicationDetails = MEDICATION_FOLLOW_UP_KEYS.has(key);
    if (typeof value === "string") {
      return {
        key,
        question: value,
        hasFollowUp: requiresMedicationDetails,
        followUpPlaceholder: requiresMedicationDetails
          ? MEDICATION_FOLLOW_UP_PLACEHOLDER
          : null,
        category: currentCategory,
      };
    }
    const obj = value as { text: string; hasFollowUp?: boolean; followUpPlaceholder?: string };
    return {
      key,
      question: obj.text,
      hasFollowUp: Boolean(obj.hasFollowUp) || requiresMedicationDetails,
      followUpPlaceholder:
        obj.followUpPlaceholder ??
        (requiresMedicationDetails ? MEDICATION_FOLLOW_UP_PLACEHOLDER : null),
      category: currentCategory,
    };
  });

  grandTotal += questions.length;
  out[code] = {
    legacyFormType: formType,
    questionCount: questions.length,
    categories: Object.values(breaks),
    contraindications: questions,
  };
}

const target = resolve(process.cwd(), "apps/api/scripts/form_catalog.json");
writeFileSync(target, `${JSON.stringify(out, null, 2)}\n`, "utf-8");
console.log(
  `Wrote ${target}\n  forms: ${Object.keys(out).length}, total questions: ${grandTotal}`,
);
