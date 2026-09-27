"use client";

import { useT } from "../i18n";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import Link from "next/link";
import { validateBeautyDocsFields } from "../../../lib/beautydocs-field-validation";
import { BeautyDocsValidatedField, useFieldValidation } from "./BeautyDocsValidatedField";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  FileText,
  MessageSquareText,
  Phone,
  RefreshCw,
  ScrollText,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";

import type {
  FormConsent,
  FormContraindicationItem,
  FormContraindicationsSection,
  FormField,
  FormFieldSection,
  FormLegalDocument,
  PublicFormContent,
  PublicPractitioner,
  TenantPublicConfig,
} from "../../../types/tenant";
import type { BeautyDocsConsumerProfile } from "../../../types/beautydocs-consumer";
import { BeautyDocsDocumentModal } from "./BeautyDocsDocumentModal";
import { BeautyDocsFaceAreaSelector } from "./BeautyDocsFaceAreaSelector";
import { BeautyDocsSignaturePad } from "./BeautyDocsSignaturePad";
import {
  resolveBodyAreaSet,
  resolveFaceAreaSet,
  type FaceAreaSet,
} from "./face-area-zones";
import {
  COUNTRY_CODES,
  formatPhoneDigits,
  makeCountryUid,
  type CountryDialCode,
} from "./phone-countries";
import {
  filterTreatmentGoalSuggestions,
  getTreatmentGoalSuggestions,
} from "./treatment-goal-suggestions";

const TEXT_INPUT_TYPES = new Set(["text", "date", "tel", "email"]);
const TREATMENT_AREA_FIELD_KEY = "obszarZabiegu";
const DATA_PROCESSING_CONSENT_KEY = "zgodaPrzetwarzanieDanych";
const TREATMENT_CONSENT_KEY = "zgodaWykonanieZabiegu";
const MAIN_SIGNATURE_KEY = "podpisDane";
const PRACTITIONER_FIELD_KEY = "osobaPrzeprowadzajacaZabieg";
const CONSENT_SIGNATURE_KEYS: Readonly<Record<string, string>> = {
  [TREATMENT_CONSENT_KEY]: MAIN_SIGNATURE_KEY,
  zgodaPrzetwarzanieDanych: "podpisRodo",
  zgodaMarketing: "podpisMarketing",
  zgodaFotografie: "podpisFotografie",
};

type ConsentChoice = boolean | null;

/** Example placeholders shown inside inputs, by field key. */
const FIELD_PLACEHOLDERS: Record<string, string> = {
  // Dane osobowe
  imieNazwisko: "np. Jan Kowalski",
  email: "np. jan.kowalski@example.com",
  ulica: "np. ul. Kwiatowa 12/3",
  kodPocztowy: "np. 00-001",
  miasto: "np. Warszawa",
  // Szczegóły zabiegu
  celEfektu: "np. wypełnienie zmarszczek, powiększenie ust",
  metodaZabiegu: "np. mezoterapia igłowa",
  nazwaProduktu: "np. Juvederm Ultra 3",
  obszarZabiegu: "np. usta, policzki",
  odstepMiedzyZabiegami: "np. 4 tygodnie",
  osobaPrzeprowadzajacaZabieg: "np. Anna Nowak",
  planowanaIloscZabiegow: "np. 3",
};

const CLIENT_FIELD_KEYS = new Set([
  "imieNazwisko",
  "telefon",
  "email",
  "dataUrodzenia",
  "ulica",
  "kodPocztowy",
  "miasto",
]);

interface AnswerState {
  readonly answer: "yes" | "no" | null;
  readonly followUp: string;
}

const EMPTY_ANSWER: AnswerState = { answer: null, followUp: "" };

interface BeautyDocsFormFlowProps {
  readonly appointmentId?: string;
  readonly bookingToken?: string;
  readonly form: PublicFormContent;
  readonly fromConsumer?: boolean;
  readonly fromAdmin?: boolean;
  readonly tenant: TenantPublicConfig;
}

type ClientSigningStage =
  | "editing"
  | "phone-confirmation"
  | "sending-code"
  | "otp"
  | "verifying"
  | "signing"
  | "submitting"
  | "success";

interface ClientVerificationSession {
  readonly submissionId: string;
  readonly submissionToken: string;
  readonly verificationId: string;
  readonly destinationMasked: string;
  readonly expiresInSeconds: number;
  readonly devCode: string | null;
}

interface ConsumerDocumentClaim {
  readonly submissionId: string;
  readonly claimToken: string;
  readonly claimExpiresInSeconds: number;
}

export function BeautyDocsFormFlow({
  appointmentId,
  bookingToken,
  form,
  fromConsumer = false,
  fromAdmin = false,
  tenant,
}: BeautyDocsFormFlowProps) {
  const t = useT();
  const catalogueHref = `/f/${encodeURIComponent(tenant.slug)}${
    fromAdmin ? "?from=admin" : fromConsumer ? "?from=consumer" : ""
  }`;
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [treatmentArea, setTreatmentArea] = useState<string[]>([]);
  const [consentValues, setConsentValues] = useState<
    Record<string, ConsentChoice>
  >(() => collectInitialConsents(form));
  const [signatureValues, setSignatureValues] = useState<Record<string, string>>({});
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [placeAndDate, setPlaceAndDate] = useState("");
  const [status, setStatus] = useState<ClientSigningStage>("editing");
  const [verification, setVerification] =
    useState<ClientVerificationSession | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [verificationModalOpen, setVerificationModalOpen] = useState(false);
  const [resendingCode, setResendingCode] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [consumerProfile, setConsumerProfile] =
    useState<BeautyDocsConsumerProfile | null>(null);
  const [medicalProfileApplied, setMedicalProfileApplied] = useState(false);
  const [medicalProfileConfirmed, setMedicalProfileConfirmed] = useState(false);
  const [documentClaim, setDocumentClaim] =
    useState<ConsumerDocumentClaim | null>(null);
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [signingValidationAttempted, setSigningValidationAttempted] = useState(false);
  const savedSignatureRef = useRef<string | null>(null);
  const [savedSignatureImportingKey, setSavedSignatureImportingKey] =
    useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/beautydocs-preview/consumer/me", {
          credentials: "same-origin",
          cache: "no-store",
        });
        if (!response.ok) return;
        const value = (await response.json()) as {
          readonly profile?: BeautyDocsConsumerProfile;
        };
        if (value.profile) setConsumerProfile(value.profile);
      } catch {
        // A consumer account is optional; the guest flow remains unchanged.
      }
    })();
  }, []);

  useEffect(() => {
    if (status === "signing") {
      window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    }
  }, [status]);

  const faceAreaSet = useMemo<FaceAreaSet | null>(
    () => resolveFaceAreaSet(form.definition.anatomy?.faceZoneSet),
    [form.definition.anatomy],
  );
  const bodyAreaSet = useMemo<FaceAreaSet | null>(
    () => resolveBodyAreaSet(form.definition.anatomy?.bodyZoneSet),
    [form.definition.anatomy],
  );

  const fieldErrors = validateBeautyDocsFields(
    form.definition.sections.flatMap((section) => section.kind === "fields" ? section.fields : []),
    fieldValues, treatmentArea, Boolean(faceAreaSet || bodyAreaSet),
  );
  const visibleFieldErrors = Object.fromEntries(Object.entries(fieldErrors).filter(([key]) => validationAttempted || touchedFields[key]));
  const touchField = (key: string) => setTouchedFields((current) => ({ ...current, [key]: true }));
  const focusInvalidField = () => {
    const key = medicalProfileApplied && !medicalProfileConfirmed ? "medical-profile-confirmation" : Object.keys(fieldErrors)[0];
    if (!key) return;
    requestAnimationFrame(() => {
      const group = document.getElementById(`validation-${key}`);
      const control = group?.querySelector<HTMLElement>('input:not([type="hidden"]):not(:disabled), textarea:not(:disabled), select:not(:disabled)') ?? group;
      control?.focus({ preventScroll: true });
      group?.scrollIntoView({ block: "center", behavior: "auto" });
    });
  };

  const handleFieldChange = (key: string, value: string) => {
    setFieldValues((prev) => ({ ...prev, [key]: value }));
    setErrorMessage(null);
  };

  const handleConsentChange = (key: string, checked: boolean) => {
    setConsentValues((prev) => ({ ...prev, [key]: checked }));
  };

  const handleSignatureChange = (key: string, value: string) => {
    setSignatureValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleUseSavedSignature = async (key: string) => {
    if (!consumerProfile?.signatureConfigured || savedSignatureImportingKey) return;
    setSavedSignatureImportingKey(key);
    setErrorMessage(null);
    try {
      let signature = savedSignatureRef.current;
      if (!signature) {
        const response = await fetch(
          "/api/beautydocs-preview/consumer/profile/signature",
          { cache: "no-store", credentials: "same-origin" },
        );
        if (!response.ok || response.headers.get("content-type") !== "image/png") {
          throw new Error("saved signature unavailable");
        }
        signature = await readBlobAsDataUrl(await response.blob());
        if (!signature.startsWith("data:image/png;base64,")) {
          throw new Error("invalid saved signature");
        }
        savedSignatureRef.current = signature;
      }
      handleSignatureChange(key, signature);
    } catch {
      setErrorMessage(
        t("Nie udało się użyć zapisanego podpisu. Możesz podpisać dokument ręcznie."),
      );
    } finally {
      setSavedSignatureImportingKey(null);
    }
  };

  const handleAnswerChange = (key: string, patch: Partial<AnswerState>) => {
    setAnswers((prev) => ({
      ...prev,
      [key]: { ...(prev[key] ?? EMPTY_ANSWER), ...patch },
    }));
    if (medicalProfileApplied) setMedicalProfileConfirmed(false);
  };

  const applyConsumerProfile = () => {
    if (!consumerProfile) return;
    setFieldValues((previous) => ({
      ...previous,
      imieNazwisko: consumerProfile.fullName,
      telefon: consumerProfile.phone ?? "",
      email: consumerProfile.email ?? "",
      dataUrodzenia: consumerProfile.birthDate ?? "",
      ulica: (() => {
        const base = [consumerProfile.street, consumerProfile.houseNumber]
          .filter(Boolean)
          .join(" ");
        return consumerProfile.apartmentNumber
          ? `${base}/${consumerProfile.apartmentNumber}`
          : base;
      })(),
      kodPocztowy: consumerProfile.postalCode ?? "",
      miasto: consumerProfile.city ?? "",
    }));
    const profileAnswers: Record<string, AnswerState> = {};
    const questionKeys = new Set(
      form.definition.sections.flatMap((section) =>
        section.kind === "contraindications"
          ? section.items.map((item) => item.key)
          : [],
      ),
    );
    for (const [key, raw] of Object.entries(consumerProfile.medicalAnswers)) {
      if (!questionKeys.has(key)) continue;
      const answer = raw.answer;
      if (answer !== "yes" && answer !== "no" && answer !== null) continue;
      profileAnswers[key] = {
        answer,
        followUp: typeof raw.followUp === "string" ? raw.followUp : "",
      };
    }
    setAnswers((previous) => ({ ...previous, ...profileAnswers }));
    setMedicalProfileApplied(Object.keys(profileAnswers).length > 0);
    setMedicalProfileConfirmed(false);
    setErrorMessage(null);
  };

  const validate = (requireSignatures: boolean): string | null => {
    if (medicalProfileApplied && !medicalProfileConfirmed) {
      return t("Przejrzyj zapisany wywiad medyczny i potwierdź aktualność odpowiedzi.");
    }
    const firstFieldError = Object.values(fieldErrors)[0];
    if (firstFieldError) return firstFieldError;
    for (const section of form.definition.sections) {
      if (section.kind !== "fields") continue;
      for (const field of section.fields) {
        if (field.type === "consent") {
          if (!requireSignatures) continue;
          const consent = form.legal.consents.find(
            (candidate) => candidate.key === field.key,
          );
          const choice = consentValues[field.key];
          if (choice !== true && choice !== false) {
            return t("Wybierz „Wyrażam zgodę” albo „Nie wyrażam zgody” dla pozycji „{value1}”.", { value1: consent?.title ?? field.label });
          }
          if ((field.required || consent?.required) && choice !== true) {
            return t("Zgoda „{value1}” jest wymagana.", { value1: consent?.title ?? field.label });
          }
          const consentSignatureKey = CONSENT_SIGNATURE_KEYS[field.key];
          if (consentSignatureKey && !signatureValues[consentSignatureKey]) {
            return t("Podpisz swoją decyzję dla pozycji „{value1}”.", { value1: consent?.title ?? field.label });
          }
          continue;
        }

        if (!field.required) continue;

        if (field.type === "signature") {
          if (requireSignatures && !signatureValues[field.key]) {
            return t("Złóż wszystkie wymagane podpisy.");
          }
          continue;
        }
      }
    }

    if (
      requireSignatures &&
      !consentValues[DATA_PROCESSING_CONSENT_KEY]
    ) {
      return t("Zgoda na przetwarzanie danych osobowych jest wymagana.");
    }

    if (
      requireSignatures &&
      consentValues[TREATMENT_CONSENT_KEY] !== true
    ) {
      return t("Zgoda na wykonanie zabiegu jest wymagana.");
    }

    if (requireSignatures && !signatureValues[MAIN_SIGNATURE_KEY]) {
      return t("Podpis jest wymagany, aby wysłać formularz.");
    }

    return null;
  };

  const buildDraftPayload = () => {
    const answerFields: Record<string, string> = {};
    for (const [key, value] of Object.entries(fieldValues)) {
      if (CLIENT_FIELD_KEYS.has(key) || key === PRACTITIONER_FIELD_KEY) continue;
      answerFields[key] = value;
    }

    return {
      client: {
        fullName: fieldValues.imieNazwisko ?? "",
        phone: fieldValues.telefon ?? null,
        email: fieldValues.email ?? null,
        birthDate: fieldValues.dataUrodzenia ?? null,
        street: fieldValues.ulica ?? null,
        postalCode: fieldValues.kodPocztowy ?? null,
        city: fieldValues.miasto ?? null,
      },
      treatmentArea,
      answers: { ...answerFields, contraindications: answers },
      consents: collectConsentPayload(consentValues),
      placeAndDate: placeAndDate || null,
      practitionerTeamMemberId:
        fieldValues[PRACTITIONER_FIELD_KEY] || null,
      appointmentId: appointmentId ?? null,
      bookingToken: bookingToken ?? null,
      // Recorded in the signed snapshot: the language the client actually read.
      locale: form.contentLocale,
    };
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (status === "editing") {
      setValidationAttempted(true);
      const validationError = validate(false);
      if (validationError) {
        setErrorMessage(validationError);
        focusInvalidField();
        return;
      }
      setErrorMessage(null);
      setStatus("phone-confirmation");
      setVerificationModalOpen(true);
      return;
    }

    if (status !== "signing") return;
    setSigningValidationAttempted(true);
    const validationError = validate(true);
    if (validationError) {
      setErrorMessage(validationError);
      requestAnimationFrame(() => {
        const target = document.querySelector<HTMLElement>('[data-signature-error="true"]');
        target?.focus({ preventScroll: true });
        target?.scrollIntoView({ block: "center", behavior: "auto" });
      });
      return;
    }

    setErrorMessage(null);
    setStatus("submitting");

    try {
      if (verification === null) throw new Error("missing verification");
      const signaturesPayload: Record<string, string> = {};
      for (const [key, value] of Object.entries(signatureValues)) {
        if (value && value.trim().length > 0) signaturesPayload[key] = value;
      }
      const response = await fetch(
        `/api/beautydocs-preview/forms/${encodeURIComponent(tenant.slug)}/${encodeURIComponent(form.code)}` +
          `/submissions/${encodeURIComponent(verification.submissionId)}/signature`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            submissionToken: verification.submissionToken,
            verificationId: verification.verificationId,
            consents: collectConsentPayload(consentValues),
            signatures: signaturesPayload,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`submit-failed-${response.status}`);
      }
      const signed = (await response.json()) as ConsumerDocumentClaim;
      setDocumentClaim(signed);
      setStatus("success");
    } catch {
      setErrorMessage(t("Nie udało się podpisać formularza. Spróbuj ponownie."));
      setStatus("signing");
    }
  };

  const handleSendCode = async () => {
    if (status !== "phone-confirmation") return;
    const validationError = validate(false);
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }
    setErrorMessage(null);
    setStatus("sending-code");
    try {
      const response = await fetch(
        `/api/beautydocs-preview/forms/${encodeURIComponent(tenant.slug)}/${encodeURIComponent(form.code)}/verification`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(buildDraftPayload()),
        },
      );
      if (!response.ok) throw new Error(`verification-failed-${response.status}`);
      const value = (await response.json()) as ClientVerificationSession & {
        readonly clientId: string;
      };
      setVerification({
        submissionId: value.submissionId,
        submissionToken: value.submissionToken,
        verificationId: value.verificationId,
        destinationMasked: value.destinationMasked,
        expiresInSeconds: value.expiresInSeconds,
        devCode: value.devCode,
      });
      setOtpCode("");
      setStatus("otp");
    } catch {
      setErrorMessage(
        t("Nie udało się wysłać kodu SMS. Sprawdź numer telefonu i wykonawcę."),
      );
      setStatus("phone-confirmation");
    }
  };

  const handleResendCode = async () => {
    if (verification === null || resendingCode) return;
    setResendingCode(true);
    setErrorMessage(null);
    try {
      const response = await fetch(
        `/api/beautydocs-preview/forms/${encodeURIComponent(tenant.slug)}/${encodeURIComponent(form.code)}` +
          `/submissions/${encodeURIComponent(verification.submissionId)}/verification`,
        {
          method: "PUT",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ submissionToken: verification.submissionToken }),
        },
      );
      if (!response.ok) throw new Error(`resend-failed-${response.status}`);
      const value = (await response.json()) as ClientVerificationSession;
      setVerification({
        ...verification,
        verificationId: value.verificationId,
        destinationMasked: value.destinationMasked,
        expiresInSeconds: value.expiresInSeconds,
        devCode: value.devCode,
      });
      setOtpCode("");
    } catch {
      setErrorMessage(
        t("Nie można jeszcze wysłać kolejnego kodu. Odczekaj chwilę i spróbuj ponownie."),
      );
    } finally {
      setResendingCode(false);
    }
  };

  const handleCloseVerificationModal = () => {
    if (status === "sending-code" || status === "verifying") return;
    setVerificationModalOpen(false);
    if (status === "phone-confirmation") setStatus("editing");
  };

  const handleEditPhone = () => {
    setVerificationModalOpen(false);
    setVerification(null);
    setOtpCode("");
    setErrorMessage(null);
    setStatus("editing");
    requestAnimationFrame(() => document.getElementById("field-telefon")?.focus());
  };

  const handleVerifyCode = async () => {
    if (verification === null || !/^\d{6}$/.test(otpCode)) {
      setErrorMessage(t("Wpisz pełny, 6-cyfrowy kod SMS."));
      return;
    }
    setStatus("verifying");
    setErrorMessage(null);
    try {
      const response = await fetch(
        `/api/beautydocs-preview/forms/${encodeURIComponent(tenant.slug)}/${encodeURIComponent(form.code)}` +
          `/submissions/${encodeURIComponent(verification.submissionId)}/verification`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            submissionToken: verification.submissionToken,
            verificationId: verification.verificationId,
            code: otpCode,
          }),
        },
      );
      if (!response.ok) throw new Error("invalid code");
      setVerificationModalOpen(false);
      setStatus("signing");
    } catch {
      setErrorMessage(t("Kod jest nieprawidłowy lub wygasł. Sprawdź SMS i spróbuj ponownie."));
      setStatus("otp");
    }
  };

  if (status === "success") {
    return <SuccessPanel catalogueHref={catalogueHref} claim={documentClaim} tenant={tenant} />;
  }

  if (status === "signing" || status === "submitting") {
    return (
      <ClientSignatureStep
        validationAttempted={signingValidationAttempted}
        catalogueHref={catalogueHref}
        destinationMasked={verification?.destinationMasked ?? ""}
        consentValues={consentValues}
        errorMessage={t(errorMessage)}
        form={form}
        onConsentChange={handleConsentChange}
        onSignatureChange={handleSignatureChange}
        onSubmit={handleSubmit}
        onUseSavedSignature={handleUseSavedSignature}
        savedSignatureAvailable={consumerProfile?.signatureConfigured === true}
        savedSignatureImportingKey={savedSignatureImportingKey}
        signatureValues={signatureValues}
        submitting={status === "submitting"}
        tenant={tenant}
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        className="inline-flex rounded-lg text-sm font-semibold text-stone-600 underline decoration-slate-300 underline-offset-4 hover:text-[#173d35] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#245c4d] focus-visible:ring-offset-2"
        href={catalogueHref}
      >
        {t("← Wróć do formularzy")}
      </Link>

      {consumerProfile ? (
        <section className="mt-6 rounded-3xl border border-[#cfd9c2] bg-[#f9fbf6] px-6 py-5 shadow-sm sm:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-black text-[#345f54]">
                {t("Zalogowano jako")}{" "}{consumerProfile.fullName}
              </p>
              <p className="mt-1 max-w-xl text-sm leading-6 text-stone-600">
                {t("Możesz uzupełnić dane z profilu. Nic nie trafi do salonu")}
                {" "}{tenant.displayName}{t(", dopóki nie podpiszesz i nie wyślesz formularza.")}
              </p>
            </div>
            <button
              className="shrink-0 rounded-xl bg-[#245c4d] px-5 py-3 text-sm font-black text-white transition hover:bg-[#173d35]"
              onClick={applyConsumerProfile}
              type="button"
            >
              {t("Użyj moich danych")}
            </button>
          </div>
        </section>
      ) : null}

      {medicalProfileApplied ? (
        <label id="validation-medical-profile-confirmation" className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-950">
          <input
            checked={medicalProfileConfirmed}
            className="mt-1 size-4 accent-[#245c4d]"
            onChange={(event) => setMedicalProfileConfirmed(event.target.checked)}
            type="checkbox"
          />
          <span>
            <strong>{t("Wymagane ponowne potwierdzenie:")}</strong>{" "}{t("przejrzałam wszystkie podpowiedziane odpowiedzi medyczne, poprawiłam zmiany i potwierdzam ich aktualność dla tego zabiegu.")}
          </span>
        </label>
      ) : null}

      <form noValidate onSubmit={handleSubmit}>
        <section className="mt-6 overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
          <div className="border-b border-stone-200 bg-white px-6 py-6 sm:px-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 rounded-full bg-[#245c4d] px-3 py-1.5 text-xs font-bold text-white">
                <FileText aria-hidden="true" className="size-3.5" />
                {t("Formularz online")}
              </span>
              <span className="inline-flex items-center rounded-full bg-[#eef3e7] px-3 py-1 text-xs font-bold text-[#245c4d]">
                {t("Wersja")}{" "}{form.version}
              </span>
            </div>
            <h1 className="mt-5 text-3xl font-bold tracking-tight text-[#173d35] sm:text-4xl">
              {form.displayName}
            </h1>
            <p className="mt-3 text-base leading-7 text-stone-600">
              {t("Dokumentacja zabiegowa dla salonu")}{" "}{tenant.displayName}.
            </p>
          </div>

          <div className="divide-y divide-stone-100">
            {form.definition.sections.map((section) =>
              section.kind === "fields" ? (
                <FieldsSectionBlock
                  bodyAreaSet={bodyAreaSet}
                  faceAreaSet={faceAreaSet}
                  fieldValues={fieldValues}
                  errors={visibleFieldErrors}
                  onTouched={touchField}
                  formCode={form.code}
                  key={section.key}
                  onFieldChange={handleFieldChange}
                  onTreatmentAreaChange={setTreatmentArea}
                  practitioners={form.practitioners}
                  section={section}
                  treatmentArea={treatmentArea}
                />
              ) : (
                <ContraindicationsSectionBlock
                  answers={answers}
                  key={section.key}
                  onAnswerChange={handleAnswerChange}
                  section={section}
                />
              ),
            )}

            <div className="px-6 py-7 sm:px-8 sm:py-8">
              <label
                className="block text-xs font-semibold tracking-[0.02em] text-[#5a6b5a]"
                htmlFor="place-and-date"
              >
                {t("Miejscowość i data")}
              </label>
              <input
                className="mt-2 w-full max-w-sm rounded-xl border border-stone-200 bg-white px-4 py-3 text-[#173d35] outline-none transition placeholder:text-[#aeb3a7] focus:border-[#245c4d] focus:ring-2 focus:ring-[#245c4d]/15 focus-visible:ring-2 focus-visible:ring-[#245c4d]"
                id="place-and-date"
                name="placeAndDate"
                onChange={(event) => setPlaceAndDate(event.target.value)}
                placeholder={t("np. Warszawa, 19.07.2026")}
                type="text"
                value={placeAndDate}
              />
            </div>
          </div>

          <div className="border-t border-stone-200 bg-white px-6 py-7 sm:px-8 sm:py-8">
            {errorMessage ? (
              <p
                className="mb-4 rounded-xl border border-[#d4decc] bg-[#f1f6e9] px-4 py-3 text-sm font-semibold text-[#245c4d]"
                role="alert"
              >
                {t(errorMessage)}
              </p>
            ) : null}
            {status === "otp" ? (
              <button
                className="w-full rounded-xl bg-[#245c4d] px-5 py-3.5 font-bold text-white shadow-[0_12px_30px_rgba(36,92,77,0.25)] transition hover:bg-[#173d35] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#245c4d] focus-visible:ring-offset-2"
                onClick={() => setVerificationModalOpen(true)}
                type="button"
              >
                {t("Wpisz kod SMS")}
              </button>
            ) : (
              <button
                className="w-full rounded-xl bg-[#245c4d] px-5 py-3.5 font-bold text-white shadow-[0_12px_30px_rgba(36,92,77,0.25)] transition hover:bg-[#173d35] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#245c4d] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-[#d4decc] disabled:text-stone-600 disabled:shadow-none"
                disabled={
                  status === "sending-code" || status === "phone-confirmation"
                }
                type="submit"
              >
                {status === "sending-code"
                  ? t("Wysyłanie kodu SMS…")
                  : t("Przejdź do weryfikacji SMS")}
              </button>
            )}
            <p className="mt-3 text-center text-xs leading-5 text-stone-500">
              {t("Najpierw potwierdzisz numer kodem SMS, następnie zaakceptujesz zgody i złożysz podpis.")}
            </p>
          </div>
        </section>
      </form>

      {verificationModalOpen ? (
        <ClientVerificationModal
          code={otpCode}
          destinationMasked={verification?.destinationMasked ?? ""}
          devCode={verification?.devCode ?? null}
          errorMessage={t(errorMessage)}
          expiresInSeconds={verification?.expiresInSeconds ?? 300}
          onChange={setOtpCode}
          onClose={handleCloseVerificationModal}
          onConfirm={handleVerifyCode}
          onEditPhone={handleEditPhone}
          onResend={handleResendCode}
          onSend={handleSendCode}
          phone={fieldValues.telefon ?? ""}
          resending={resendingCode}
          step={
            status === "phone-confirmation" || status === "sending-code"
              ? "phone"
              : "code"
          }
          submitting={status === "sending-code"}
          verifying={status === "verifying"}
        />
      ) : null}
    </div>
  );
}

function ClientSignatureStep({
  validationAttempted,
  catalogueHref,
  form,
  tenant,
  destinationMasked,
  consentValues,
  signatureValues,
  errorMessage,
  submitting,
  onConsentChange,
  onSignatureChange,
  onUseSavedSignature,
  onSubmit,
  savedSignatureAvailable,
  savedSignatureImportingKey,
}: {
  readonly validationAttempted: boolean;
  readonly catalogueHref: string;
  readonly form: PublicFormContent;
  readonly tenant: TenantPublicConfig;
  readonly destinationMasked: string;
  readonly consentValues: Record<string, ConsentChoice>;
  readonly signatureValues: Record<string, string>;
  readonly errorMessage: string | null;
  readonly submitting: boolean;
  readonly onConsentChange: (key: string, checked: boolean) => void;
  readonly onSignatureChange: (key: string, value: string) => void;
  readonly onUseSavedSignature: (key: string) => void;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  readonly savedSignatureAvailable: boolean;
  readonly savedSignatureImportingKey: string | null;
}) {
  const t = useT();
  const consentSignatureKeys = new Set(Object.values(CONSENT_SIGNATURE_KEYS));
  const schemaSignatureFields = form.definition.sections.flatMap((section) =>
    section.kind === "fields"
      ? section.fields.filter(
          (field) =>
            field.type === "signature" && !consentSignatureKeys.has(field.key),
        )
      : [],
  );
  const signatureFields = schemaSignatureFields.filter(
    (field) => field.key !== MAIN_SIGNATURE_KEY,
  );
  const consentFields = form.definition.sections.flatMap((section) =>
    section.kind === "fields"
      ? section.fields.filter((field) => field.type === "consent")
      : [],
  );
  const requiredConsentFields = consentFields.filter((field) => {
    const consent = form.legal.consents.find(
      (candidate) => candidate.key === field.key,
    );
    return field.required || consent?.required === true;
  });
  const optionalConsentFields = consentFields.filter(
    (field) => !requiredConsentFields.some((required) => required.key === field.key),
  );
  const treatmentDocument =
    form.legal.documents.find((candidate) => candidate.key === MAIN_SIGNATURE_KEY) ??
    null;
  const treatmentConsent: FormConsent = {
    key: TREATMENT_CONSENT_KEY,
    title: treatmentDocument?.title ?? t("Zgoda na wykonanie zabiegu"),
    required: true,
    text:
      t("Potwierdzam, że zapoznałam/em się z informacjami o zabiegu i świadomie oraz dobrowolnie wyrażam zgodę na jego wykonanie."),
  };
  const treatmentConsentField: FormField = {
    key: TREATMENT_CONSENT_KEY,
    label: t("Zgoda na wykonanie zabiegu"),
    type: "consent",
    required: true,
  };

  const renderConsentCard = (field: FormField) => {
    const consent = form.legal.consents.find(
      (candidate) => candidate.key === field.key,
    );
    if (!consent) return null;
    const signatureKey = CONSENT_SIGNATURE_KEYS[field.key];
    const signatureDocument = form.legal.documents.find(
      (candidate) => candidate.key === signatureKey,
    );
    return (
      <ConsentCard
        validationAttempted={validationAttempted}
        choice={consentValues[field.key] ?? null}
        consent={consent}
        documentForm={form.legal.documentForm}
        field={field}
        key={field.key}
        onChoiceChange={(choice) => onConsentChange(field.key, choice)}
        onSignatureChange={(value) => {
          if (signatureKey) onSignatureChange(signatureKey, value);
        }}
        onUseSavedSignature={
          savedSignatureAvailable && signatureKey
            ? () => onUseSavedSignature(signatureKey)
            : undefined
        }
        salonName={tenant.displayName}
        savedSignatureLoading={savedSignatureImportingKey === signatureKey}
        signatureDocument={signatureDocument ?? null}
        signatureValue={signatureValues[signatureKey] ?? ""}
      />
    );
  };

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        className="inline-flex rounded-lg text-sm font-semibold text-stone-600 underline decoration-slate-300 underline-offset-4 hover:text-[#173d35] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#245c4d] focus-visible:ring-offset-2"
        href={catalogueHref}
      >
        {t("← Wróć do formularzy")}
      </Link>

      <form noValidate onSubmit={onSubmit}>
        <section className="mt-6 overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
          <header className="border-b border-stone-200 bg-[#f7f8f4] px-6 py-7 sm:px-8 sm:py-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-[#eef3e7] text-[#245c4d]">
                <ShieldCheck aria-hidden="true" className="size-5" />
              </span>
              <span className="rounded-full bg-[#eef3e7] px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-[#245c4d]">
                {t("Krok 2 z 2")}
              </span>
            </div>
            <h1 className="mt-5 text-3xl font-bold tracking-tight text-[#173d35] sm:text-4xl">
              {t("Zgody i podpisy")}
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-stone-600">
              {t("Numer")}{" "}{destinationMasked}{" "}{t("został potwierdzony kodem SMS. Zaakceptuj każdą zgodę lub ją odrzuć. Każdą decyzję potwierdzisz podpisem, również wtedy, gdy nie wyrażasz zgody.")}
            </p>
            <div className="mt-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
              <CheckCircle2 aria-hidden="true" className="size-4.5 shrink-0" />
              {t("Dane i odpowiedzi formularza zostały zabezpieczone i nie mogą już zostać zmienione.")}
            </div>
          </header>

          <div className="space-y-5 px-6 py-7 sm:px-8 sm:py-8">
            <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-bold text-[#173d35]">
                    {t("Wymagane zgody i dokumenty")}
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-stone-600">
                    {t("Przeczytaj dokumenty i złóż wymagane podpisy.")}
                  </p>
                </div>
                <ConsentCard
                  validationAttempted={validationAttempted}
                  choice={consentValues[TREATMENT_CONSENT_KEY] ?? null}
                  consent={treatmentConsent}
                  documentForm={form.legal.documentForm}
                  field={treatmentConsentField}
                  onChoiceChange={(choice) =>
                    onConsentChange(TREATMENT_CONSENT_KEY, choice)
                  }
                  onSignatureChange={(value) =>
                    onSignatureChange(MAIN_SIGNATURE_KEY, value)
                  }
                  onUseSavedSignature={
                    savedSignatureAvailable
                      ? () => onUseSavedSignature(MAIN_SIGNATURE_KEY)
                      : undefined
                  }
                  salonName={tenant.displayName}
                  savedSignatureLoading={
                    savedSignatureImportingKey === MAIN_SIGNATURE_KEY
                  }
                  signatureDocument={treatmentDocument}
                  signatureValue={signatureValues[MAIN_SIGNATURE_KEY] ?? ""}
                />
                {requiredConsentFields.map(renderConsentCard)}
                {signatureFields.map((field) => (
                  <SignatureFieldCard
                    validationAttempted={validationAttempted}
                    document={
                      form.legal.documents.find(
                        (candidate) => candidate.key === field.key,
                      ) ?? null
                    }
                    documentForm={form.legal.documentForm}
                    field={field}
                    key={field.key}
                    onSignatureChange={(value) =>
                      onSignatureChange(field.key, value)
                    }
                    onUseSavedSignature={
                      savedSignatureAvailable
                        ? () => onUseSavedSignature(field.key)
                        : undefined
                    }
                    salonName={tenant.displayName}
                    savedSignatureLoading={
                      savedSignatureImportingKey === field.key
                    }
                    signatureValue={signatureValues[field.key] ?? ""}
                  />
                ))}
            </div>

            {optionalConsentFields.length > 0 ? (
              <div className="space-y-4 pt-3">
                <div>
                  <h2 className="text-lg font-bold text-[#173d35]">
                    {t("Zgody dodatkowe")}
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-stone-600">
                    {t("Możesz wyrazić zgodę albo świadomie jej odmówić.")}
                  </p>
                </div>
                {optionalConsentFields.map(renderConsentCard)}
              </div>
            ) : null}
          </div>

          <footer className="border-t border-stone-200 bg-white px-6 py-7 sm:px-8 sm:py-8">
            {errorMessage ? (
              <p
                className="mb-4 rounded-xl border border-[#d4decc] bg-[#f1f6e9] px-4 py-3 text-sm font-semibold text-[#245c4d]"
                role="alert"
              >
                {t(errorMessage)}
              </p>
            ) : null}
            <button
              className="w-full rounded-xl bg-[#245c4d] px-5 py-3.5 font-bold text-white shadow-[0_12px_30px_rgba(36,92,77,0.25)] transition hover:bg-[#173d35] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#245c4d] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={submitting}
              type="submit"
            >
              {submitting ? t("Zapisywanie podpisów…") : t("Podpisz i wyślij formularz")}
            </button>
          </footer>
        </section>
      </form>
    </div>
  );
}

function ClientVerificationModal({
  step,
  phone,
  code,
  destinationMasked,
  devCode,
  expiresInSeconds,
  errorMessage,
  submitting,
  verifying,
  resending,
  onChange,
  onClose,
  onSend,
  onConfirm,
  onEditPhone,
  onResend,
}: {
  readonly step: "phone" | "code";
  readonly phone: string;
  readonly code: string;
  readonly destinationMasked: string;
  readonly devCode: string | null;
  readonly expiresInSeconds: number;
  readonly errorMessage: string | null;
  readonly submitting: boolean;
  readonly verifying: boolean;
  readonly resending: boolean;
  readonly onChange: (value: string) => void;
  readonly onClose: () => void;
  readonly onSend: () => void;
  readonly onConfirm: () => void;
  readonly onEditPhone: () => void;
  readonly onResend: () => void;
}) {
  const t = useT();
  const digitRefs = useRef<Array<HTMLInputElement | null>>([]);
  const busy = submitting || verifying || resending;
  const digits = Array.from({ length: 6 }, (_, index) => code[index] ?? "");

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleEscape);
    };
  }, [busy, onClose]);

  useEffect(() => {
    if (step === "code") digitRefs.current[0]?.focus();
  }, [step]);

  const handleDigitChange = (index: number, rawValue: string) => {
    const incoming = rawValue.replace(/\D/g, "").slice(0, 6 - index);
    const next = [...digits];
    if (!incoming) {
      next[index] = "";
      onChange(next.join(""));
      return;
    }
    for (let offset = 0; offset < incoming.length; offset += 1) {
      next[index + offset] = incoming[offset] ?? "";
    }
    onChange(next.join(""));
    digitRefs.current[Math.min(index + incoming.length, 5)]?.focus();
  };

  const handleDigitKeyDown = (
    index: number,
    event: ReactKeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      event.preventDefault();
      const next = [...digits];
      next[index - 1] = "";
      onChange(next.join(""));
      digitRefs.current[index - 1]?.focus();
    } else if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      digitRefs.current[index - 1]?.focus();
    } else if (event.key === "ArrowRight" && index < 5) {
      event.preventDefault();
      digitRefs.current[index + 1]?.focus();
    } else if (event.key === "Enter" && code.length === 6 && !verifying) {
      event.preventDefault();
      onConfirm();
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    event.preventDefault();
    onChange(pasted);
    digitRefs.current[Math.min(pasted.length, 6) - 1]?.focus();
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-[#173d35]/55 px-4 py-8 backdrop-blur-[6px]"
      role="presentation"
    >
      <section
        aria-describedby="verification-description"
        aria-labelledby="verification-title"
        aria-modal="true"
        className="w-full max-w-xl overflow-hidden rounded-[28px] border border-white/60 bg-[#f7f8f4] shadow-[0_30px_90px_rgba(23,61,53,0.32)]"
        role="dialog"
      >
        <header className="border-b border-[#e5eadd] bg-white px-6 py-5 sm:px-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-[#d4decc] bg-[#f1f6e9] text-[#245c4d]">
                <ShieldCheck aria-hidden="true" className="size-5" />
              </span>
              <div>
                <h2 className="text-xl font-bold text-[#173d35]" id="verification-title">
                  {t("Weryfikacja tożsamości")}
                </h2>
                <p className="mt-1 text-sm text-stone-500" id="verification-description">
                  {t("Wymagana przed przejściem do podpisów")}
                </p>
              </div>
            </div>
            <button
              aria-label={t("Zamknij weryfikację")}
              className="flex size-9 items-center justify-center rounded-full text-stone-500 transition hover:bg-[#f1f6e9] hover:text-[#245c4d] disabled:opacity-40"
              disabled={busy}
              onClick={onClose}
              type="button"
            >
              <X aria-hidden="true" className="size-5" />
            </button>
          </div>
          <div aria-hidden="true" className="mt-5 flex justify-center gap-2">
            {[0, 1, 2].map((index) => (
              <span
                className={`h-1.5 rounded-full transition-all ${
                  index === (step === "phone" ? 0 : 1)
                    ? "w-8 bg-[#245c4d]"
                    : index < (step === "phone" ? 0 : 1)
                      ? "w-5 bg-[#b3c995]"
                      : "w-2 bg-[#daded4]"
                }`}
                key={index}
              />
            ))}
          </div>
        </header>

        <div className="px-6 py-7 sm:px-8 sm:py-8">
          {step === "phone" ? (
            <div className="text-center">
              <h3 className="text-2xl font-bold text-[#173d35]">{t("Sprawdź numer telefonu")}</h3>
              <p className="mt-2 text-sm leading-6 text-stone-600">
                {t("Wyślemy sześciocyfrowy kod weryfikacyjny na podany numer.")}
              </p>
              <div className="mt-6 flex items-center gap-3 rounded-2xl border border-[#d4decc] bg-white px-4 py-4 text-left shadow-sm">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#f1f6e9] text-[#245c4d]">
                  <Phone aria-hidden="true" className="size-4.5" />
                </span>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.12em] text-stone-500">
                    {t("Numer telefonu")}
                  </p>
                  <p className="mt-1 font-bold text-[#173d35]">{phone}</p>
                </div>
              </div>
              {errorMessage ? <ModalError message={t(errorMessage)} /> : null}
              <button
                className="mt-6 w-full rounded-xl bg-[#245c4d] px-5 py-3.5 font-bold text-white shadow-[0_12px_30px_rgba(36,92,77,0.22)] transition hover:bg-[#173d35] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={submitting}
                onClick={onSend}
                type="button"
              >
                {submitting ? t("Wysyłanie kodu…") : t("Wyślij kod SMS")}
              </button>
              <button
                className="mt-4 text-sm font-semibold text-[#245c4d] underline decoration-[#cdd7c6] underline-offset-4"
                disabled={submitting}
                onClick={onEditPhone}
                type="button"
              >
                {t("Zmień numer telefonu")}
              </button>
            </div>
          ) : (
            <div className="text-center">
              <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[#f1f6e9] text-[#245c4d]">
                <MessageSquareText aria-hidden="true" className="size-5" />
              </span>
              <h3 className="mt-4 text-2xl font-bold text-[#173d35]">{t("Wprowadź kod SMS")}</h3>
              <p className="mt-2 text-sm leading-6 text-stone-600">
                {t("Wpisz sześciocyfrowy kod wysłany na")}{" "}{destinationMasked}.
              </p>

              <div className="mt-7 flex justify-center gap-2 sm:gap-3">
                {digits.map((digit, index) => (
                  <input
                    aria-label={t("Cyfra {value1} kodu SMS", { value1: index + 1 })}
                    autoComplete={index === 0 ? "one-time-code" : "off"}
                    className="h-14 w-11 rounded-xl border-2 border-[#d4decc] bg-white text-center text-2xl font-black text-[#173d35] outline-none transition focus:border-[#245c4d] focus:ring-4 focus:ring-[#245c4d]/10 sm:h-16 sm:w-14"
                    inputMode="numeric"
                    key={index}
                    maxLength={index === 0 ? 6 : 1}
                    onChange={(event) => handleDigitChange(index, event.target.value)}
                    onKeyDown={(event) => handleDigitKeyDown(index, event)}
                    onPaste={handlePaste}
                    ref={(node) => {
                      digitRefs.current[index] = node;
                    }}
                    type="text"
                    value={digit}
                  />
                ))}
              </div>

              <p className="mt-5 text-xs font-semibold text-stone-500">
                {t("Kod jest ważny przez")}{" "}{Math.max(1, Math.ceil(expiresInSeconds / 60))}{" "}{t("minuty.")}
              </p>
              {devCode ? (
                <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  {t("Tryb lokalny — kod testowy:")}{" "}<strong>{devCode}</strong>
                </p>
              ) : null}
              {errorMessage ? <ModalError message={t(errorMessage)} /> : null}

              <button
                className="mt-6 w-full rounded-xl bg-[#245c4d] px-5 py-3.5 font-bold text-white shadow-[0_12px_30px_rgba(36,92,77,0.22)] transition hover:bg-[#173d35] disabled:cursor-not-allowed disabled:opacity-45"
                disabled={verifying || code.length !== 6}
                onClick={onConfirm}
                type="button"
              >
                {verifying ? t("Sprawdzanie kodu…") : t("Potwierdź i przejdź do podpisów")}
              </button>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm">
                <button
                  className="font-semibold text-stone-600 underline decoration-stone-300 underline-offset-4"
                  disabled={busy}
                  onClick={onEditPhone}
                  type="button"
                >
                  {t("Zmień numer")}
                </button>
                <button
                  className="inline-flex items-center gap-1.5 font-bold text-[#245c4d] disabled:opacity-45"
                  disabled={busy}
                  onClick={onResend}
                  type="button"
                >
                  <RefreshCw
                    aria-hidden="true"
                    className={`size-3.5 ${resending ? "animate-spin" : ""}`}
                  />
                  {resending ? t("Wysyłanie…") : t("Wyślij kod ponownie")}
                </button>
              </div>
            </div>
          )}
        </div>

        <footer className="border-t border-[#e5eadd] bg-white px-6 py-4 text-center text-xs font-semibold text-stone-500">
          {t("Weryfikacja SMS chroni dane i wiąże podpis z właścicielem numeru.")}
        </footer>
      </section>
    </div>
  );
}

function ModalError({ message }: { readonly message: string }) {
  const t = useT();
  return (
    <p
      className="mt-4 rounded-xl border border-[#d4decc] bg-[#f1f6e9] px-4 py-3 text-left text-sm font-semibold text-[#245c4d]"
      role="alert"
    >
      {t(message)}
    </p>
  );
}

function collectInitialConsents(
  form: PublicFormContent,
): Record<string, ConsentChoice> {
  const initial: Record<string, ConsentChoice> = {
    [TREATMENT_CONSENT_KEY]: null,
  };
  for (const section of form.definition.sections) {
    if (section.kind !== "fields") continue;
    for (const field of section.fields) {
      if (field.type === "consent") {
        initial[field.key] = null;
      }
    }
  }
  return initial;
}

function collectConsentPayload(
  values: Readonly<Record<string, ConsentChoice>>,
): Record<string, boolean> {
  const payload: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(values)) {
    if (value === true || value === false) payload[key] = value;
  }
  return payload;
}

function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("invalid signature image"));
    });
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(blob);
  });
}

interface FieldsSectionBlockProps {
  readonly section: FormFieldSection;
  readonly fieldValues: Record<string, string>;
  readonly errors: Readonly<Record<string, string>>;
  readonly onTouched: (key: string) => void;
  readonly formCode: string;
  readonly onFieldChange: (key: string, value: string) => void;
  readonly treatmentArea: string[];
  readonly onTreatmentAreaChange: (ids: string[]) => void;
  readonly faceAreaSet: FaceAreaSet | null;
  readonly bodyAreaSet: FaceAreaSet | null;
  readonly practitioners: readonly PublicPractitioner[];
}

function reorderClientFields(fields: readonly FormField[]): FormField[] {
  const emailField = fields.find((field) => field.key === "email");
  if (!emailField) {
    return [...fields];
  }

  return [...fields.filter((field) => field.key !== "email"), emailField];
}

function FieldsSectionBlock({
  section,
  fieldValues,
  errors,
  onTouched,
  formCode,
  onFieldChange,
  treatmentArea,
  onTreatmentAreaChange,
  faceAreaSet,
  bodyAreaSet,
  practitioners,
}: FieldsSectionBlockProps) {
  const t = useT();
  const orderedFields =
    section.key === "dane_osobowe"
      ? reorderClientFields(section.fields)
      : [...section.fields];
  const fields = orderedFields.filter(
    (field) => field.type !== "signature" && field.type !== "consent",
  );
  if (fields.length === 0) return null;

  return (
    <div className="px-6 py-7 sm:px-8 sm:py-8">
      <h2 className="text-lg font-bold text-[#173d35]">{t(section.title)}</h2>
      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        {fields.map((field) => {
          if (
            field.key === TREATMENT_AREA_FIELD_KEY &&
            (faceAreaSet || bodyAreaSet)
          ) {
            const fieldId = `field-${field.key}`;
            const faceIds = faceAreaSet
              ? treatmentArea.filter((id) =>
                  faceAreaSet.zones.some((zone) => zone.id === id),
                )
              : [];
            const bodyIds = bodyAreaSet
              ? treatmentArea.filter((id) =>
                  bodyAreaSet.zones.some((zone) => zone.id === id),
                )
              : [];
            return (
              <BeautyDocsValidatedField className="sm:col-span-2" key={field.key} fieldKey={field.key} label={t(field.label)} error={errors[field.key]} onTouched={onTouched}>
                <span
                  className="block text-xs font-semibold tracking-[0.02em] text-[#5a6b5a]"
                  id={fieldId}
                >
                  {t(field.label)}
                  {field.required ? <span className="text-[#245c4d]"> *</span> : null}
                </span>
                <div
                  aria-labelledby={fieldId}
                  className={`mt-3 grid gap-8 ${faceAreaSet && bodyAreaSet ? "lg:grid-cols-2" : ""}`}
                >
                  {faceAreaSet ? (
                    <BeautyDocsFaceAreaSelector
                      chartImage={faceAreaSet.chartImage}
                      initialSelected={faceIds}
                      onSelect={(ids) => onTreatmentAreaChange([...ids, ...bodyIds])}
                      viewBoxHeight={faceAreaSet.viewBoxHeight}
                      viewBoxWidth={faceAreaSet.viewBoxWidth}
                      zones={faceAreaSet.zones}
                    />
                  ) : null}
                  {bodyAreaSet ? (
                    <BeautyDocsFaceAreaSelector
                      chartImage={bodyAreaSet.chartImage}
                      initialSelected={bodyIds}
                      onSelect={(ids) => onTreatmentAreaChange([...faceIds, ...ids])}
                      viewBoxHeight={bodyAreaSet.viewBoxHeight}
                      viewBoxWidth={bodyAreaSet.viewBoxWidth}
                      zones={bodyAreaSet.zones}
                    />
                  ) : null}
                </div>
              </BeautyDocsValidatedField>
            );
          }

          if (field.key === "dataUrodzenia") {
            return (
              <BeautyDocsValidatedField key={field.key} fieldKey={field.key} label={t(field.label)} error={errors[field.key]} onTouched={onTouched}>
                <BirthDatePicker
                  field={field}
                  onChange={(value) => onFieldChange(field.key, value)}
                  value={fieldValues[field.key] ?? ""}
                />
              </BeautyDocsValidatedField>
            );
          }

          if (field.key === "telefon") {
            return (
              <BeautyDocsValidatedField key={field.key} fieldKey={field.key} label={t(field.label)} error={errors[field.key]} onTouched={onTouched}>
                <PhoneField
                  field={field}
                  onChange={(value) => onFieldChange(field.key, value)}
                  value={fieldValues[field.key] ?? ""}
                />
              </BeautyDocsValidatedField>
            );
          }

          if (field.key === PRACTITIONER_FIELD_KEY) {
            return (
              <BeautyDocsValidatedField className="sm:col-span-2" key={field.key} fieldKey={field.key} label={t(field.label)} error={errors[field.key]} onTouched={onTouched}>
                <PractitionerField
                  field={field}
                  onChange={(value) => onFieldChange(field.key, value)}
                  practitioners={practitioners}
                  value={fieldValues[field.key] ?? ""}
                />
              </BeautyDocsValidatedField>
            );
          }

          if (field.key === "celEfektu") {
            return (
              <BeautyDocsValidatedField className="sm:col-span-2" key={field.key} fieldKey={field.key} label={t(field.label)} error={errors[field.key]} onTouched={onTouched}>
                <GoalAutocompleteField
                  field={field}
                  onChange={(value) => onFieldChange(field.key, value)}
                  suggestions={getTreatmentGoalSuggestions(formCode)}
                  value={fieldValues[field.key] ?? ""}
                />
              </BeautyDocsValidatedField>
            );
          }

          return (
            <BeautyDocsValidatedField key={field.key} fieldKey={field.key} label={t(field.label)} error={errors[field.key]} onTouched={onTouched}>
              <TextField
                field={field}
                onChange={(value) => onFieldChange(field.key, value)}
                value={fieldValues[field.key] ?? ""}
              />
            </BeautyDocsValidatedField>
          );
        })}
      </div>
    </div>
  );
}

function PractitionerField({
  field,
  practitioners,
  value,
  onChange,
}: {
  readonly field: FormField;
  readonly practitioners: readonly PublicPractitioner[];
  readonly value: string;
  readonly onChange: (value: string) => void;
}) {
  const t = useT();
  const inputId = `field-${field.key}`;
  const configuredCount = practitioners.filter(
    (practitioner) => practitioner.smsSigningReady,
  ).length;

  return (
    <fieldset>
      <legend className="block text-xs font-semibold tracking-[0.02em] text-[#5a6b5a]">
        {t(field.label)}
        {field.required ? <span className="text-[#245c4d]"> *</span> : null}
      </legend>
      {configuredCount > 0 ? (
        <div
          aria-label={field.label}
          className="mt-3 flex gap-3 overflow-x-auto pb-2 sm:grid sm:grid-cols-3 sm:overflow-visible lg:grid-cols-4"
          role="radiogroup"
        >
          {practitioners.map((practitioner) => {
            const selected = value === practitioner.id;
            const initials = practitionerInitials(practitioner.displayName);
            return (
              <button
                aria-checked={selected}
                className={`group relative flex min-w-[8.5rem] flex-col items-center rounded-2xl border px-3 py-4 text-center outline-none transition focus-visible:ring-2 focus-visible:ring-[#245c4d] focus-visible:ring-offset-2 sm:min-w-0 ${
                  selected
                    ? "border-[#77b8a8] bg-[#f3f8ec] shadow-sm"
                    : "border-stone-200 bg-white hover:-translate-y-0.5 hover:border-[#cdd7c6] hover:shadow-sm"
                } ${!practitioner.smsSigningReady ? "cursor-not-allowed opacity-45" : ""}`}
                disabled={!practitioner.smsSigningReady}
                id={`${inputId}-${practitioner.id}`}
                key={practitioner.id}
                onClick={() => onChange(practitioner.id)}
                role="radio"
                type="button"
              >
                <span
                  className={`relative grid size-16 place-items-center rounded-full text-base font-black transition ${
                    selected
                      ? "bg-[#245c4d] text-white ring-4 ring-[#e1ead5]"
                      : "bg-[#eef2e8] text-[#245c4d] ring-1 ring-[#d7dfcb] group-hover:bg-[#e2ead8]"
                  }`}
                >
                  {initials}
                  {selected ? (
                    <span className="absolute -bottom-0.5 -right-0.5 grid size-5 place-items-center rounded-full border-2 border-white bg-emerald-600 text-white">
                      <Check aria-hidden="true" className="size-3" />
                    </span>
                  ) : null}
                </span>
                <span className="mt-3 line-clamp-2 text-sm font-black text-[#173d35]">
                  {practitioner.displayName}
                </span>
                <span className="mt-1 line-clamp-1 text-xs text-stone-500">
                  {t(practitioner.jobTitle) ?? t("Osoba wykonująca zabieg")}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
          {t("Do tego zabiegu nie przypisano jeszcze wykonawcy gotowego do podpisu SMS.")}
        </p>
      )}
      <input id={inputId} name={field.key} type="hidden" value={value} />
      <p className="mt-2 text-xs leading-5 text-stone-500">
        {t("Po podpisie klientki formularz trafi do tej osoby. Wykonawca potwierdzi go własnym kodem SMS i złoży podpis.")}
      </p>
    </fieldset>
  );
}

function practitionerInitials(displayName: string): string {
  return displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase("pl-PL") ?? "")
    .join("");
}

function TextField({
  field,
  value,
  onChange,
}: {
  readonly field: FormField;
  readonly value: string;
  readonly onChange: (value: string) => void;
}) {
  const t = useT();
  const validation = useFieldValidation();
  const inputType = TEXT_INPUT_TYPES.has(field.type) ? field.type : "text";
  const inputId = `field-${field.key}`;

  return (
    <>
      <label className="block text-xs font-semibold tracking-[0.02em] text-[#5a6b5a]" htmlFor={inputId}>
        {t(field.label)}
        {field.required ? <span className="text-[#245c4d]"> *</span> : null}
      </label>
      <input
        {...validation}
        className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-[#173d35] outline-none transition placeholder:text-[#aeb3a7] focus:border-[#245c4d] focus:ring-2 focus:ring-[#245c4d]/15 focus-visible:ring-2 focus-visible:ring-[#245c4d]"
        id={inputId}
        name={field.key}
        onChange={(event) => onChange(event.target.value)}
        placeholder={t(FIELD_PLACEHOLDERS[field.key])}
        required={field.required}
        type={inputType}
        value={value}
      />
    </>
  );
}

function GoalAutocompleteField({
  field,
  onChange,
  suggestions,
  value,
}: {
  readonly field: FormField;
  readonly onChange: (value: string) => void;
  readonly suggestions: readonly string[];
  readonly value: string;
}) {
  const t = useT();
  const validation = useFieldValidation();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputId = `field-${field.key}`;
  const listboxId = `${inputId}-suggestions`;
  const filtered = useMemo(
    () => filterTreatmentGoalSuggestions(suggestions, value),
    [suggestions, value],
  );

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [open]);

  const chooseSuggestion = (suggestion: string) => {
    onChange(suggestion);
    setOpen(false);
    setActiveIndex(-1);
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (event.key === "ArrowDown" && filtered.length > 0) {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => (current + 1) % filtered.length);
      return;
    }
    if (event.key === "ArrowUp" && filtered.length > 0) {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) =>
        current <= 0 ? filtered.length - 1 : current - 1,
      );
      return;
    }
    if (event.key === "Enter" && open && activeIndex >= 0) {
      event.preventDefault();
      const selected = filtered[activeIndex];
      if (selected) chooseSuggestion(selected);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <label
        className="block text-xs font-semibold tracking-[0.02em] text-[#5a6b5a]"
        htmlFor={inputId}
      >
        {t(field.label)}
        {field.required ? <span className="text-[#245c4d]"> *</span> : null}
      </label>
      <div className="relative mt-2">
        <input
        {...validation}
          aria-activedescendant={
            open && activeIndex >= 0
              ? `${listboxId}-${activeIndex}`
              : undefined
          }
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={open}
          autoComplete="off"
          className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 pr-10 text-[#173d35] outline-none transition placeholder:text-[#aeb3a7] focus:border-[#245c4d] focus:ring-2 focus:ring-[#245c4d]/15 focus-visible:ring-2 focus-visible:ring-[#245c4d]"
          id={inputId}
          name={field.key}
          onChange={(event) => {
            const nextValue = event.target.value;
            onChange(nextValue);
            setOpen(nextValue.trim().length > 0);
            setActiveIndex(0);
          }}
          onFocus={() => setOpen(value.trim().length > 0)}
          onKeyDown={handleKeyDown}
          placeholder={t(FIELD_PLACEHOLDERS[field.key])}
          required={field.required}
          role="combobox"
          type="text"
          value={value}
        />
        <Sparkles
          aria-hidden="true"
          className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-[#66a394]"
        />
      </div>
      {open ? (
        <div
          className="absolute inset-x-0 top-[calc(100%+0.45rem)] z-30 overflow-hidden rounded-2xl border border-[#dde3d4] bg-white shadow-[0_18px_45px_rgba(42,62,57,0.16)]"
          id={listboxId}
          role="listbox"
        >
          {filtered.length > 0 ? (
            <ul className="max-h-64 overflow-y-auto p-1.5">
              {filtered.map((suggestion, index) => (
                <li key={suggestion}>
                  <button
                    aria-selected={activeIndex === index}
                    className={`flex w-full items-start gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                      activeIndex === index
                        ? "bg-[#f0f5e8] text-[#3b645a]"
                        : "text-[#173d35] hover:bg-[#f8faf5]"
                    }`}
                    id={`${listboxId}-${index}`}
                    onClick={() => chooseSuggestion(suggestion)}
                    onMouseDown={(event) => event.preventDefault()}
                    role="option"
                    type="button"
                  >
                    <Search
                      aria-hidden="true"
                      className="mt-0.5 size-3.5 shrink-0 text-[#66a394]"
                    />
                    <span className="font-semibold">{suggestion}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-3 text-sm text-stone-500">
              {t("Brak gotowej podpowiedzi — możesz wpisać własny cel zabiegu.")}
            </p>
          )}
        </div>
      ) : null}
      {suggestions.length > 0 ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-stone-500">
          <Sparkles aria-hidden="true" className="size-3.5 text-[#66a394]" />
          {t("Zacznij pisać, aby zobaczyć podpowiedzi dla tego zabiegu.")}
        </p>
      ) : null}
    </div>
  );
}

function PhonePrefixDropdown({
  countries,
  makeUid,
  selected,
  selectedUid,
  onSelect,
}: {
  readonly countries: readonly CountryDialCode[];
  readonly makeUid: (c: CountryDialCode) => string;
  readonly selected: CountryDialCode;
  readonly selectedUid: string;
  readonly onSelect: (uid: string) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return countries;
    return countries.filter(
      (c) => c.label.toLowerCase().includes(q) || c.code.includes(q),
    );
  }, [countries, query]);

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={t("Przedrostek numeru telefonu")}
        className="flex h-full items-center gap-1.5 rounded-l-xl border-0 border-r border-stone-200 bg-white px-3 py-2.5 text-xs font-semibold text-[#245c4d] outline-none transition hover:bg-[#f8faf5] focus-visible:ring-0"
        type="button"
        onClick={() => {
          if (!open) setQuery("");
          setOpen((value) => !value);
        }}
      >
        <span className="text-base leading-none">{selected.flag}</span>
        <span>{selected.code}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-[#aab59a] transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div className="absolute left-0 top-[calc(100%+6px)] z-30 w-72 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-[0_16px_40px_-12px_rgba(45,75,67,0.25)]">
          <div className="flex items-center gap-2 border-b border-stone-100 px-3 py-2.5">
            <Search className="h-3.5 w-3.5 shrink-0 text-[#aab59a]" />
            <input
              autoFocus
              className="w-full border-0 bg-transparent text-sm text-[#173d35] outline-none placeholder:text-[#aeb3a7]"
              placeholder={t("Szukaj kraju…")}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <ul className="max-h-60 overflow-y-auto py-1" role="listbox">
            {filtered.length === 0 ? (
              <li className="px-3 py-2.5 text-sm text-[#aeb3a7]">{t("Brak wyników")}</li>
            ) : (
              filtered.map((c) => {
                const uid = makeUid(c);
                const isSelected = uid === selectedUid;
                return (
                  <li key={uid} role="option" aria-selected={isSelected}>
                    <button
                      className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition ${
                        isSelected
                          ? "bg-[#f3f7ed] text-[#245c4d]"
                          : "text-[#343f35] hover:bg-[#f8faf5]"
                      }`}
                      type="button"
                      onClick={() => {
                        onSelect(uid);
                        setOpen(false);
                      }}
                    >
                      <span className="text-base leading-none">{c.flag}</span>
                      <span className="flex-1 truncate">{t(c.label)}</span>
                      <span className="text-xs font-semibold text-[#8ea591]">{c.code}</span>
                      {isSelected ? (
                        <Check className="h-4 w-4 shrink-0 text-[#245c4d]" />
                      ) : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function PhoneField({
  field,
  value,
  onChange,
}: {
  readonly field: FormField;
  readonly value: string;
  readonly onChange: (value: string) => void;
}) {
  const t = useT();
  const validation = useFieldValidation();
  // Unique key per country entry, shared with the marketing contact form.
  const makeUid = makeCountryUid;

  // Parse existing value: try to match longest dial code first to avoid +7 matching +71 etc.
  const parseValue = (v: string): { uid: string; prefix: string; number: string } => {
    if (!v) {
      const def = COUNTRY_CODES[0]!;
      return { uid: makeUid(def), prefix: def.code, number: "" };
    }
    const sorted = [...COUNTRY_CODES].sort((a, b) => b.code.length - a.code.length);
    const match = sorted.find((c) => v.startsWith(c.code + " ") || v === c.code);
    if (match) {
      return { uid: makeUid(match), prefix: match.code, number: v.slice(match.code.length).trimStart() };
    }
    const def = COUNTRY_CODES[0]!;
    return { uid: makeUid(def), prefix: def.code, number: v.replace(/^\+\d+ /, "") };
  };

  const parsed = parseValue(value);
  // The stored value only holds the dial code (e.g. "+1"), which is ambiguous for
  // countries that share one (USA/Kanada). Keep the exact chosen country in local
  // state so the selection sticks instead of snapping to the first match.
  const [selectedUid, setSelectedUid] = useState(parsed.uid);
  const selectedCountry =
    COUNTRY_CODES.find((c) => makeUid(c) === selectedUid) ?? COUNTRY_CODES[0]!;

  const handlePrefixChange = (newUid: string) => {
    setSelectedUid(newUid);
    const country = COUNTRY_CODES.find((c) => makeUid(c) === newUid) ?? COUNTRY_CODES[0]!;
    const digits = parsed.number.replace(/\D/g, "");
    const formatted = formatPhoneDigits(digits, country.groups);
    onChange(country.code + (formatted ? " " + formatted : ""));
  };

  const handleNumberChange = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, selectedCountry.digits ?? 15);
    const formatted = formatPhoneDigits(digits, selectedCountry.groups);
    onChange(selectedCountry.code + (formatted ? " " + formatted : ""));
  };

  const inputId = `field-${field.key}`;
  const displayNumber = parsed.number;

  return (
    <>
      <label
        className="block text-xs font-semibold tracking-[0.02em] text-[#5a6b5a]"
        htmlFor={inputId}
      >
        {t(field.label)}
        {field.required ? <span className="text-[#245c4d]"> *</span> : null}
      </label>
      <div className="mt-2 flex max-w-sm rounded-xl border border-stone-200 bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] transition">
        <PhonePrefixDropdown
          countries={COUNTRY_CODES}
          makeUid={makeUid}
          selected={selectedCountry}
          selectedUid={selectedUid}
          onSelect={handlePrefixChange}
        />
        <input
        {...validation}
          autoComplete="tel"
          className="min-w-0 flex-1 rounded-r-xl border-0 bg-[#f7f8f4] px-3 py-2.5 text-sm text-[#173d35] outline-none transition placeholder:text-[#aeb3a7] focus-visible:ring-0"
          id={inputId}
          inputMode="numeric"
          name={field.key}
          placeholder={selectedCountry.groups.map((n) => "X".repeat(n)).join(" ")}
          required={field.required}
          type="tel"
          value={displayNumber}
          onChange={(e) => handleNumberChange(e.target.value)}
        />
      </div>
    </>
  );
}

interface SelectOption {
  readonly value: string;
  readonly label: string;
}

function AppSelect({
  value,
  options,
  placeholder,
  onChange,
  ariaLabel,
  searchable = false,
  align = "left",
  className,
}: {
  readonly value: string;
  readonly options: readonly SelectOption[];
  readonly placeholder: string;
  readonly onChange: (value: string) => void;
  readonly ariaLabel?: string;
  readonly searchable?: boolean;
  readonly align?: "left" | "center";
  readonly className?: string;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!searchable || !q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query, searchable]);

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={rootRef} className={`relative ${className ?? ""}`}>
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        className={`flex w-full items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-3 text-sm outline-none transition hover:bg-[#f8faf5] focus-visible:ring-0 ${
          selected ? "text-[#173d35]" : "text-[#aeb3a7]"
        } ${align === "center" ? "justify-center text-center" : "justify-between"}`}
        type="button"
        onClick={() => {
          if (!open && searchable) setQuery("");
          setOpen((current) => !current);
        }}
      >
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-[#aab59a] transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div className="absolute left-0 top-[calc(100%+6px)] z-30 w-full min-w-[7rem] overflow-hidden rounded-xl border border-stone-200 bg-white shadow-[0_16px_40px_-12px_rgba(45,75,67,0.25)]">
          {searchable ? (
            <div className="flex items-center gap-2 border-b border-stone-100 px-3 py-2.5">
              <Search className="h-3.5 w-3.5 shrink-0 text-[#aab59a]" />
              <input
                autoFocus
                className="w-full border-0 bg-transparent text-sm text-[#173d35] outline-none placeholder:text-[#aeb3a7]"
                placeholder={t("Szukaj…")}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          ) : null}
          <ul className="max-h-60 overflow-y-auto py-1" role="listbox">
            {filtered.length === 0 ? (
              <li className="px-3 py-2.5 text-sm text-[#aeb3a7]">{t("Brak wyników")}</li>
            ) : (
              filtered.map((o) => {
                const isSelected = o.value === value;
                return (
                  <li key={o.value} role="option" aria-selected={isSelected}>
                    <button
                      className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition ${
                        isSelected
                          ? "bg-[#f3f7ed] text-[#245c4d]"
                          : "text-[#343f35] hover:bg-[#f8faf5]"
                      }`}
                      type="button"
                      onClick={() => {
                        onChange(o.value);
                        setOpen(false);
                      }}
                    >
                      <span className="flex-1 truncate">{t(o.label)}</span>
                      {isSelected ? (
                        <Check className="h-4 w-4 shrink-0 text-[#245c4d]" />
                      ) : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function BirthDatePicker({
  field,
  value,
  onChange,
}: {
  readonly field: FormField;
  readonly value: string;
  readonly onChange: (value: string) => void;
}) {
  const t = useT();
  const [yearStr, monthStr, dayStr] = value && value.includes("-") ? value.split("-") : ["", "", ""];

  const getDaysInMonth = (m: number, y: number): number => {
    if (!m) return 31;
    if (m === 2) {
      if (!y) return 29;
      return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28;
    }
    if ([4, 6, 9, 11].includes(m)) {
      return 30;
    }
    return 31;
  };

  const years = useMemo(() => {
    const list = [];
    for (let y = 2026; y >= 1900; y--) {
      list.push(y);
    }
    return list;
  }, []);

  const months = [
    { value: "01", label: t("Styczeń") },
    { value: "02", label: t("Luty") },
    { value: "03", label: t("Marzec") },
    { value: "04", label: t("Kwiecień") },
    { value: "05", label: t("Maj") },
    { value: "06", label: t("Czerwiec") },
    { value: "07", label: t("Lipiec") },
    { value: "08", label: t("Sierpień") },
    { value: "09", label: t("Wrzesień") },
    { value: "10", label: t("Październik") },
    { value: "11", label: t("Listopad") },
    { value: "12", label: t("Grudzień") },
  ];

  const maxDays = getDaysInMonth(Number(monthStr), Number(yearStr));
  const days = useMemo(() => {
    return Array.from({ length: maxDays }, (_, i) => String(i + 1).padStart(2, "0"));
  }, [maxDays]);

  const updateValue = (y: string, m: string, d: string) => {
    onChange(`${y}-${m}-${d}`);
  };

  const handleYearChange = (newYear: string) => {
    const y = newYear;
    const m = monthStr;
    let d = dayStr;
    if (m && d) {
      const maxD = getDaysInMonth(Number(m), Number(y));
      if (Number(d) > maxD) d = String(maxD).padStart(2, "0");
    }
    updateValue(y, m, d);
  };

  const handleMonthChange = (newMonth: string) => {
    const y = yearStr;
    const m = newMonth;
    let d = dayStr;
    if (m && d) {
      const maxD = getDaysInMonth(Number(m), Number(y));
      if (Number(d) > maxD) d = String(maxD).padStart(2, "0");
    }
    updateValue(y, m, d);
  };

  const handleDayChange = (newDay: string) => {
    updateValue(yearStr, monthStr, newDay);
  };

  const isInvalidAge = useMemo(() => {
    if (!yearStr || !monthStr || !dayStr) return false;
    const y = Number(yearStr);
    const m = Number(monthStr);
    const d = Number(dayStr);
    const today = new Date();
    const birth = new Date(y, m - 1, d);
    let age = today.getFullYear() - birth.getFullYear();
    const mDiff = today.getMonth() - birth.getMonth();
    if (mDiff < 0 || (mDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age < 18;
  }, [yearStr, monthStr, dayStr]);

  return (
    <>
      <label className="block text-xs font-semibold tracking-[0.02em] text-[#5a6b5a]">
        {t(field.label)}
        {field.required ? <span className="text-[#245c4d]"> *</span> : null}
      </label>
      <div className="mt-2 grid grid-cols-12 gap-3">
        <AppSelect
          align="center"
          ariaLabel={t("Dzień urodzenia")}
          className="col-span-3"
          options={days.map((d) => ({ value: d, label: d }))}
          placeholder={t("Dzień")}
          value={dayStr}
          onChange={handleDayChange}
        />
        <AppSelect
          ariaLabel={t("Miesiąc urodzenia")}
          className="col-span-5"
          options={months}
          placeholder={t("Miesiąc")}
          value={monthStr}
          onChange={handleMonthChange}
        />
        <AppSelect
          align="center"
          ariaLabel={t("Rok urodzenia")}
          className="col-span-4"
          options={years.map((y) => ({ value: String(y), label: String(y) }))}
          placeholder={t("Rok")}
          searchable
          value={yearStr}
          onChange={handleYearChange}
        />
      </div>
      {isInvalidAge && (
        <p className="mt-2 text-xs font-semibold text-[#245c4d]" role="alert">
          {t("Musisz mieć ukończone 18 lat.")}
        </p>
      )}
    </>
  );
}

function ConsentCard({
  validationAttempted,
  field,
  consent,
  salonName,
  documentForm,
  choice,
  signatureDocument,
  signatureValue,
  savedSignatureLoading,
  onChoiceChange,
  onSignatureChange,
  onUseSavedSignature,
}: {
  readonly validationAttempted: boolean;
  readonly field: FormField;
  readonly consent: FormConsent;
  readonly salonName: string;
  readonly documentForm: string | null;
  readonly choice: ConsentChoice;
  readonly signatureDocument: FormLegalDocument | null;
  readonly signatureValue: string;
  readonly savedSignatureLoading: boolean;
  readonly onChoiceChange: (choice: boolean) => void;
  readonly onSignatureChange: (value: string) => void;
  readonly onUseSavedSignature?: () => void;
}) {
  const t = useT();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [signaturePreviewOpen, setSignaturePreviewOpen] = useState(false);
  const text = consent.text.split("{{salonName}}").join(salonName);
  const signatureDocumentText = signatureDocument?.text
    .split("{{salonName}}")
    .join(salonName);
  const isRequired = field.required || consent.required;
  const isTreatmentConsent = consent.key === TREATMENT_CONSENT_KEY;
  const previewText =
    isTreatmentConsent && signatureDocumentText ? signatureDocumentText : text;

  const error = !validationAttempted ? null
    : choice === null ? t("Wybierz, czy wyrażasz zgodę.")
    : isRequired && !choice ? t("Ta zgoda jest wymagana do wysłania formularza.")
    : CONSENT_SIGNATURE_KEYS[field.key] && !signatureValue ? t("Podpisz swoją decyzję poniżej.")
    : null;

  return (
    <div
      role="group"
      aria-label={consent.title ?? field.label}
      aria-describedby={error ? `signature-error-${field.key}` : undefined}
      data-signature-error={error ? "true" : undefined}
      tabIndex={-1}
      className={[
        "scroll-mt-32 rounded-2xl border bg-[#f7f8f4] p-5 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#245c4d]",
          choice === true
            ? "border-[#245c4d] shadow-[0_10px_28px_rgba(36,92,77,0.12)]"
          : choice === false
            ? "border-stone-400 shadow-[0_10px_28px_rgba(68,64,60,0.08)]"
          : "border-[#d4decc]",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        {consent.title ? (
          <h3 className="text-sm font-bold text-[#173d35]">
            {t(consent.title)}
            {isRequired ? <span className="text-[#245c4d]"> *</span> : null}
          </h3>
        ) : (
          <span />
        )}
        <button
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#d4decc] bg-white px-3 py-1.5 text-xs font-bold text-[#245c4d] transition hover:border-[#cdd7c6] hover:bg-[#f1f6e9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#245c4d]"
          onClick={() => setPreviewOpen(true)}
          type="button"
        >
          <ScrollText aria-hidden="true" className="size-3.5" />
          {t("Zobacz pełną treść")}
        </button>
      </div>
      <p className="mt-2 text-sm leading-6 text-stone-600">{t(text)}</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2" role="group" aria-label={consent.title ?? field.label}>
        <button
          aria-pressed={choice === true}
          className={[
            "flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#245c4d] focus-visible:ring-offset-2",
            choice === true
              ? "border-[#245c4d] bg-[#245c4d] text-white shadow-[0_8px_20px_rgba(36,92,77,0.18)]"
              : "border-[#d4decc] bg-white text-[#173d35] hover:border-[#cdd7c6] hover:bg-[#f1f6e9]",
          ].join(" ")}
          onClick={() => onChoiceChange(true)}
          type="button"
        >
          <Check aria-hidden="true" className="size-4 stroke-[2.5]" />
          {t("Wyrażam zgodę")}
        </button>
        <button
          aria-pressed={choice === false}
          className={[
            "flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-500 focus-visible:ring-offset-2",
            choice === false
              ? "border-stone-500 bg-stone-700 text-white"
              : "border-[#d4decc] bg-white text-stone-600 hover:border-stone-400 hover:bg-stone-100",
          ].join(" ")}
          onClick={() => onChoiceChange(false)}
          type="button"
        >
          <X aria-hidden="true" className="size-4 stroke-[2.5]" />
          {t("Nie wyrażam zgody")}
        </button>
      </div>

      <div
        className={[
          "grid transition-[grid-template-rows,opacity,margin] duration-300 ease-out",
          choice !== null
            ? "mt-5 grid-rows-[1fr] opacity-100"
            : "mt-0 grid-rows-[0fr] opacity-0",
        ].join(" ")}
      >
        <div className="overflow-hidden">
          {choice !== null ? (
            <div className="rounded-xl border border-[#d4decc] bg-white p-4">
              {signatureDocument && !isTreatmentConsent ? (
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-stone-100 pb-4">
                  <div>
                    <h4 className="text-sm font-bold text-[#173d35]">
                      {t(signatureDocument.title)}
                    </h4>
                    <p className="mt-1 text-xs leading-5 text-stone-500">
                      {t("Podpis potwierdza zapoznanie się z pełną treścią dokumentu.")}
                    </p>
                  </div>
                  <button
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#d4decc] bg-[#f7f8f4] px-3 py-1.5 text-xs font-bold text-[#245c4d] transition hover:bg-[#f1f6e9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#245c4d]"
                    onClick={() => setSignaturePreviewOpen(true)}
                    type="button"
                  >
                    <ScrollText aria-hidden="true" className="size-3.5" />
                    {t("Zobacz dokument")}
                  </button>
                </div>
              ) : null}
              <BeautyDocsSignaturePad
                label={
                  signatureDocument
                    ? t("Podpis decyzji — {title}", { title: signatureDocument.title })
                    : t("Podpis pod decyzją")
                }
                onChange={onSignatureChange}
                onUseSavedSignature={onUseSavedSignature}
                required
                savedSignatureLoading={savedSignatureLoading}
                value={signatureValue}
              />
            </div>
          ) : null}
        </div>
      </div>

      {choice === false ? (
        <p className="mt-3 text-xs font-semibold text-stone-500">
          {isRequired
            ? t("Ta zgoda jest wymagana do wysłania formularza.")
            : t("Odmowa wraz z podpisem zostanie zapisana w dokumentacji formularza.")}
        </p>
      ) : null}

      {error ? <p id={`signature-error-${field.key}`} className="mt-3 text-sm font-medium text-red-800" aria-live="polite">{error}</p> : null}
      <BeautyDocsDocumentModal
        content={previewText}
        legalNote={documentForm}
        onClose={() => setPreviewOpen(false)}
        open={previewOpen}
        salonName={salonName}
        title={consent.title ?? t("Zgoda")}
      />
      {!isTreatmentConsent && signatureDocument && signatureDocumentText ? (
        <BeautyDocsDocumentModal
          content={signatureDocumentText}
          legalNote={documentForm}
          onClose={() => setSignaturePreviewOpen(false)}
          open={signaturePreviewOpen}
          salonName={salonName}
          title={t(signatureDocument.title)}
        />
      ) : null}
    </div>
  );
}

function SignatureFieldCard({
  validationAttempted,
  field,
  document,
  salonName,
  documentForm,
  signatureValue,
  savedSignatureLoading,
  onSignatureChange,
  onUseSavedSignature,
}: {
  readonly validationAttempted: boolean;
  readonly field: FormField;
  readonly document: FormLegalDocument | null;
  readonly salonName: string;
  readonly documentForm: string | null;
  readonly signatureValue: string;
  readonly savedSignatureLoading: boolean;
  readonly onSignatureChange: (value: string) => void;
  readonly onUseSavedSignature?: () => void;
}) {
  const t = useT();
  const [previewOpen, setPreviewOpen] = useState(false);
  const error = validationAttempted && field.required && !signatureValue;
  const text = document ? document.text.split("{{salonName}}").join(salonName) : null;

  return (
    <div role="group" aria-label={field.label}
      aria-describedby={error ? `signature-error-${field.key}` : undefined}
      data-signature-error={error ? "true" : undefined} tabIndex={-1}
      className="scroll-mt-32 rounded-2xl border border-[#d4decc] bg-[#f7f8f4] p-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#245c4d]">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-bold text-[#173d35]">
          {document?.title ?? field.label}
          {field.required ? <span className="text-[#245c4d]"> *</span> : null}
        </h3>
        {document ? (
          <button
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#d4decc] bg-white px-3 py-1.5 text-xs font-bold text-[#245c4d] transition hover:border-[#cdd7c6] hover:bg-[#f1f6e9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#245c4d]"
            onClick={() => setPreviewOpen(true)}
            type="button"
          >
            <ScrollText aria-hidden="true" className="size-3.5" />
            {t("Zobacz pełną treść")}
          </button>
        ) : null}
      </div>
      {document ? (
        <p className="mt-2 text-sm leading-6 text-stone-600">
          {t("Podpisując, potwierdzasz treść dokumentu „")}{t(document.title)}”.
        </p>
      ) : null}

      <div className="mt-4">
        <BeautyDocsSignaturePad
          label={t("Podpis")}
          onChange={onSignatureChange}
          onUseSavedSignature={onUseSavedSignature}
          required={field.required}
          savedSignatureLoading={savedSignatureLoading}
          value={signatureValue}
        />
      </div>

      {error ? <p id={`signature-error-${field.key}`} className="mt-3 text-sm font-medium text-red-800" aria-live="polite">{t("Złóż wymagany podpis.")}</p> : null}
      {document && text ? (
        <BeautyDocsDocumentModal
          content={text}
          legalNote={documentForm}
          onClose={() => setPreviewOpen(false)}
          open={previewOpen}
          salonName={salonName}
          title={t(document.title)}
        />
      ) : null}
    </div>
  );
}

interface CategoryGroup {
  readonly category: string | null;
  readonly items: FormContraindicationItem[];
}

function groupByCategory(items: readonly FormContraindicationItem[]): readonly CategoryGroup[] {
  const groups: CategoryGroup[] = [];

  for (const item of items) {
    const current = groups.at(-1);
    if (current && current.category === item.category) {
      current.items.push(item);
    } else {
      groups.push({ category: item.category, items: [item] });
    }
  }

  return groups;
}

function ContraindicationsSectionBlock({
  section,
  answers,
  onAnswerChange,
}: {
  readonly section: FormContraindicationsSection;
  readonly answers: Record<string, AnswerState>;
  readonly onAnswerChange: (key: string, patch: Partial<AnswerState>) => void;
}) {
  const t = useT();
  if (section.items.length === 0) {
    return null;
  }

  const groups = groupByCategory(section.items);

  return (
    <div className="px-6 py-7 sm:px-8 sm:py-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold text-[#173d35]">{t(section.title)}</h2>
        <span className="text-xs font-semibold text-stone-500">
          {t("Pytań:")}{" "}{section.items.length}
        </span>
      </div>

      <div className="mt-5 space-y-8">
        {groups.map((group, index) => (
          <div key={group.category ?? `bez-kategorii-${index}`}>
            {group.category ? (
              <h3 className="text-xs font-black uppercase tracking-[0.14em] text-[#245c4d]">
                {group.category}
              </h3>
            ) : null}
            <div className="mt-3 divide-y divide-stone-100">
              {group.items.map((item) => (
                <ContraindicationRow
                  item={item}
                  key={item.key}
                  onChange={(patch) => onAnswerChange(item.key, patch)}
                  value={answers[item.key] ?? EMPTY_ANSWER}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function YesNoChoice({
  groupName,
  value,
  onChange,
}: {
  readonly groupName: string;
  readonly value: "yes" | "no" | null;
  readonly onChange: (answer: "yes" | "no") => void;
}) {
  const t = useT();
  const baseBtn =
    "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#245c4d] focus-visible:ring-offset-2";

  return (
    <div aria-label={t("Odpowiedź")} className="flex shrink-0 items-center gap-2" role="radiogroup">
      <button
        aria-checked={value === "yes"}
        className={[
          baseBtn,
          value === "yes"
            ? "border-[#245c4d] bg-[#245c4d] text-white shadow-[0_6px_16px_rgba(36,92,77,0.22)]"
            : "border-[#d4decc] bg-white text-[#245c4d] hover:border-[#cdd7c6] hover:bg-[#f7f8f4]",
        ].join(" ")}
        onClick={() => onChange("yes")}
        role="radio"
        type="button"
      >
        <span
          aria-hidden="true"
          className={[
            "flex size-5 items-center justify-center rounded-full",
            value === "yes" ? "bg-white/20" : "bg-[#f1f6e9]",
          ].join(" ")}
        >
          <Check className="size-3 stroke-[3]" />
        </span>
        {t("Tak")}
      </button>
      <button
        aria-checked={value === "no"}
        className={[
          baseBtn,
          value === "no"
            ? "border-[#173d35] bg-[#173d35] text-white shadow-[0_6px_16px_rgba(23,61,53,0.18)]"
            : "border-[#d4decc] bg-white text-stone-600 hover:border-[#cdd7c6] hover:bg-[#f7f8f4]",
        ].join(" ")}
        onClick={() => onChange("no")}
        role="radio"
        type="button"
      >
        <span
          aria-hidden="true"
          className={[
            "flex size-5 items-center justify-center rounded-full",
            value === "no" ? "bg-white/15" : "bg-stone-100",
          ].join(" ")}
        >
          <X className="size-3 stroke-[3]" />
        </span>
        {t("Nie")}
      </button>
      <input name={groupName} type="hidden" value={value ?? ""} />
    </div>
  );
}

function ContraindicationRow({
  item,
  value,
  onChange,
}: {
  readonly item: FormContraindicationItem;
  readonly value: AnswerState;
  readonly onChange: (patch: Partial<AnswerState>) => void;
}) {
  const t = useT();
  return (
    <div className="py-4 first:pt-0 last:pb-0">
      <fieldset className="m-0 flex flex-col gap-3 border-0 p-0 sm:flex-row sm:items-center sm:justify-between">
        <legend className="w-full p-0 text-sm font-semibold leading-6 text-[#173d35] sm:w-auto sm:max-w-md">
          {t(item.question)}
        </legend>
        <YesNoChoice
          groupName={`q-${item.key}`}
          onChange={(answer) =>
            onChange(answer === "no" ? { answer: "no", followUp: "" } : { answer: "yes" })
          }
          value={value.answer}
        />
      </fieldset>
      {item.hasFollowUp && value.answer === "yes" ? (
        <input
          className="mt-3 w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-[#173d35] outline-none transition placeholder:text-[#aeb3a7] focus:border-[#245c4d] focus:ring-2 focus:ring-[#245c4d]/15 focus-visible:ring-2 focus-visible:ring-[#245c4d]"
          name={`${item.key}-followup`}
          onChange={(event) => onChange({ followUp: event.target.value })}
          placeholder={item.followUpPlaceholder ?? t("Jeżeli tak, opisz…")}
          type="text"
          value={value.followUp}
        />
      ) : null}
    </div>
  );
}

function SuccessPanel({
  catalogueHref,
  claim,
  tenant,
}: {
  readonly catalogueHref: string;
  readonly claim: ConsumerDocumentClaim | null;
  readonly tenant: TenantPublicConfig;
}) {
  const t = useT();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const saveInConsumerAccount = async () => {
    if (!claim) return;
    setSaving(true);
    setSaveError(null);
    try {
      const response = await fetch("/api/beautydocs-preview/consumer/claim", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          submissionId: claim.submissionId,
          claimToken: claim.claimToken,
          saveProfile: true,
        }),
      });
      if (!response.ok) throw new Error(String(response.status));
      setSaved(true);
    } catch {
      setSaveError(
        t("Nie udało się zapisać dokumentu. Link jest ważny przez ograniczony czas — spróbuj ponownie."),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        className="inline-flex rounded-lg text-sm font-semibold text-stone-600 underline decoration-slate-300 underline-offset-4 hover:text-[#173d35] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#245c4d] focus-visible:ring-offset-2"
        href={catalogueHref}
      >
        {t("← Wróć do formularzy")}
      </Link>

      <section className="mt-6 flex flex-col items-center gap-4 overflow-hidden rounded-3xl border border-stone-200 bg-white px-6 py-16 text-center shadow-sm sm:px-8">
        <span className="flex size-14 items-center justify-center rounded-full bg-[#eef3e7]">
          <CheckCircle2 aria-hidden="true" className="size-7 text-[#245c4d]" />
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-[#173d35] sm:text-3xl">
          {t("Dziękujemy — formularz został zapisany i podpisany.")}
        </h1>
        <p className="max-w-md text-sm leading-6 text-stone-600">
          {t("Salon")}{" "}{tenant.displayName}{" "}{t("otrzymał komplet dokumentacji. Możesz teraz zamknąć tę stronę albo zapisać dokument w swoim profilu.")}
        </p>
        {saved ? (
          <div className="mt-2 w-full max-w-lg rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-emerald-950">
            <p className="font-black">{t("Dokument został zapisany.")}</p>
            <p className="mt-1 text-sm">
              {t("Dane i wywiad będą podpowiedzią przy następnym formularzu, ale odpowiedzi medyczne zawsze potwierdzisz ponownie.")}
            </p>
            <Link
              className="mt-4 inline-flex rounded-xl bg-[#245c4d] px-5 py-3 text-sm font-black text-white"
              href="/klient"
            >
              {t("Przejdź do Moje BeautyDocs")}
            </Link>
          </div>
        ) : claim ? (
          <div className="mt-2 w-full max-w-lg rounded-2xl border border-[#d7dfcb] bg-[#f9fbf6] px-5 py-5">
            <h2 className="font-black text-[#345f54]">
              {t("Skróć kolejne wypełnianie formularzy")}
            </h2>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              {t("Zapisz dane, wywiad i ten dokument w bezpłatnym profilu klientki. Konto zostanie powiązane wyłącznie z potwierdzonym numerem telefonu.")}
            </p>
            <button
              className="mt-4 w-full rounded-xl bg-[#245c4d] px-5 py-3 font-black text-white transition hover:bg-[#173d35] disabled:opacity-60"
              disabled={saving}
              onClick={saveInConsumerAccount}
              type="button"
            >
              {saving ? t("Zapisywanie…") : t("Zapisz w Moim BeautyDocs")}
            </button>
            <p className="mt-3 text-xs leading-5 text-stone-500">
              {t("To opcjonalne. Formularze nadal możesz wypełniać bez konta.")}
            </p>
          </div>
        ) : null}
        {saveError ? (
          <p className="max-w-lg rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
            {saveError}
          </p>
        ) : null}
      </section>
    </div>
  );
}
