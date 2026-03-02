import { useState, useEffect } from "react";
import Image from "next/image";
import {
  Phone,
  Check,
  ArrowLeft,
  Instagram,
  Mail,
  Shield,
  Clock,
  Sparkles,
} from "lucide-react";
import {
  getTodayDate,
  formatBirthDate,
  calculateAge,
  validateBirthDate,
} from "@/lib/dateUtils";
import SignaturePad from "@/components/SignaturePad";
import SignatureVerificationModal from "@/components/SignatureVerificationModal";
import { AuditLogData } from "@/app/actions/otp";
import Footer from "@/app/components/Footer";
import BackButton from "../BackButton";
import {
  ConsentFormData,
  ContraindicationWithFollowUp,
  eyebrowLaminationContraindications,
  eyebrowLaminationPostCare,
  rodoInfo,
} from "../../../types/booking";
import { SALON_CONFIG } from "@/app/config/salon";

interface EyebrowLaminationFormProps {
  onBack: () => void;
}

const initialFormData: ConsentFormData = {
  type: "EYEBROW_LAMINATION",
  imieNazwisko: "",
  ulica: "",
  kodPocztowy: "",
  miasto: SALON_CONFIG.city,
  dataUrodzenia: "",
  telefon: "",
  miejscowoscData: `${SALON_CONFIG.city}, ${getTodayDate()}`,
  osobaPrzeprowadzajacaZabieg: "",
  nazwaProduktu: "RefectoCil / Henna",
  obszarZabiegu: "", // Will be filled by checkboxes
  celEfektu: "", // Will be filled by new section
  numerZabiegu: "",
  przeciwwskazania: Object.entries(
    eyebrowLaminationContraindications as unknown as Record<
      string,
      string | ContraindicationWithFollowUp
    >,
  ).reduce((acc, [key, value]) => {
    const hasFollowUp = typeof value === "object" && value.hasFollowUp;
    return {
      ...acc,
      [key]: null,
      ...(hasFollowUp ? { [`${key}_details`]: "" } : {}),
    };
  }, {}),
  zgodaPrzetwarzanieDanych: false,
  zgodaMarketing: false,
  zgodaFotografie: false,
  zgodaPomocPrawna: false,
  miejscaPublikacjiFotografii: "",
  podpisDane: "",
  podpisMarketing: "",
  podpisFotografie: "",
  podpisRodo: "",
  podpisRodo2: "",
  informacjaDodatkowa: "",
  zastrzeniaKlienta: "",
};

export default function EyebrowLaminationForm({
  onBack,
}: EyebrowLaminationFormProps) {
  const [formData, setFormData] = useState<ConsentFormData>(initialFormData);
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [currentContraindicationIndex, setCurrentContraindicationIndex] =
    useState(0);
  const [showContraindicationsWizard, setShowContraindicationsWizard] =
    useState(true);

  // Form Steps: DATA -> RODO -> RODO2 -> TREATMENT -> MARKETING
  const [currentStep, setCurrentStep] = useState<
    "DATA" | "RODO" | "RODO2" | "TREATMENT" | "MARKETING"
  >("DATA");

  // Digital Signature State
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [isSignatureVerified, setIsSignatureVerified] = useState(false);
  const [auditLog, setAuditLog] = useState<AuditLogData | null>(null);

  const contraindicationKeys = Object.keys(eyebrowLaminationContraindications);
  const currentContraindicationKey =
    contraindicationKeys[currentContraindicationIndex];
  const currentContraindicationValue = eyebrowLaminationContraindications[
    currentContraindicationKey
  ] as string | ContraindicationWithFollowUp;
  const currentContraindicationObject:
    | ContraindicationWithFollowUp
    | undefined =
    typeof currentContraindicationValue === "string"
      ? undefined
      : currentContraindicationValue;
  const isWizardComplete =
    currentContraindicationIndex === contraindicationKeys.length;

  // Scroll to top on step change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [currentStep]);

  const handleWizardAnswer = (value: boolean) => {
    handleContraindicationChange(currentContraindicationKey, value);
    // For follow-up questions, don't auto-advance — user must click "Dalej"
    const currentValue = (
      eyebrowLaminationContraindications as Record<
        string,
        string | ContraindicationWithFollowUp
      >
    )[currentContraindicationKey];
    const hasFollowUp =
      typeof currentValue === "object" && currentValue.hasFollowUp;
    // If has follow up, only stop if answer is TRUE (positive)
    if (hasFollowUp && value === true) {
      return;
    }
    if (currentContraindicationIndex < contraindicationKeys.length) {
      setCurrentContraindicationIndex((prev) => prev + 1);
    }
  };

  const handleWizardNext = () => {
    if (currentContraindicationIndex < contraindicationKeys.length) {
      setCurrentContraindicationIndex((prev) => prev + 1);
    }
  };

  const resetWizard = () => {
    setCurrentContraindicationIndex(0);
    setShowContraindicationsWizard(true);
  };

  const handleInputChange = (
    field: keyof ConsentFormData,
    value: string | boolean,
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const formatPhoneNumber = (value: string): string => {
    const digits = value.replace(/\D/g, "").slice(0, 9);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  };

  const handlePhoneChange = (value: string) => {
    const formatted = formatPhoneNumber(value);
    setFormData((prev) => ({ ...prev, telefon: formatted }));
  };

  const isAgeValid = calculateAge(formData.dataUrodzenia) >= 16;
  const birthDateError = validateBirthDate(formData.dataUrodzenia);

  const handleContraindicationChange = (key: string, value: boolean) => {
    setFormData((prev) => ({
      ...prev,
      przeciwwskazania: { ...prev.przeciwwskazania, [key]: value },
    }));
  };

  // Handler dla zweryfikowanego podpisu
  const handleSignatureVerified = (
    _signatureData: string,
    audit: AuditLogData,
  ) => {
    // _signatureData is technically "SMS_VERIFIED_NO_SIGNATURE" now
    setAuditLog(audit);
    setIsSignatureVerified(true);
    setShowSignatureModal(false);

    // Explicitly transition to next step
    setCurrentStep("RODO");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Generuj zawartość dokumentu do hashowania
  const getDocumentContent = () => {
    return JSON.stringify({
      type: formData.type,
      imieNazwisko: formData.imieNazwisko,
      telefon: formData.telefon,
      dataUrodzenia: formData.dataUrodzenia,
      przeciwwskazania: formData.przeciwwskazania,
      timestamp: new Date().toISOString(),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const submissionData = {
      ...formData,
      email: email || null,
      auditLog: auditLog, // Dodaj audit log do danych
      signatureStatus: isSignatureVerified ? "SIGNED" : "PENDING",
    };

    try {
      const response = await fetch("/api/consent-forms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(submissionData),
      });

      const result = await response.json();

      if (result.success) {
        setSubmitSuccess(true);
      } else {
        alert(
          "Wystąpił błąd podczas zapisywania formularza. Spróbuj ponownie.",
        );
      }
    } catch (error) {
      console.error("Błąd:", error);
      alert("Wystąpił błąd podczas zapisywania formularza. Spróbuj ponownie.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-gradient-emerald backdrop-blur-sm rounded-3xl shadow-2xl border border-[#D4AF37] p-12 max-w-lg text-center">
          <div className="w-20 h-20 bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-3xl font-serif text-marble-text mb-4">Dziękujemy!</h2>
          <p className="text-ui-textSecondary mb-8">
            Twój formularz został zapisany.
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => {
                setSubmitSuccess(false);
                setFormData(initialFormData);
                setEmail("");
                setCurrentStep("DATA");
                resetWizard();
                setIsSignatureVerified(false);
                setAuditLog(null);
                window.scrollTo(0, 0);
              }}
              className="bg-brand text-white px-8 py-3 rounded-xl hover:bg-brand-dark transition-colors"
            >
              Wypełnij ponownie
            </button>
            <BackButton
              onClick={onBack}
              label="Wróć do wyboru zabiegu"
              className="w-full justify-center"
            />
          </div>
        </div>
      </div>
    );
  }

  // Basic validation for Step 1
  const isStep1Valid =
    formData.imieNazwisko &&
    formData.telefon &&
    formData.telefon.replace(/\D/g, "").length === 9 &&
    formData.miejscowoscData &&
    formData.dataUrodzenia &&
    isAgeValid &&
    isWizardComplete;

  return (
    <div className="min-h-screen selection:bg-brand/30">
      {/* Header */}
      <header className="bg-ui-bgSecondary/80 backdrop-blur-md sticky top-0 z-50 border-b border-brand shadow-lg">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <h1 className="text-xl md:text-2xl font-serif text-marble-text tracking-wider uppercase">
              {SALON_CONFIG.name}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <a
              href={`tel:${SALON_CONFIG.phone.replace(/\s/g, "")}`}
              className="text-marble-textSecondary hover:text-brand transition-colors"
            >
              <Phone className="w-5 h-5" />
            </a>
            <a
              href={SALON_CONFIG.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="text-marble-textSecondary hover:text-brand transition-colors"
            >
              <Instagram className="w-5 h-5" />
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8 relative z-10">
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <BackButton onClick={onBack} className="self-start" />
            <div className="flex gap-2 text-xs md:text-sm font-medium text-marble-textSecondary overflow-x-auto pb-2 md:pb-0">
              <span
                className={currentStep === "DATA" ? "text-brand font-bold" : "text-marble-textSecondary"}
              >
                1. Dane
              </span>
              <span className="text-marble-textSecondary">→</span>
              <span
                className={currentStep === "RODO" ? "text-brand font-bold" : "text-marble-textSecondary"}
              >
                2. RODO
              </span>
              <span className="text-marble-textSecondary">→</span>
              <span
                className={
                  currentStep === "RODO2" ? "text-brand font-bold" : "text-marble-textSecondary"
                }
              >
                3. RODO 2
              </span>
              <span className="text-marble-textSecondary">→</span>
              <span
                className={
                  currentStep === "TREATMENT" ? "text-brand font-bold" : "text-marble-textSecondary"
                }
              >
                4. Zabieg
              </span>
              <span className="text-marble-textSecondary">→</span>
              <span
                className={
                  currentStep === "MARKETING" ? "text-brand font-bold" : "text-marble-textSecondary"
                }
              >
                5. Zgody
              </span>
            </div>
          </div>

          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-serif text-marble-text mb-3 tracking-tight">
              Laminacja <span className="text-brand">Rzęs i Brwi</span>
            </h1>
            <div className="flex items-center justify-center gap-4">
              <div className="h-px w-12 bg-brand"></div>
              <p className="text-brand text-sm md:text-lg font-light tracking-[0.3em] uppercase drop-shadow-sm">
                Laminacja rzęs i brwi
              </p>
              <div className="h-px w-12 bg-brand"></div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* KROK 1: DANE I WYWIAD */}
          {currentStep === "DATA" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Dane osobowe */}
              <section className="bg-gradient-emerald rounded-2xl border border-[#D4AF37] p-6 md:p-8">
                <h2 className="text-2xl font-serif text-marble-text mb-6 flex items-center gap-3">
                  <span className="w-8 h-8 bg-brand text-black rounded-full flex items-center justify-center text-sm font-sans font-bold">
                    1
                  </span>
                  Dane Osobowe
                </h2>

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm text-ui-textSecondary mb-2 font-medium">
                      Imię i nazwisko *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.imieNazwisko}
                      onChange={(e) =>
                        handleInputChange("imieNazwisko", e.target.value)
                      }
                      className="w-full px-4 py-3 bg-ui-bg border border-[#D4AF37] rounded-xl focus:border-brand focus:ring-2 focus:ring-brand/20 text-marble-text placeholder-marble-textSecondary outline-none transition-all"
                      placeholder="Imię i Nazwisko"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-ui-textSecondary mb-2 font-medium">
                      Miejscowość / Data *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.miejscowoscData}
                      onChange={(e) =>
                        handleInputChange("miejscowoscData", e.target.value)
                      }
                      className="w-full px-4 py-3 bg-ui-bg border border-[#D4AF37] rounded-xl focus:border-brand focus:ring-2 focus:ring-brand/20 text-marble-text placeholder-marble-textSecondary outline-none transition-all"
                      placeholder={`${SALON_CONFIG.city}, 27.01.2026`}
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-ui-textSecondary mb-2 font-medium">
                      Adres E-mail
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-marble-textSecondary" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-ui-bg border border-[#D4AF37] rounded-xl focus:border-brand focus:ring-2 focus:ring-brand/20 text-marble-text placeholder-marble-textSecondary outline-none transition-all"
                        placeholder={SALON_CONFIG.email}
                      />
                    </div>
                  </div>

                  <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm text-ui-textSecondary mb-2 font-medium">
                        Ulica i numer
                      </label>
                      <input
                        type="text"
                        value={formData.ulica}
                        onChange={(e) =>
                          handleInputChange("ulica", e.target.value)
                        }
                        className="w-full px-4 py-3 bg-ui-bg border border-[#D4AF37] rounded-xl focus:border-brand focus:ring-2 focus:ring-brand/20 text-marble-text placeholder-marble-textSecondary outline-none transition-all"
                        placeholder="ul. Przykładowa 1/2"
                        autoComplete="street-address"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-ui-textSecondary mb-2 font-medium">
                        Kod pocztowy
                      </label>
                      <input
                        type="text"
                        value={formData.kodPocztowy}
                        onChange={(e) =>
                          handleInputChange("kodPocztowy", e.target.value)
                        }
                        className="w-full px-4 py-3 bg-ui-bg border border-[#D4AF37] rounded-xl focus:border-brand focus:ring-2 focus:ring-brand/20 text-marble-text placeholder-marble-textSecondary outline-none transition-all"
                        placeholder="38-400"
                        autoComplete="postal-code"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-ui-textSecondary mb-2 font-medium">
                        Miasto
                      </label>
                      <input
                        type="text"
                        value={formData.miasto}
                        onChange={(e) =>
                          handleInputChange("miasto", e.target.value)
                        }
                        className="w-full px-4 py-3 bg-ui-bg border border-[#D4AF37] rounded-xl focus:border-brand focus:ring-2 focus:ring-brand/20 text-marble-text placeholder-marble-textSecondary outline-none transition-all"
                        placeholder={SALON_CONFIG.city}
                        autoComplete="address-level2"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-ui-textSecondary mb-2 font-medium">
                      Data urodzenia * (min. 16 lat)
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      required
                      value={formData.dataUrodzenia}
                      onChange={(e) =>
                        handleInputChange(
                          "dataUrodzenia",
                          formatBirthDate(e.target.value),
                        )
                      }
                      placeholder="dd.mm.rrrr"
                      maxLength={10}
                      className={`w-full px-4 py-3 bg-ui-bg border rounded-xl focus:border-brand focus:ring-2 focus:ring-brand/20 text-marble-text placeholder-marble-textSecondary outline-none transition-all ${
                        birthDateError ? "border-red-500" : "border-[#D4AF37]"
                      }`}
                    />
                    {birthDateError && (
                      <div className="mt-2 flex items-center gap-2 text-red-600 text-sm animate-in fade-in slide-in-from-top-1">
                        <span>{birthDateError}</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm text-ui-textSecondary mb-2 font-medium">
                      Telefon * (do weryfikacji SMS)
                    </label>
                    <div className="flex">
                      <span className="inline-flex items-center px-4 py-3 bg-gradient-emerald border border-r-0 border-[#D4AF37] rounded-l-xl text-[#D4AF37] font-medium select-none">
                        +48
                      </span>
                      <input
                        type="tel"
                        required
                        value={formData.telefon}
                        onChange={(e) => handlePhoneChange(e.target.value)}
                        className="w-full px-4 py-3 bg-ui-bg border border-[#D4AF37] rounded-r-xl focus:border-brand focus:ring-2 focus:ring-brand/20 text-marble-text placeholder-marble-textSecondary outline-none transition-all"
                        placeholder="123 456 789"
                        maxLength={11}
                      />
                    </div>
                  </div>
                </div>
              </section>

              {/* Informacja o Zabiegu */}
              <section className="bg-gradient-emerald rounded-2xl border border-[#D4AF37] p-6 md:p-8">
                <h2 className="text-2xl font-serif text-marble-text mb-6 flex items-center gap-3">
                  <span className="w-8 h-8 bg-brand text-black rounded-full flex items-center justify-center text-sm font-sans font-bold">
                    2
                  </span>
                  Informacja o Zabiegu
                </h2>
                <div className="bg-ui-bg p-6 rounded-xl border border-[#D4AF37] text-ui-textSecondary leading-relaxed space-y-4">
                  <p>
                    Laminacja to zabieg, który nadaje włoskom pożądany kształt,
                    utrwala je w odpowiednim ułożeniu i sprawia, że wyglądają na
                    gęstsze i bardziej zadbane. Zabieg polega na aplikacji
                    specjalnych preparatów chemicznych, które zmiękczają włoski,
                    a następnie utrwalają je w nowym kształcie.
                  </p>
                </div>
              </section>

              {/* Czas utrzymywania efektu */}
              <section className="bg-gradient-emerald rounded-2xl border border-[#D4AF37] p-6 md:p-8">
                <h2 className="text-2xl font-serif text-marble-text mb-6 flex items-center gap-3">
                  <span className="w-8 h-8 bg-brand text-black rounded-full flex items-center justify-center">
                    <Clock className="w-5 h-5" />
                  </span>
                  Jak długo utrzymuje się efekt?
                </h2>
                <div className="bg-ui-bg p-6 rounded-xl border border-[#D4AF37] text-ui-textSecondary leading-relaxed space-y-4">
                  <div className="space-y-4">
                    <p>
                      <strong className="text-marble-text">Brwi:</strong> 4–6 tygodni
                    </p>
                    <p>
                      <strong className="text-marble-text">Rzęsy:</strong> 5–8 tygodni
                    </p>
                    <div className="p-3 bg-brand/10 border border-brand/20 rounded-lg">
                      <p className="text-brand text-sm font-medium text-center">
                        Czas może się skrócić, jeśli nie przestrzegasz zaleceń
                        pielęgnacyjnych.
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Pielęgnacja po 48h */}
              <section className="bg-gradient-emerald rounded-2xl border border-[#D4AF37] p-6 md:p-8">
                <h2 className="text-2xl font-serif text-marble-text mb-6 flex items-center gap-3">
                  <span className="w-8 h-8 bg-brand text-black rounded-full flex items-center justify-center">
                    <Sparkles className="w-5 h-5" />
                  </span>
                  Pielęgnacja po 48h
                </h2>
                <div className="bg-ui-bg p-6 rounded-xl border border-[#D4AF37] text-ui-textSecondary leading-relaxed space-y-4 text-sm">
                  <p className="font-medium text-marble-text mb-2">Co warto robić:</p>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-2">
                      <span className="text-brand">∙</span>
                      <span>
                        <strong className="text-marble-text">Nawilżaj włoski</strong>{" "}
                        – najlepiej odżywką keratynową lub specjalnym serum do
                        brwi/rzęs poleconym przez Stylistkę.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-brand">∙</span>
                      <span>
                        Delikatnie{" "}
                        <strong className="text-marble-text">
                          przeczesuj brwi/rzęsy
                        </strong>{" "}
                        codziennie szczoteczką otrzymaną po zabiegu.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-brand">∙</span>
                      <span>
                        <strong className="text-marble-text">
                          Unikaj silnych kosmetyków
                        </strong>{" "}
                        z alkoholem, kwasami i retinolem w okolicy brwi/rzęs.
                      </span>
                    </li>
                  </ul>
                </div>
              </section>

              {/* Przeciwwskazania Info */}
              <section className="bg-gradient-emerald rounded-2xl border border-[#D4AF37] p-6 md:p-8">
                <h2 className="text-2xl font-serif text-marble-text mb-6 flex items-center gap-3">
                  <span className="w-8 h-8 bg-brand text-black rounded-full flex items-center justify-center text-sm font-sans font-bold">
                    3
                  </span>
                  Przeciwwskazania
                </h2>
                <div className="bg-ui-bg p-6 rounded-xl border border-[#D4AF37] text-ui-textSecondary leading-relaxed space-y-4 text-sm">
                  <p className="font-medium text-marble-text mb-2">
                    Przeciwwskazania do farbowania brwi i rzęs:
                  </p>
                  <ul className="space-y-4">
                    <li>
                      <strong className="text-brand block mb-1">
                        Alergie i nadwrażliwość:
                      </strong>
                      <ul className="list-disc pl-5 space-y-1 text-marble-text/80">
                        <li>
                          Alergia na którykolwiek składnik preparatów (np.
                          tioglikolan, nadtlenek wodoru, keratynę, barwniki)
                        </li>
                        <li>
                          Skóra wrażliwa lub podatna na reakcje alergiczne
                        </li>
                      </ul>
                    </li>
                    <li>
                      <strong className="text-brand block mb-1">
                        Stany zapalne i choroby skóry/oczu:
                      </strong>
                      <ul className="list-disc pl-5 space-y-1 text-marble-text/80">
                        <li>Zapalenie spojówek</li>
                        <li>Jęczmień lub gradówka</li>
                        <li>Opryszczka w fazie aktywnej w okolicy oczu</li>
                        <li>Łuszczyca, egzema, AZS w miejscu zabiegu</li>
                        <li>Infekcje grzybicze lub bakteryjne</li>
                      </ul>
                    </li>
                    <li>
                      <strong className="text-brand block mb-1">
                        Uszkodzenia skóry:
                      </strong>
                      <ul className="list-disc pl-5 space-y-1 text-marble-text/80">
                        <li>Świeże rany, zadrapania, poparzenia</li>
                        <li>
                          Podrażnienia po depilacji lub innych zabiegach
                          kosmetycznych
                        </li>
                      </ul>
                    </li>
                    <li>
                      <strong className="text-brand block mb-1">
                        Stan po zabiegach medycyny estetycznej:
                      </strong>
                      <ul className="list-disc pl-5 space-y-1 text-marble-text/80">
                        <li>
                          Świeżo po botoksie, mezoterapii, mikrobladingu lub
                          innych zabiegach w okolicy brwi/oczu (należy odczekać
                          min. 2–4 tygodnie)
                        </li>
                      </ul>
                    </li>
                    <li>
                      <strong className="text-brand block mb-1">
                        Okres ciąży i karmienia piersią:
                      </strong>
                      <ul className="list-disc pl-5 space-y-1 text-marble-text/80">
                        <li>
                          Nie jest to bezwzględne przeciwwskazanie, ale ze
                          względu na możliwe zmiany hormonalne i większe ryzyko
                          reakcji uczuleniowej – zaleca się ostrożność lub
                          rezygnację
                        </li>
                      </ul>
                    </li>
                    <li>
                      <strong className="text-brand block mb-1">
                        Chemioterapia / choroby autoimmunologiczne:
                      </strong>
                      <ul className="list-disc pl-5 space-y-1 text-marble-text/80">
                        <li>
                          Osłabiona odporność i delikatność skóry/rzęs mogą
                          zwiększyć ryzyko podrażnień
                        </li>
                      </ul>
                    </li>
                    <li>
                      <strong className="text-brand block mb-1">
                        Skłonność do wypadania rzęs/brwi:
                      </strong>
                      <ul className="list-disc pl-5 space-y-1 text-marble-text/80">
                        <li>
                          Jeśli rzęsy lub brwi są bardzo osłabione, łamliwe lub
                          wypadają, lepiej odłożyć zabieg i najpierw je
                          zregenerować
                        </li>
                      </ul>
                    </li>
                  </ul>
                </div>
              </section>

              {/* Szczegóły Zabiegu */}
              <section className="bg-gradient-emerald rounded-2xl border border-[#D4AF37] p-6 md:p-8">
                <h2 className="text-2xl font-serif text-marble-text mb-6 flex items-center gap-3">
                  <span className="w-8 h-8 bg-brand text-black rounded-full flex items-center justify-center text-sm font-sans font-bold">
                    4
                  </span>
                  Szczegóły Zabiegu
                </h2>
                <div className="space-y-6">
                  {/* Miejsce zabiegu */}
                  <div>
                    <label className="block text-sm text-ui-textSecondary mb-3 font-medium">
                      Miejsce zabiegu (można wybrać kilka)
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {["Brwi", "Rzęsy", "Pakiet (Brwi + Rzęsy)"].map(
                        (area) => {
                          const selected = formData.obszarZabiegu
                            ? formData.obszarZabiegu.split(", ")
                            : [];
                          const isSelected = selected.includes(area);
                          return (
                            <button
                              key={area}
                              type="button"
                              onClick={() => {
                                const newValue = isSelected
                                  ? selected
                                      .filter((i) => i !== area)
                                      .join(", ")
                                  : [...selected, area].join(", ");
                                handleInputChange("obszarZabiegu", newValue);
                              }}
                              className={`py-3 px-4 rounded-xl border-2 transition-all font-medium text-sm ${
                                isSelected
                                  ? "border-brand bg-brand text-black shadow-sm"
                                  : "border-[#D4AF37] bg-ui-bg text-ui-textSecondary hover:border-brand hover:text-brand"
                              }`}
                            >
                              {area}
                            </button>
                          );
                        },
                      )}
                    </div>
                  </div>
                </div>
              </section>

              {/* Wywiad Medyczny Hyaluronic */}
              <section className="bg-gradient-emerald rounded-2xl border border-[#D4AF37] p-6 md:p-8">
                <h2 className="text-2xl font-serif text-marble-text mb-6 flex items-center gap-3">
                  <span className="w-8 h-8 bg-brand text-black rounded-full flex items-center justify-center text-sm font-sans font-bold">
                    5
                  </span>
                  Alergie i wrażliwość przed zabiegiem laminacji brwi/rzęs
                </h2>
                <p className="text-sm text-ui-textSecondary mb-6">
                  Czy posiadasz którekolwiek z poniższych przeciwwskazań?
                </p>

                {/* Medications Input */}
                <div className="bg-ui-bg p-5 rounded-xl border border-[#D4AF37] mb-6">
                  <h3 className="font-serif text-marble-text text-lg mb-2">
                    PRZECIWSKAZANIA DO WYKONANIA ZABIEGU
                  </h3>
                  <label className="block text-sm text-ui-textSecondary mb-2 font-medium">
                    Proszę wpisać wykaz wszystkich leków przyjmowanych w ciągu
                    ostatnich 6 miesięcy
                  </label>
                  <textarea
                    rows={3}
                    className="w-full px-4 py-3 bg-gradient-emerald border border-[#D4AF37] rounded-xl focus:border-brand outline-none text-sm text-marble-text placeholder-marble-textSecondary"
                    placeholder="Wpisz leki lub wpisz 'BRAK'..."
                    value={
                      (formData.informacjaDodatkowa || "")
                        .split("\n")
                        .find((p) => p.startsWith("Leki (6 m-cy): "))
                        ?.replace("Leki (6 m-cy): ", "") || ""
                    }
                    onChange={(e) => {
                      const parts = (formData.informacjaDodatkowa || "").split(
                        "\n",
                      );
                      const prefix = "Leki (6 m-cy): ";
                      const newVal = `${prefix}${e.target.value}`;
                      const index = parts.findIndex((p) =>
                        p.startsWith(prefix),
                      );

                      if (index !== -1) {
                        if (e.target.value) {
                          parts[index] = newVal;
                        } else {
                          parts.splice(index, 1);
                        }
                      } else if (e.target.value) {
                        parts.push(newVal);
                      }

                      handleInputChange(
                        "informacjaDodatkowa",
                        parts.filter(Boolean).join("\n"),
                      );
                    }}
                  />
                </div>

                <div className="space-y-3">
                  {showContraindicationsWizard && !isWizardComplete ? (
                    <div
                      key={currentContraindicationIndex}
                      className="bg-ui-bg p-6 rounded-xl border border-[#D4AF37] max-w-2xl mx-auto shadow-sm"
                    >
                      <div className="flex justify-between items-center mb-6">
                        <span className="text-sm font-medium text-brand">
                          Pytanie {currentContraindicationIndex + 1} z{" "}
                          {contraindicationKeys.length}
                        </span>
                        <div className="h-2 w-24 bg-gradient-emerald rounded-full border border-brand/20 overflow-hidden">
                          <div
                            className="h-full bg-brand transition-all duration-300 shadow-[0_0_10px_rgba(212,175,55,0.5)]"
                            style={{
                              width: `${Math.round(((currentContraindicationIndex + 1) / contraindicationKeys.length) * 100)}%`,
                            }}
                          ></div>
                        </div>
                      </div>

                      <h4 className="text-xl md:text-2xl font-serif text-marble-text mb-8 min-h-[5rem] flex items-center justify-center text-center">
                        {typeof currentContraindicationValue === "string"
                          ? currentContraindicationValue
                          : currentContraindicationValue.text}
                      </h4>

                      {/* Show follow-up input if user answered TAK and question has follow-up */}
                      {formData.przeciwwskazania[currentContraindicationKey] ===
                        true &&
                        currentContraindicationObject?.hasFollowUp && (
                          <div className="mb-6 animate-in fade-in slide-in-from-top-2">
                            <input
                              type="text"
                              className="w-full px-4 py-3 text-base bg-ui-bg border-2 border-[#D4AF37] rounded-xl focus:border-brand outline-none transition-colors"
                              placeholder={
                                currentContraindicationObject.followUpPlaceholder
                              }
                              value={String(
                                formData.przeciwwskazania[
                                  `${currentContraindicationKey}_details`
                                ] ?? "",
                              )}
                              onChange={(e) => {
                                setFormData((prev) => ({
                                  ...prev,
                                  przeciwwskazania: {
                                    ...prev.przeciwwskazania,
                                    [`${currentContraindicationKey}_details`]:
                                      e.target.value,
                                  },
                                }));
                              }}
                            />
                          </div>
                        )}

                      {currentContraindicationKey === "alergiaSkladniki" ||
                      currentContraindicationKey === "uczulenieSkladniki" ? (
                        <div className="max-w-md mx-auto space-y-3">
                          {[
                            "PPD (parafenylendiamina)",
                            "Amoniak",
                            "Henna",
                            "Inne",
                            "Nie wiem",
                          ].map((option) => {
                            const currentDetails = String(
                              formData.przeciwwskazania[
                                `${currentContraindicationKey}_details`
                              ] ?? "",
                            );
                            const selectedOptions = currentDetails
                              ? currentDetails.split(", ").filter(Boolean)
                              : [];
                            const isSelected = selectedOptions.includes(option);

                            return (
                              <div key={option}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    let newOptions;
                                    if (isSelected) {
                                      newOptions = selectedOptions.filter(
                                        (o) => o !== option,
                                      );
                                    } else {
                                      if (option === "Nie wiem") {
                                        newOptions = ["Nie wiem"];
                                      } else {
                                        newOptions = [
                                          ...selectedOptions.filter(
                                            (o) => o !== "Nie wiem",
                                          ),
                                          option,
                                        ];
                                      }
                                    }

                                    const newDetails = newOptions.join(", ");

                                    // Logic: If any option is selected, it's a contraindication (TAK/true)
                                    // If no option (empty), it's not a contraindication (NIE/false)
                                    // "Nie wiem" is also treated as a risk/contraindication for safety
                                    const isContraindication =
                                      newOptions.length > 0;

                                    setFormData((prev) => ({
                                      ...prev,
                                      przeciwwskazania: {
                                        ...prev.przeciwwskazania,
                                        [currentContraindicationKey]:
                                          isContraindication, // True if any selected, False if none
                                        [`${currentContraindicationKey}_details`]:
                                          newDetails,
                                      },
                                    }));
                                  }}
                                  className={`w-full py-3 px-4 rounded-xl border-2 transition-all font-medium text-left flex items-center justify-between ${
                                    isSelected
                                      ? "border-red-500 bg-red-500 text-white shadow-md"
                                      : "bg-ui-bg border-[#D4AF37] text-ui-textSecondary hover:border-brand"
                                  }`}
                                >
                                  <span>{option}</span>
                                  {isSelected && <Check className="w-5 h-5" />}
                                </button>

                                {isSelected && option === "Inne" && (
                                  <div className="mt-2 ml-4 animate-in fade-in slide-in-from-top-1">
                                    <input
                                      type="text"
                                      className="w-full px-4 py-2 bg-ui-bg border border-[#D4AF37] rounded-lg focus:border-brand outline-none text-marble-text text-sm"
                                      placeholder="Jakie inne?..."
                                      value={
                                        (formData.przeciwwskazania[
                                          `${currentContraindicationKey}_other_custom`
                                        ] as string) || ""
                                      }
                                      onChange={(e) => {
                                        setFormData((prev) => ({
                                          ...prev,
                                          przeciwwskazania: {
                                            ...prev.przeciwwskazania,
                                            [`${currentContraindicationKey}_other_custom`]:
                                              e.target.value,
                                          },
                                        }));
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          <div className="pt-4">
                            <button
                              type="button"
                              onClick={() => {
                                // Clear all selections -> effectively "NIE"
                                setFormData((prev) => ({
                                  ...prev,
                                  przeciwwskazania: {
                                    ...prev.przeciwwskazania,
                                    [currentContraindicationKey]: false,
                                    [`${currentContraindicationKey}_details`]:
                                      "",
                                    [`${currentContraindicationKey}_other_custom`]:
                                      "",
                                  },
                                }));
                                handleWizardNext();
                              }}
                              className={`w-full py-3 px-4 rounded-xl border-2 transition-all font-medium text-center ${
                                formData.przeciwwskazania[
                                  currentContraindicationKey
                                ] === false
                                  ? "border-green-500 bg-green-500 text-white"
                                  : "bg-ui-bg border-[#D4AF37] text-ui-textSecondary hover:border-green-500 hover:text-green-500"
                              }`}
                            >
                              Żadne z powyższych (NIE)
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-6 max-w-md mx-auto">
                          <button
                            type="button"
                            onClick={() => handleWizardAnswer(false)}
                            className={`py-4 px-6 rounded-xl border-2 transition-all text-lg font-medium shadow-sm hover:shadow-md active:scale-95 flex items-center justify-center ${
                              formData.przeciwwskazania[
                                currentContraindicationKey
                              ] === false
                                ? currentContraindicationObject?.isPositiveAnswerSafe
                                  ? "border-red-500 bg-red-500 text-white" // No is BAD
                                  : "border-green-500 bg-green-500 text-white" // No is GOOD
                                : "bg-ui-bg border-[#D4AF37] text-ui-textSecondary hover:border-brand hover:text-brand hover:bg-brand/10"
                            }`}
                          >
                            NIE
                          </button>
                          <button
                            type="button"
                            onClick={() => handleWizardAnswer(true)}
                            className={`py-4 px-6 rounded-xl border-2 transition-all text-lg font-medium shadow-sm hover:shadow-md active:scale-95 flex items-center justify-center ${
                              formData.przeciwwskazania[
                                currentContraindicationKey
                              ] === true
                                ? currentContraindicationObject?.isPositiveAnswerSafe
                                  ? "border-green-500 bg-green-500 text-white" // Yes is GOOD
                                  : "border-red-500 bg-red-500 text-white" // Yes is BAD
                                : "bg-ui-bg border-[#D4AF37] text-ui-textSecondary hover:border-brand hover:text-brand hover:bg-brand/10"
                            }`}
                          >
                            TAK
                          </button>
                        </div>
                      )}

                      {currentContraindicationObject?.hasFollowUp &&
                        formData.przeciwwskazania[currentContraindicationKey] === (currentContraindicationObject.isPositiveAnswerSafe ? false : true) && (
                          <div className="max-w-md mx-auto mt-4">
                            <button
                              type="button"
                              onClick={handleWizardNext}
                              className="w-full py-4 px-6 rounded-xl bg-brand text-white transition-all text-lg font-medium shadow-sm hover:shadow-md hover:bg-brand-dark active:scale-95 flex items-center justify-center"
                            >
                              Dalej →
                            </button>
                          </div>
                        )}

                      <div className="mt-8 flex justify-between items-center border-t border-[#D4AF37]/50 pt-6">
                        <button
                          type="button"
                          onClick={() =>
                            setCurrentContraindicationIndex((prev) =>
                              Math.max(0, prev - 1),
                            )
                          }
                          disabled={currentContraindicationIndex === 0}
                          className="flex items-center gap-2 text-sm text-marble-textSecondary disabled:opacity-0 hover:text-brand transition-colors"
                        >
                          <ArrowLeft className="w-4 h-4" />
                          Poprzednie
                        </button>
                        <span className="text-xs text-marble-textSecondary uppercase tracking-wider font-medium">
                          Krok {currentContraindicationIndex + 1}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-green-50 border border-green-300 rounded-xl mb-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                            <Check className="w-5 h-5 text-green-600" />
                          </div>
                          <span className="text-green-800 font-medium">
                            Wywiad medyczny zakończony
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={resetWizard}
                          className="text-sm text-green-700 hover:text-green-900 font-medium underline"
                        >
                          Edytuj odpowiedzi
                        </button>
                      </div>

                      {Object.entries(
                        eyebrowLaminationContraindications as unknown as Record<
                          string,
                          string | ContraindicationWithFollowUp
                        >,
                      ).map(([key, value], index) => {
                        const questionText =
                          typeof value === "string" ? value : value.text;
                        const isPositiveSafe =
                          typeof value === "object" &&
                          value.isPositiveAnswerSafe;
                        const isContraindication = isPositiveSafe
                          ? !formData.przeciwwskazania[key] // If safe=true, then FALSE is bad
                          : formData.przeciwwskazania[key]; // If safe=false (default), then TRUE is bad

                        const hasFollowUp =
                          typeof value === "object" && value.hasFollowUp;
                        const followUpDetails = [
                          formData.przeciwwskazania[`${key}_details`],
                          formData.przeciwwskazania[`${key}_other_custom`],
                        ]
                          .filter(Boolean)
                          .join(": ");

                        return (
                          <div
                            key={key}
                            className={`flex items-start gap-4 p-4 rounded-xl transition-colors ${
                              isContraindication
                                ? "bg-red-900/20 border border-red-900/50"
                                : "bg-green-900/10 border border-green-900/30"
                            }`}
                          >
                            <span className="text-brand font-medium min-w-[1.5rem] mt-0.5">
                              {index + 1}.
                            </span>
                            <div className="flex-1">
                              <p className="text-ui-textSecondary text-sm leading-relaxed">
                                {questionText}
                              </p>
                              {hasFollowUp &&
                                formData.przeciwwskazania[key] &&
                                followUpDetails && (
                                  <p className="text-brand text-xs mt-2 italic">
                                    → {followUpDetails}
                                  </p>
                                )}
                            </div>
                            <div className="ml-2">
                              <span
                                className={`inline-flex items-center px-3 py-1 text-xs font-bold rounded-full border whitespace-nowrap ${
                                  isContraindication
                                    ? "bg-red-900/30 text-red-400 border-red-900/50"
                                    : "bg-green-900/30 text-green-400 border-green-900/50"
                                }`}
                              >
                                {formData.przeciwwskazania[key] ? "TAK" : "NIE"}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </section>

              {/* Zalecenia Przedzabiegowe - Pominąć dla henny lub dodać puste */}
              <section className="bg-gradient-emerald rounded-2xl border border-[#D4AF37] p-6 md:p-8 hidden">
                <h2 className="text-2xl font-serif text-marble-text mb-6 flex items-center gap-3">
                  <span className="w-8 h-8 bg-brand text-black rounded-full flex items-center justify-center text-sm font-sans font-bold">
                    5
                  </span>
                  Zalecenia Przedzabiegowe
                </h2>
                {/* ... brak specyficznych zaleceń przed ... */}
              </section>

              {/* Skutki Uboczne i Powikłania */}
              <section className="bg-gradient-emerald rounded-2xl border border-[#D4AF37] p-6 md:p-8">
                <h2 className="text-2xl font-serif text-marble-text mb-6 flex items-center gap-3">
                  <span className="w-8 h-8 bg-brand text-black rounded-full flex items-center justify-center text-sm font-sans font-bold">
                    7
                  </span>
                  Możliwe Reakcje
                </h2>

                <div className="bg-ui-bg p-5 rounded-xl border border-[#D4AF37]">
                  <p className="text-sm font-medium text-marble-text mb-3">
                    Możliwe, choć rzadkie reakcje skórne:
                  </p>
                  <ul className="space-y-2 text-sm text-ui-textSecondary">
                    <li className="flex items-start gap-2">
                      <span className="text-brand">∙</span> zaczerwienienie
                      skóry
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-brand">∙</span> lekkie pieczenie lub
                      swędzenie
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-brand">∙</span> reakcja alergiczna
                      (opuchlizna)
                    </li>
                  </ul>
                </div>
              </section>

              {/* Zalecenia Pozabiegowe */}
              <section className="bg-gradient-emerald rounded-2xl border border-[#D4AF37] p-6 md:p-8">
                <h2 className="text-2xl font-serif text-marble-text mb-6 flex items-center gap-3">
                  <span className="w-8 h-8 bg-brand text-black rounded-full flex items-center justify-center text-sm font-sans font-bold">
                    8
                  </span>
                  Zalecenia Pozabiegowe
                </h2>

                <div className="bg-ui-bg p-5 rounded-xl border border-[#D4AF37] mb-6">
                  <p className="text-sm text-ui-textSecondary leading-relaxed mb-4">
                    <strong>
                      Niniejszym oświadczam, że zostałam/em poinformowana/y o
                      konieczności stosowania się po przeprowadzonym zabiegu do
                      przestrzegania następujących zaleceń:
                    </strong>
                  </p>
                  <ul className="space-y-2 mt-4">
                    {eyebrowLaminationPostCare.map((item, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <span className="text-brand">∙</span>
                        <span
                          className={
                            item.startsWith("UWAGA")
                              ? "font-bold text-brand"
                              : ""
                          }
                        >
                          {item}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>

              <div className="flex justify-end pt-4 pb-12">
                <button
                  type="button"
                  onClick={() => setShowSignatureModal(true)}
                  disabled={!isStep1Valid}
                  className="bg-brand text-white py-4 px-8 rounded-xl text-lg font-medium shadow-lg hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-3"
                >
                  <Shield className="w-5 h-5" />
                  Weryfikuj Tożsamość (SMS) i Przejdź Dalej
                </button>
              </div>
            </div>
          )}

          {/* KROK 2: RODO */}
          {currentStep === "RODO" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <section className="bg-gradient-emerald rounded-2xl border border-[#D4AF37] overflow-hidden">
                <div className="p-6 md:p-8">
                  <h3 className="text-2xl font-serif text-marble-text mb-6">
                    {rodoInfo.consentTitle}
                  </h3>
                  <div className="bg-ui-bg p-6 rounded-xl text-sm text-ui-textSecondary leading-relaxed whitespace-pre-line max-h-[60vh] overflow-y-auto mb-6 border border-[#D4AF37]">
                    {rodoInfo.consentText}
                  </div>
                  {/* Signature Area for RODO */}
                  <div className="mt-8">
                    <SignaturePad
                      label="Podpis Klienta (Zgoda na przetwarzanie danych)"
                      value={formData.podpisRodo || ""}
                      onChange={(sig) => {
                        handleInputChange("podpisRodo", sig);
                        // Auto-approve RODO consent when signed
                        if (sig && !formData.zgodaPrzetwarzanieDanych) {
                          handleInputChange("zgodaPrzetwarzanieDanych", true);
                        }
                      }}
                      date={formData.miejscowoscData}
                    />
                  </div>
                </div>
              </section>

              <div className="flex justify-between pt-4 pb-12">
                <button
                  type="button"
                  onClick={() => setCurrentStep("DATA")}
                  className="text-brand hover:text-brand-dark px-6 py-3 font-medium transition-colors"
                >
                  ← Wróć do danych
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep("RODO2")}
                  disabled={!formData.podpisRodo}
                  className="bg-brand text-white py-3 px-8 rounded-xl text-lg font-medium shadow-lg hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Dalej →
                </button>
              </div>
            </div>
          )}

          {/* KROK 3: RODO 2 */}
          {currentStep === "RODO2" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <section className="bg-gradient-emerald rounded-2xl border border-[#D4AF37] overflow-hidden">
                <div className="p-6 md:p-8">
                  <h3 className="text-2xl font-serif text-marble-text mb-6">
                    {rodoInfo.clauseTitle}
                  </h3>
                  <div className="bg-ui-bg p-6 rounded-xl text-sm text-ui-textSecondary leading-relaxed whitespace-pre-line max-h-[60vh] overflow-y-auto mb-6 border border-[#D4AF37]">
                    {rodoInfo.clauseText}
                  </div>
                  {/* Signature Area for RODO 2 */}
                  <div className="mt-8">
                    <SignaturePad
                      label="Podpis Klienta (Klauzula informacyjna)"
                      value={formData.podpisRodo2 || ""}
                      onChange={(sig) => {
                        handleInputChange("podpisRodo2", sig);
                      }}
                      date={formData.miejscowoscData}
                    />
                    <p className="text-xs text-marble-textSecondary mt-3 italic">
                      Złożenie podpisu jest równoznaczne z zapoznaniem się z
                      powyższą klauzulą informacyjną RODO.
                    </p>
                  </div>
                </div>
              </section>

              <div className="flex justify-between pt-4 pb-12">
                <button
                  type="button"
                  onClick={() => setCurrentStep("RODO")}
                  className="text-brand hover:text-brand-dark px-6 py-3 font-medium transition-colors"
                >
                  ← Wróć do RODO
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep("TREATMENT")}
                  disabled={!formData.podpisRodo2}
                  className="bg-brand text-white py-3 px-8 rounded-xl text-lg font-medium shadow-lg hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Dalej →
                </button>
              </div>
            </div>
          )}

          {/* KROK 4: ZABIEG */}
          {currentStep === "TREATMENT" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Ryzyko Hyaluronic */}
              <section className="bg-gradient-emerald rounded-2xl border border-[#D4AF37]">
                <div className="p-6 md:p-8">
                  <h3 className="text-2xl font-serif text-marble-text mb-6 border-b border-[#D4AF37] pb-2">
                    Świadomość Ryzyka
                  </h3>
                  <p className="text-sm text-ui-textSecondary mb-4">
                    Zostałam/em poinformowana/y o przebiegu zabiegu i możliwości
                    naturalnego wystąpienia ryzyka:
                  </p>

                  <div className="space-y-6">
                    <div className="bg-ui-bg p-5 rounded-xl border border-[#D4AF37]/50">
                      <p className="text-sm font-medium text-marble-text mb-3">
                        Możliwe naturalne reakcje:
                      </p>
                      <ul className="space-y-2 text-sm text-ui-textSecondary">
                        <li className="flex items-start gap-2">
                          <span className="text-brand">•</span>
                          Zaczerwienienie skóry
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-brand">•</span>
                          Lekkie szczypanie/pieczenie w trakcie zabiegu
                        </li>
                      </ul>
                    </div>

                    <div className="bg-ui-bg p-5 rounded-xl border border-[#D4AF37]/50">
                      <p className="text-sm font-medium text-marble-text mb-3">
                        Możliwe powikłania:
                      </p>
                      <div className="space-y-3 text-sm text-ui-textSecondary">
                        <p>
                          <span className="font-medium">Możliwe reakcje:</span>{" "}
                          Zaczerwienienie, swędzenie, pieczenie, reakcja
                          alergiczna.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Zalecenia Hyaluronic */}
              <section className="bg-gradient-emerald rounded-2xl border border-[#D4AF37]">
                <div className="p-6 md:p-8">
                  <h3 className="text-2xl font-serif text-marble-text mb-6 border-b border-[#D4AF37] pb-2">
                    Zobowiązania Pozabiegowe
                  </h3>
                  <p className="text-sm text-ui-textSecondary mb-4">
                    Zobowiązuję się do przestrzegania następujących zaleceń:
                  </p>
                  <ul className="space-y-2 text-ui-textSecondary text-sm bg-ui-bg p-4 rounded-xl border border-[#D4AF37]/30">
                    {eyebrowLaminationPostCare.map((instruction, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="text-brand">•</span>
                        <span
                          className={
                            instruction.startsWith("UWAGA")
                              ? "font-bold text-brand"
                              : ""
                          }
                        >
                          {instruction}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>

              {/* Oświadczenia */}
              <section className="bg-gradient-emerald rounded-2xl border border-[#D4AF37] p-6 md:p-8">
                <h3 className="text-2xl font-serif text-marble-text mb-6 border-b border-[#D4AF37] pb-2">
                  Oświadczenia
                </h3>
                <div className="bg-ui-bg p-5 rounded-xl mb-6 border border-[#D4AF37]/50">
                  <h4 className="font-serif text-marble-text text-lg mb-4">
                    ŚWIADOMA ZGODA NA ZABIEG LAMINACJI BRWI I RZĘS
                  </h4>
                  <h5 className="font-serif text-marble-text/90 text-md mb-4 uppercase tracking-wide">
                    OŚWIADCZENIA I ZGODY KLIENTA:
                  </h5>

                  <div className="space-y-4 text-sm text-ui-textSecondary leading-relaxed">
                    <p>
                      <strong>Informacja o zabiegu:</strong> Oświadczam, że
                      zostałam/em poinformowana/ny o przebiegu zabiegu
                      laminacji, możliwych efektach wizualnych oraz ryzyku z nim
                      związanym (w tym o możliwości wystąpienia podrażnień lub
                      reakcji alergicznych).
                    </p>
                    <p>
                      <strong>Brak przeciwwskazań:</strong> Zapoznałam/em się z
                      listą przeciwwskazań i oświadczam, że u mnie nie
                      występują:
                      <ul className="list-disc pl-5 mt-2 space-y-1">
                        <li>
                          infekcje oczu (np. zapalenie spojówek) lub stany
                          zapalne skóry w miejscu zabiegu,
                        </li>
                        <li>
                          choroby dermatologiczne (np. łuszczyca, egzema,
                          aktywna opryszczka),
                        </li>
                        <li>
                          alergie na składniki preparatów stosowanych do
                          laminacji i liftingu,
                        </li>
                        <li>
                          bardzo słabe, zniszczone lub rzadkie rzęsy/włoski
                          (przeciwwskazanie względne),
                        </li>
                        <li>
                          świeże zabiegi medycyny estetycznej lub chirurgiczne w
                          okolicy oczu/brwi.
                        </li>
                      </ul>
                    </p>
                    <p>
                      <strong>Stan zdrowia:</strong> Poinformowałam/em
                      Specjalistę o wszelkich istotnych informacjach
                      zdrowotnych, w tym o chorobach, uczuleniach oraz
                      ciąży/karmieniu piersią (zmiany hormonalne mogą wpłynąć na
                      trwałość zabiegu). Wszystkie podane informacje są
                      prawdziwe.
                    </p>
                    <p>
                      <strong>Indywidualny rezultat:</strong> Rozumiem, że efekt
                      końcowy laminacji (stopień podkręcenia rzęs lub ułożenia
                      brwi) zależy od indywidualnych predyspozycji, takich jak
                      struktura, grubość i kondycja włosa.
                    </p>
                    <p>
                      <strong>Pielęgnacja pozabiegowa:</strong> Zostałam/em
                      poinformowana/ny o zaleceniach (m.in. zakaz moczenia
                      włosków do 24h po zabiegu) i zobowiązuję się do ich
                      ścisłego przestrzegania.
                    </p>

                    <div className="bg-marble-border/20 p-4 rounded-lg border border-[#D4AF37]/30 my-4">
                      <p className="mb-3 font-medium text-marble-text">
                        <strong>Zgoda na wizerunek (opcjonalnie):</strong>{" "}
                        Wyrażam zgodę na wykonanie zdjęć przed i po zabiegu w
                        celach dokumentacyjnych, szkoleniowych oraz
                        promocyjnych:
                      </p>
                      <div className="flex gap-6">
                        <label className="flex items-center gap-3 cursor-pointer group">
                          <div
                            className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${formData.zgodaFotografie ? "bg-brand border-brand text-black" : "border-[#D4AF37] group-hover:border-brand"}`}
                          >
                            {formData.zgodaFotografie && (
                              <Check className="w-4 h-4" />
                            )}
                          </div>
                          <input
                            type="checkbox"
                            className="hidden"
                            checked={formData.zgodaFotografie}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              handleInputChange("zgodaFotografie", checked);
                              // Auto-sign photo consent if checked, or clear signature if unchecked
                              if (checked && !formData.podpisFotografie) {
                                // We'll leverage the main signature for this since it's inline
                                handleInputChange(
                                  "podpisFotografie",
                                  "INLINE_CONSENT",
                                );
                              } else if (!checked) {
                                handleInputChange("podpisFotografie", "");
                              }
                            }}
                          />
                          <span
                            className={`font-medium ${formData.zgodaFotografie ? "text-brand" : "text-ui-textSecondary group-hover:text-brand"}`}
                          >
                            TAK
                          </span>
                        </label>

                        <label className="flex items-center gap-3 cursor-pointer group">
                          <div
                            className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${!formData.zgodaFotografie ? "bg-ui-bg border-[#D4AF37]" : "border-[#D4AF37] group-hover:border-brand"}`}
                          >
                            {!formData.zgodaFotografie && (
                              <div className="w-3 h-3 bg-ui-textMuted rounded-sm" />
                            )}
                          </div>
                          <input
                            type="checkbox"
                            className="hidden"
                            checked={!formData.zgodaFotografie}
                            onChange={(e) => {
                              if (e.target.checked) {
                                handleInputChange("zgodaFotografie", false);
                                handleInputChange("podpisFotografie", "");
                              }
                            }}
                          />
                          <span
                            className={`font-medium ${!formData.zgodaFotografie ? "text-ui-textSecondary" : "text-ui-textMuted group-hover:text-brand"}`}
                          >
                            NIE
                          </span>
                        </label>
                      </div>
                    </div>

                    <p>
                      <strong>Odpowiedzialność:</strong> Świadomie decyduję się
                      na wykonanie zabiegu na własną odpowiedzialność.
                    </p>

                    <div className="mt-6 pt-4 border-t border-[#D4AF37]/30">
                      <p className="font-serif text-marble-text mb-2">PODPISY:</p>
                      <p>
                        {formData.miejscowoscData}
                        <span className="text-xs text-ui-textMuted block">
                          (Miejscowość i data)
                        </span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Podpis pod Zabiegiem (Nowy, obowiązkowy) */}
                <div className="bg-ui-bg rounded-2xl border border-[#D4AF37] p-6 md:p-8 mt-8">
                  <h3 className="text-xl font-serif text-marble-text mb-4 border-b border-[#D4AF37] pb-2">
                    Potwierdzenie Zgody na Zabieg
                  </h3>
                  <p className="text-sm text-ui-textSecondary mb-6">
                    Składając podpis poniżej potwierdzam, że zapoznałam/em się z
                    powyższymi informacjami, ryzykiem oraz zaleceniami i wyrażam
                    świadomą zgodę na przeprowadzenie zabiegu.
                  </p>
                  <SignaturePad
                    label="Podpis Klienta (Wymagany)"
                    value={formData.podpisDane}
                    onChange={(sig) => {
                      handleInputChange("podpisDane", sig);
                      // Możemy tu też ustawić flagę zgody, np. zgodaPomocPrawna (repurposed) lub po prostu polegać na podpisie
                      // Dla spójności z backendem, ustawmy zgodaPomocPrawna na true
                      handleInputChange("zgodaPomocPrawna", !!sig);
                    }}
                    date={formData.miejscowoscData}
                  />
                </div>
              </section>

              <div className="flex justify-between pt-4 pb-12">
                <button
                  type="button"
                  onClick={() => setCurrentStep("RODO")}
                  className="text-brand hover:text-brand-dark px-6 py-3 font-medium transition-colors"
                >
                  ← Wróć do RODO
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep("MARKETING")}
                  disabled={!formData.podpisDane}
                  className="bg-brand text-black py-3 px-8 rounded-xl text-lg font-bold shadow-lg hover:bg-brand-dark hover:text-brand disabled:opacity-50 disabled:cursor-not-allowed transition-all gold-glow-sm hover:scale-[1.02] active:scale-[0.98]"
                >
                  Dalej (Zgody dodatkowe) →
                </button>
              </div>
            </div>
          )}

          {/* KROK 4: MARKETING */}
          {currentStep === "MARKETING" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <section className="bg-gradient-emerald rounded-2xl border border-[#D4AF37] p-6 md:p-8">
                <h3 className="text-2xl font-serif text-marble-text mb-6 flex items-center gap-3">
                  <span className="w-8 h-8 bg-brand text-black rounded-full flex items-center justify-center text-sm font-sans font-bold">
                    9
                  </span>
                  Zgody Dodatkowe
                </h3>
                <p className="text-sm text-ui-textSecondary mb-6">
                  Poniższe zgody są <strong>opcjonalne</strong>.
                </p>

                {/* Zgoda na marketing */}
                <div className="bg-ui-bg rounded-xl overflow-hidden border border-[#D4AF37] hover:shadow-md transition-shadow">
                  <div className="p-6">
                    <h4 className="font-serif text-marble-text text-lg mb-3">
                      Zgoda Marketingowa
                    </h4>
                    <p className="text-sm text-ui-textSecondary leading-relaxed mb-6">
                      Wyrażam zgodę na otrzymywanie informacji o nowościach,
                      promocjach i ofertach specjalnych od firmy{" "}
                      <strong>{rodoInfo.firmaNazwa}</strong> drogą elektroniczną
                      (SMS / E-mail).
                    </p>
                    <SignaturePad
                      label="Podpis (Zgadzam się)"
                      value={formData.podpisMarketing}
                      onChange={(sig) => {
                        handleInputChange("podpisMarketing", sig);
                        handleInputChange("zgodaMarketing", !!sig);
                      }}
                      date={formData.miejscowoscData}
                    />
                  </div>
                </div>
              </section>

              <div className="flex justify-between pt-4 pb-12 items-center border-t border-[#D4AF37]/50 mt-8">
                <button
                  type="button"
                  onClick={() => setCurrentStep("TREATMENT")}
                  className="text-brand hover:text-brand-dark px-6 py-3 font-medium transition-colors"
                >
                  ← Wróć do zabiegu
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !isSignatureVerified}
                  className="bg-brand text-black py-4 px-12 rounded-xl text-lg font-bold shadow-lg hover:bg-brand-dark hover:text-brand disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:-translate-y-0.5"
                >
                  {isSubmitting ? (
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                      Zapisywanie...
                    </div>
                  ) : (
                    "Zatwierdź i Wyślij Kartę"
                  )}
                </button>
              </div>
            </div>
          )}
        </form>
      </main>

      <Footer />

      {/* Modal weryfikacji podpisu */}
      <SignatureVerificationModal
        isOpen={showSignatureModal}
        onClose={() => setShowSignatureModal(false)}
        onVerified={handleSignatureVerified}
        phoneNumber={formData.telefon}
        documentContent={getDocumentContent()}
        clientName={formData.imieNazwisko || "Klient"}
      />
    </div>
  );
}
