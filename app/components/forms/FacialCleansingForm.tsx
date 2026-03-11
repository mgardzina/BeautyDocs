import { useState, useEffect } from "react";
import Image from "next/image";
import { Phone, Check, ArrowLeft, Instagram, Mail, Shield } from "lucide-react";
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
  rodoInfo,
  oczyszczanieTwarzyContraindications,
  oczyszczanieTwarzyCategoryBreaks,
  oczyszczanieTwarzyNaturalReactions,
  oczyszczanieTwarzyComplications,
  oczyszczanieTwarzyComplicationsVeryRare,
  oczyszczanieTwarzyPostCare,
} from "../../../types/booking";
import { SALON_CONFIG } from "@/app/config/salon";

interface FacialCleansingFormProps {
  onBack: () => void;
}

const initialFormData: ConsentFormData = {
  type: "FACIAL_CLEANSING",
  imieNazwisko: "",
  ulica: "",
  kodPocztowy: "",
  miasto: SALON_CONFIG.city,
  dataUrodzenia: "",
  telefon: "",
  miejscowoscData: `${SALON_CONFIG.city}, ${getTodayDate()}`,
  osobaPrzeprowadzajacaZabieg: "",
  nazwaProduktu: "",
  obszarZabiegu: "",
  celEfektu: "",
  numerZabiegu: "",
  metodaZabiegu: "",
  przeciwwskazania: Object.entries(oczyszczanieTwarzyContraindications).reduce(
    (acc, [key, value]) => {
      const hasFollowUp = typeof value === "object" && value.hasFollowUp;
      return {
        ...acc,
        [key]: null,
        ...(hasFollowUp ? { [`${key}_details`]: "" } : {}),
      };
    },
    {},
  ),
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
  wykazLekow: "", // INITIALIZE
  inneSchorzenia: "", // INITIALIZE
};

export default function FacialCleansingForm({
  onBack,
}: FacialCleansingFormProps) {
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

  const contraindicationKeys = Object.keys(oczyszczanieTwarzyContraindications);
  const currentContraindicationKey =
    contraindicationKeys[currentContraindicationIndex];

  const currentContraindicationValue = oczyszczanieTwarzyContraindications[
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

  // Auto-close wizard when all questions are answered
  useEffect(() => {
    if (isWizardComplete && showContraindicationsWizard) {
      setShowContraindicationsWizard(false);
    }
  }, [isWizardComplete, showContraindicationsWizard]);

  const handleWizardAnswer = (value: boolean) => {
    handleContraindicationChange(currentContraindicationKey, value);
    // Determine if the answer given requires a follow-up
    const hasFollowUp = currentContraindicationObject?.hasFollowUp;
    const isSafePositive = currentContraindicationObject?.isPositiveAnswerSafe;
    const requiresFollowUp =
      hasFollowUp && (isSafePositive ? value === false : value === true);

    if (requiresFollowUp) {
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

  // Oblicz wiek na podstawie daty urodzenia

  const isAgeValid = calculateAge(formData.dataUrodzenia) >= 16;

  const handleContraindicationChange = (
    key: string,
    value: boolean | string,
  ) => {
    setFormData((prev) => ({
      ...prev,
      przeciwwskazania: { ...prev.przeciwwskazania, [key]: value },
    }));
  };

  // Handler dla zweryfikowanego podpisu
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
          <h2 className="text-3xl font-serif text-marble-text mb-4">
            Dziękujemy!
          </h2>
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
                className={
                  currentStep === "DATA"
                    ? "text-brand font-bold"
                    : "text-marble-textSecondary"
                }
              >
                1. Dane
              </span>
              <span className="text-marble-textSecondary">→</span>
              <span
                className={
                  currentStep === "RODO"
                    ? "text-brand font-bold"
                    : "text-marble-textSecondary"
                }
              >
                2. RODO
              </span>
              <span className="text-marble-textSecondary">→</span>
              <span
                className={
                  currentStep === "RODO2"
                    ? "text-brand font-bold"
                    : "text-marble-textSecondary"
                }
              >
                3. RODO 2
              </span>
              <span className="text-marble-textSecondary">→</span>
              <span
                className={
                  currentStep === "TREATMENT"
                    ? "text-brand font-bold"
                    : "text-marble-textSecondary"
                }
              >
                4. Zabieg
              </span>
              <span className="text-marble-textSecondary">→</span>
              <span
                className={
                  currentStep === "MARKETING"
                    ? "text-brand font-bold"
                    : "text-marble-textSecondary"
                }
              >
                5. Zgody
              </span>
            </div>
          </div>

          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-serif text-marble-text mb-3 tracking-tighter drop-shadow-lg">
              Oczyszczanie <span className="text-brand">Twarzy</span>
            </h1>
            <div className="flex items-center justify-center gap-4">
              <div className="h-[1px] w-12 bg-gradient-to-r from-transparent to-brand"></div>
              <p className="text-brand text-xs md:text-base font-light tracking-[0.4em] uppercase">
                Peeling kawitacyjny, jonoforeza, mikromasaż.
              </p>
              <div className="h-[1px] w-12 bg-gradient-to-l from-transparent to-brand"></div>
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
                        formData.dataUrodzenia && !isAgeValid
                          ? "border-red-500"
                          : "border-[#D4AF37]"
                      }`}
                    />
                    {validateBirthDate(formData.dataUrodzenia) !== null && (
                      <p className="text-red-400 text-xs mt-1">
                        {validateBirthDate(formData.dataUrodzenia)}
                      </p>
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
                    Zabieg oczyszczania twarzy to profesjonalna procedura
                    kosmetyczna obejmująca szereg technik oczyszczających,
                    pielęgnacyjnych i regenerujących. W zależności od wybranej
                    metody zabieg może obejmować: peeling kawitacyjny,
                    jonoforezę, mikromasaż, infuzję tlenową, terapię światłem
                    LED oraz inne zaawansowane techniki kosmetyczne.
                  </p>
                  <p>
                    Wskazaniem do zabiegu są: zaskórniki, rozszerzone pory,
                    nadmierne wydzielanie sebum, skóra matowa i zmęczona,
                    nierówny koloryt, odwodnienie, osłabiona bariera
                    hydrolipidowa, zmiany trądzikowe oraz ogólna potrzeba
                    odświeżenia i regeneracji skóry.
                  </p>
                  <p>
                    Zabieg wykonywany jest z użyciem profesjonalnych preparatów
                    kosmetycznych dobranych indywidualnie do potrzeb skóry.
                    Przed przystąpieniem do zabiegu przeprowadzany jest wywiad
                    medyczny w celu wykluczenia przeciwwskazań oraz określenia
                    potrzeb i oczekiwań.
                  </p>
                  <p>
                    Czas trwania zabiegu zależy od wybranej metody i stanu
                    skóry, średnio trwa od 45 minut do 1,5 godziny. Dla
                    uzyskania optymalnych efektów zaleca się regularne
                    wykonywanie zabiegów w odstępach co 3–4 tygodnie.
                  </p>
                </div>
              </section>

              {/* Rodzaj Zabiegu */}
              <section className="bg-gradient-emerald rounded-2xl border border-[#D4AF37] p-6 md:p-8">
                <h2 className="text-2xl font-serif text-marble-text mb-6 flex items-center gap-3">
                  <span className="w-8 h-8 bg-brand text-black rounded-full flex items-center justify-center text-sm font-sans font-bold">
                    3
                  </span>
                  Rodzaj Zabiegu
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                  {[
                    { value: "Oczyszczanie twarzy", label: "Oczyszczanie twarzy" },
                    { value: "Odbudowa bariery hydrolipidowej", label: "Odbudowa bariery hydrolipidowej" },
                    { value: "Terapia łączona na trądzik", label: "Terapia łączona na trądzik" },
                    { value: "Pro XN", label: "Pro XN" },
                    { value: "Terapia światłem LED", label: "Terapia światłem LED" },
                    { value: "Analiza skóry", label: "Analiza skóry" },
                  ].map((method) => (
                    <button
                      key={method.value}
                      type="button"
                      onClick={() =>
                        handleInputChange("metodaZabiegu", method.value)
                      }
                      className={`py-3 px-4 rounded-xl border-2 transition-all font-medium text-sm ${
                        formData.metodaZabiegu === method.value
                          ? "border-brand bg-brand text-white"
                          : "border-[#D4AF37] bg-ui-bg text-ui-textSecondary hover:border-brand hover:text-brand"
                      }`}
                    >
                      {method.label}
                    </button>
                  ))}
                </div>

                {/* Opis: Oczyszczanie twarzy */}
                {formData.metodaZabiegu === "Oczyszczanie twarzy" && (
                  <div className="bg-ui-bg p-6 rounded-xl border border-[#D4AF37] text-ui-textSecondary leading-relaxed space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    <h3 className="font-serif text-marble-text text-lg">
                      Oczyszczanie twarzy (kawitacja, ultradźwięki, infuzja tlenowa)
                    </h3>
                    <p>
                      Kompleksowy zabieg oczyszczający łączący kilka zaawansowanych
                      technologii. Peeling kawitacyjny wykorzystuje fale ultradźwiękowe
                      do delikatnego usunięcia martwego naskórka, zaskórników i
                      zanieczyszczeń z porów. Ultradźwięki wspomagają wchłanianie
                      substancji aktywnych w głębsze warstwy skóry, zwiększając
                      efektywność stosowanych preparatów. Infuzja tlenowa dostarcza
                      skoncentrowany tlen wraz z aktywnymi składnikami bezpośrednio
                      do skóry.
                    </p>
                    <p className="font-medium text-marble-text">
                      Efekty zabiegu:
                    </p>
                    <ul className="space-y-1 text-sm">
                      <li className="flex items-start gap-2">
                        <span className="text-brand">•</span>głębokie oczyszczenie porów i usunięcie zaskórników
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-brand">•</span>wygładzenie i wyrównanie kolorytu skóry
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-brand">•</span>nawilżenie i dotlenienie skóry
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-brand">•</span>poprawa elastyczności i jędrności
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-brand">•</span>rozświetlenie i odświeżenie cery
                      </li>
                    </ul>
                    <p className="text-sm italic">
                      Zabieg jest nieinwazyjny i bezbolesny. Zalecany dla każdego
                      rodzaju skóry, szczególnie skóry z zaskórnikami, rozszerzonymi
                      porami, matowej i zmęczonej.
                    </p>
                  </div>
                )}

                {/* Opis: Odbudowa bariery hydrolipidowej */}
                {formData.metodaZabiegu === "Odbudowa bariery hydrolipidowej" && (
                  <div className="bg-ui-bg p-6 rounded-xl border border-[#D4AF37] text-ui-textSecondary leading-relaxed space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    <h3 className="font-serif text-marble-text text-lg">
                      Odbudowa bariery hydrolipidowej
                    </h3>
                    <p>
                      Zabieg dedykowany skórze odwodnionej, wrażliwej i podrażnionej,
                      której bariera ochronna została naruszona. Bariera hydrolipidowa
                      to naturalna warstwa ochronna skóry, która chroni przed utratą
                      wody, czynnikami zewnętrznymi i drobnoustrojami. Jej osłabienie
                      prowadzi do suchości, zaczerwienień i nadmiernej reaktywności skóry.
                    </p>
                    <p>
                      Podczas zabiegu stosowane są preparaty bogate w ceramidy, kwasy
                      tłuszczowe, cholesterol i składniki nawilżające, które odbudowują
                      i wzmacniają płaszcz hydrolipidowy skóry.
                    </p>
                    <p className="font-medium text-marble-text">
                      Efekty zabiegu:
                    </p>
                    <ul className="space-y-1 text-sm">
                      <li className="flex items-start gap-2">
                        <span className="text-brand">•</span>odbudowa naturalnej bariery ochronnej skóry
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-brand">•</span>głębokie nawilżenie i zmniejszenie uczucia ściągnięcia
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-brand">•</span>redukcja zaczerwienień i podrażnień
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-brand">•</span>wzmocnienie odporności skóry na czynniki zewnętrzne
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-brand">•</span>przywrócenie komfortu i gładkości skóry
                      </li>
                    </ul>
                    <p className="text-sm italic">
                      Zabieg szczególnie polecany po intensywnych zabiegach
                      złuszczających, w okresie zimowym oraz dla skóry narażonej
                      na czynniki środowiskowe.
                    </p>
                  </div>
                )}

                {/* Opis: Terapia łączona na trądzik */}
                {formData.metodaZabiegu === "Terapia łączona na trądzik" && (
                  <div className="bg-ui-bg p-6 rounded-xl border border-[#D4AF37] text-ui-textSecondary leading-relaxed space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    <h3 className="font-serif text-marble-text text-lg">
                      Terapia łączona na trądzik
                    </h3>
                    <p>
                      Kompleksowa terapia skierowana do osób zmagających się z trądzikiem
                      w różnych stadiach zaawansowania. Zabieg łączy kilka technik
                      oczyszczania, regulacji sebum i działania przeciwzapalnego,
                      dostosowanych indywidualnie do potrzeb skóry.
                    </p>
                    <p>
                      Protokół zabiegu może obejmować: oczyszczanie kawitacyjne,
                      ekstrakcję zaskórników, aplikację preparatów antybakteryjnych
                      i regulujących wydzielanie sebum, a także terapię światłem
                      o działaniu przeciwzapalnym.
                    </p>
                    <p className="font-medium text-marble-text">
                      Efekty zabiegu:
                    </p>
                    <ul className="space-y-1 text-sm">
                      <li className="flex items-start gap-2">
                        <span className="text-brand">•</span>redukcja aktywnych zmian trądzikowych
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-brand">•</span>oczyszczenie i zwężenie porów
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-brand">•</span>regulacja nadmiernego wydzielania sebum
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-brand">•</span>zmniejszenie stanów zapalnych i zaczerwienień
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-brand">•</span>poprawa ogólnej kondycji i wyglądu skóry
                      </li>
                    </ul>
                    <p className="text-sm italic">
                      Dla uzyskania optymalnych efektów zalecana jest seria zabiegów
                      w odstępach co 2–3 tygodnie. Czas trwania i intensywność zabiegu
                      dobierane są indywidualnie.
                    </p>
                  </div>
                )}

                {/* Opis: Pro XN */}
                {formData.metodaZabiegu === "Pro XN" && (
                  <div className="bg-ui-bg p-6 rounded-xl border border-[#D4AF37] text-ui-textSecondary leading-relaxed space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    <h3 className="font-serif text-marble-text text-lg">
                      Pro XN
                    </h3>
                    <p>
                      Zaawansowany zabieg profesjonalny wykorzystujący innowacyjną
                      technologię do intensywnej regeneracji i odmłodzenia skóry.
                      Pro XN łączy działanie aktywnych składników z zaawansowanymi
                      metodami ich dostarczania do głębszych warstw skóry.
                    </p>
                    <p>
                      Zabieg stymuluje naturalne procesy naprawcze skóry, wspomaga
                      produkcję kolagenu i elastyny oraz poprawia mikrokrążenie.
                      Protokół jest dostosowywany indywidualnie w zależności od
                      potrzeb i stanu skóry.
                    </p>
                    <p className="font-medium text-marble-text">
                      Efekty zabiegu:
                    </p>
                    <ul className="space-y-1 text-sm">
                      <li className="flex items-start gap-2">
                        <span className="text-brand">•</span>intensywna regeneracja i odmłodzenie skóry
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-brand">•</span>poprawa jędrności i elastyczności
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-brand">•</span>wygładzenie drobnych zmarszczek
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-brand">•</span>rozświetlenie i ujednolicenie kolorytu
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-brand">•</span>głębokie odżywienie i nawilżenie skóry
                      </li>
                    </ul>
                    <p className="text-sm italic">
                      Zabieg przeznaczony dla osób poszukujących zaawansowanej
                      pielęgnacji anti-aging oraz intensywnej rewitalizacji skóry.
                    </p>
                  </div>
                )}

                {/* Opis: Terapia światłem LED */}
                {formData.metodaZabiegu === "Terapia światłem LED" && (
                  <div className="bg-ui-bg p-6 rounded-xl border border-[#D4AF37] text-ui-textSecondary leading-relaxed space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    <h3 className="font-serif text-marble-text text-lg">
                      Terapia światłem LED
                    </h3>
                    <p>
                      Nieinwazyjna terapia wykorzystująca światło LED o różnych
                      długościach fali do stymulacji komórek skóry. Każdy kolor
                      światła oddziałuje na inne procesy: światło czerwone pobudza
                      produkcję kolagenu i przyspiesza regenerację, światło niebieskie
                      działa antybakteryjnie i jest skuteczne w walce z trądzikiem,
                      a światło żółte wspomaga mikrokrążenie i redukuje zaczerwienienia.
                    </p>
                    <p className="font-medium text-marble-text">
                      Efekty zabiegu:
                    </p>
                    <ul className="space-y-1 text-sm">
                      <li className="flex items-start gap-2">
                        <span className="text-brand">•</span>stymulacja produkcji kolagenu i elastyny
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-brand">•</span>redukcja stanów zapalnych i trądziku
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-brand">•</span>przyspieszenie procesów regeneracyjnych skóry
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-brand">•</span>poprawa kolorytu i rozświetlenie cery
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-brand">•</span>redukcja zmarszczek i poprawa elastyczności
                      </li>
                    </ul>
                    <p className="text-sm italic">
                      Zabieg jest całkowicie bezbolesny i bezpieczny. Może być
                      stosowany jako samodzielna terapia lub jako uzupełnienie
                      innych zabiegów kosmetycznych. Zalecana seria: 6–10 zabiegów
                      w odstępach co 3–7 dni.
                    </p>
                  </div>
                )}

                {/* Opis: Analiza skóry */}
                {formData.metodaZabiegu === "Analiza skóry" && (
                  <div className="bg-ui-bg p-6 rounded-xl border border-[#D4AF37] text-ui-textSecondary leading-relaxed space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    <h3 className="font-serif text-marble-text text-lg">
                      Analiza skóry
                    </h3>
                    <p>
                      Profesjonalna analiza skóry z wykorzystaniem specjalistycznego
                      sprzętu diagnostycznego. Badanie pozwala na dokładną ocenę
                      stanu skóry, jej potrzeb oraz identyfikację problemów
                      niewidocznych gołym okiem.
                    </p>
                    <p>
                      Podczas analizy oceniane są: poziom nawilżenia, elastyczność,
                      głębokość zmarszczek, stan porów, poziom sebum, przebarwienia,
                      stan bariery hydrolipidowej oraz wrażliwość skóry. Na podstawie
                      wyników specjalista dobiera indywidualny plan pielęgnacji
                      domowej i gabinetowej.
                    </p>
                    <p className="font-medium text-marble-text">
                      Co zyskujesz:
                    </p>
                    <ul className="space-y-1 text-sm">
                      <li className="flex items-start gap-2">
                        <span className="text-brand">•</span>precyzyjne określenie typu i stanu skóry
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-brand">•</span>identyfikacja ukrytych problemów skórnych
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-brand">•</span>indywidualny plan pielęgnacji gabinetowej
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-brand">•</span>dobór odpowiednich kosmetyków do pielęgnacji domowej
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-brand">•</span>możliwość monitorowania efektów terapii w czasie
                      </li>
                    </ul>
                    <p className="text-sm italic">
                      Analiza skóry jest idealnym pierwszym krokiem przed rozpoczęciem
                      jakiejkolwiek terapii skórnej. Pozwala na świadome dobieranie
                      zabiegów i kosmetyków.
                    </p>
                  </div>
                )}
              </section>

              <section className="bg-gradient-emerald rounded-2xl border border-[#D4AF37] p-6 md:p-8">
                <h2 className="text-2xl font-serif text-marble-text mb-6 flex items-center gap-3">
                  <span className="w-8 h-8 bg-brand text-black rounded-full flex items-center justify-center text-sm font-sans font-bold">
                    5
                  </span>
                  Wywiad Medyczny
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

                {showContraindicationsWizard && !isWizardComplete ? (
                  <div className="bg-ui-bg p-6 rounded-xl border border-[#D4AF37] max-w-2xl mx-auto shadow-sm">
                    {/* Category Header */}

                    <div className="flex justify-between items-center mb-8">
                      <span className="text-sm font-medium text-brand">
                        Pytanie {currentContraindicationIndex + 1} z{" "}
                        {contraindicationKeys.length}
                      </span>
                      <div className="h-2 w-24 bg-black/20 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-brand transition-all duration-300"
                          style={{
                            width: `${
                              ((currentContraindicationIndex + 1) /
                                contraindicationKeys.length) *
                              100
                            }%`,
                          }}
                        />
                      </div>
                    </div>

                    <div className="flex flex-col items-center text-center gap-6 mb-8">
                      <div className="space-y-6 w-full max-w-2xl">
                        <h3 className="text-xl md:text-2xl font-serif text-marble-text leading-relaxed">
                          {typeof currentContraindicationValue === "string"
                            ? currentContraindicationValue
                            : currentContraindicationValue.text}
                        </h3>
                        {currentContraindicationObject?.hasFollowUp &&
                          formData.przeciwwskazania[
                            currentContraindicationKey
                          ] ===
                            (currentContraindicationObject.isPositiveAnswerSafe
                              ? false
                              : true) && (
                            <div className="animate-in fade-in slide-in-from-top-2 max-w-md mx-auto w-full text-left">
                              <input
                                type="text"
                                autoFocus
                                value={String(
                                  formData.przeciwwskazania[
                                    `${currentContraindicationKey}_details`
                                  ] || "",
                                )}
                                onChange={(e) =>
                                  handleContraindicationChange(
                                    `${currentContraindicationKey}_details`,
                                    e.target.value,
                                  )
                                }
                                className="w-full px-4 py-3 bg-ui-bg border border-[#D4AF37] rounded-xl focus:border-brand focus:ring-2 focus:ring-brand/20 text-marble-text placeholder-marble-textSecondary outline-none transition-all"
                                placeholder={
                                  currentContraindicationObject.followUpPlaceholder ||
                                  "Podaj szczegóły..."
                                }
                              />
                            </div>
                          )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6 max-w-md mx-auto">
                      <button
                        type="button"
                        onClick={() => handleWizardAnswer(false)}
                        className={`py-4 px-6 rounded-xl border-2 transition-all text-lg font-medium shadow-sm hover:shadow-md active:scale-95 flex items-center justify-center ${
                          currentContraindicationObject?.hasFollowUp &&
                          formData.przeciwwskazania[
                            currentContraindicationKey
                          ] === false
                            ? "border-green-500 bg-green-500 text-white"
                            : "bg-ui-bg border-[#D4AF37] text-ui-textSecondary active:border-green-500 active:bg-green-500 active:text-white md:hover:border-green-500 md:hover:bg-green-500 md:hover:text-white"
                        }`}
                      >
                        NIE
                      </button>
                      <button
                        type="button"
                        onClick={() => handleWizardAnswer(true)}
                        className={`py-4 px-6 rounded-xl border-2 transition-all text-lg font-medium shadow-sm hover:shadow-md active:scale-95 flex items-center justify-center ${
                          currentContraindicationObject?.hasFollowUp &&
                          formData.przeciwwskazania[
                            currentContraindicationKey
                          ] === true
                            ? "border-red-500 bg-red-500 text-white"
                            : "bg-ui-bg border-[#D4AF37] text-ui-textSecondary active:border-red-500 active:bg-red-500 active:text-white md:hover:border-red-500 md:hover:bg-red-500 md:hover:text-white"
                        }`}
                      >
                        TAK
                      </button>
                    </div>

                    {currentContraindicationObject?.hasFollowUp &&
                      formData.przeciwwskazania[currentContraindicationKey] !==
                        null && (
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

                    {Object.entries(oczyszczanieTwarzyContraindications).map(
                      ([key, value], index) => {
                        const questionText =
                          typeof value === "string" ? value : value.text;
                        const hasFollowUp =
                          typeof value === "object" && value.hasFollowUp;
                        const followUpDetails =
                          formData.przeciwwskazania[`${key}_details`];

                        return (
                          <div key={key}>
                            <div
                              className={`flex items-start gap-4 p-4 rounded-xl transition-colors ${
                                formData.przeciwwskazania[key]
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
                                      → {followUpDetails as string}
                                    </p>
                                  )}
                              </div>
                              <div className="ml-2">
                                {formData.przeciwwskazania[key] ? (
                                  <span className="inline-flex items-center px-3 py-1 bg-red-900/30 text-red-400 text-xs font-bold rounded-full border border-red-900/50 whitespace-nowrap">
                                    TAK
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-3 py-1 bg-green-900/30 text-green-400 text-xs font-bold rounded-full border border-green-900/50 whitespace-nowrap">
                                    NIE
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      },
                    )}
                  </div>
                )}
              </section>

              <section className="bg-gradient-emerald rounded-2xl border border-[#D4AF37] p-6 md:p-8">
                <h2 className="text-2xl font-serif text-marble-text mb-6 flex items-center gap-3">
                  <span className="w-8 h-8 bg-brand text-black rounded-full flex items-center justify-center text-sm font-sans font-bold">
                    6
                  </span>
                  Informacje o Skutkach Ubocznych i Powikłaniach
                </h2>

                <div className="space-y-6">
                  {/* Częste skutki uboczne */}
                  <div className="bg-ui-bg p-5 rounded-xl border border-[#D4AF37]">
                    <p className="text-sm font-medium text-marble-text mb-3">
                      MOŻLIWE DO WYSTĄPIENIA REAKCJE PO PRZEPROWADZONYM ZABIEGU
                      - CZĘSTE
                    </p>
                    <p className="text-sm text-ui-textSecondary mb-3">
                      Zostałem/am poinformowany/a o przebiegu zabiegu i
                      możliwości naturalnego wystąpienia po zabiegu reakcji
                      organizmu:
                    </p>
                    <ul className="space-y-2 text-sm text-ui-textSecondary">
                      {oczyszczanieTwarzyNaturalReactions.map(
                        (reaction, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <span className="text-brand">∙</span>
                            <span>{reaction}</span>
                          </li>
                        ),
                      )}
                    </ul>
                    <p className="text-sm font-bold text-brand mt-4">
                      UWAGA! Skóra w trakcie menstruacji może być bardziej
                      wrażliwa i reaktywna, co może wpływać na komfort
                      podczas zabiegu.
                    </p>
                  </div>

                  {/* Rzadkie powikłania */}
                  <div className="bg-ui-bg p-5 rounded-xl border border-[#D4AF37]">
                    <p className="text-sm font-medium text-marble-text mb-3">
                      MOŻLIWE POWIKŁANIA PO PRZEPROWADZONYM ZABIEGU – RZADKIE
                    </p>
                    <ul className="space-y-2 text-sm text-ui-textSecondary">
                      {oczyszczanieTwarzyComplications.map(
                        (complication, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <span className="text-brand">∙</span>
                            <span>{complication}</span>
                          </li>
                        ),
                      )}
                    </ul>
                  </div>

                  {/* Bardzo rzadkie powikłania - NEW SECTION */}
                  <div className="bg-ui-bg p-5 rounded-xl border border-[#D4AF37]">
                    <p className="text-sm font-medium text-marble-text mb-3">
                      MOŻLIWE POWIKŁANIA PO PRZEPROWADZONYM ZABIEGU – BARDZO
                      RZADKIE
                    </p>
                    <ul className="space-y-2 text-sm text-ui-textSecondary">
                      {oczyszczanieTwarzyComplicationsVeryRare.map(
                        (complication, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <span className="text-brand">∙</span>
                            <span>{complication}</span>
                          </li>
                        ),
                      )}
                    </ul>
                  </div>

                  {/* Empty div for layout balance if needed, or remove */}
                </div>
              </section>

              <section className="bg-gradient-emerald rounded-2xl border border-[#D4AF37] p-6 md:p-8">
                <h2 className="text-2xl font-serif text-marble-text mb-6 flex items-center gap-3">
                  <span className="w-8 h-8 bg-brand text-black rounded-full flex items-center justify-center text-sm font-sans font-bold">
                    7
                  </span>
                  Zalecenia Pozabiegowe
                </h2>

                <div className="bg-ui-bg p-5 rounded-xl border border-[#D4AF37] mb-6">
                  <p className="text-sm text-ui-textSecondary leading-relaxed mb-4">
                    <strong>ZALECENIA PO PRZEPROWADZONYM ZABIEGU</strong>
                    <br />
                    Niniejszym oświadczam, że zostałam/em poinformowana o
                    konieczności stosowania się po przeprowadzonym zabiegu do
                    przestrzegania następujących zaleceń:
                  </p>
                  <ul className="space-y-2 text-sm text-ui-textSecondary">
                    {oczyszczanieTwarzyPostCare.map((instruction, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="text-brand">∙</span>
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
              {/* Skutki Uboczne i Powikłania */}
              <section className="bg-gradient-emerald rounded-2xl border border-[#D4AF37] p-6 md:p-8">
                <h2 className="text-2xl font-serif text-marble-text mb-6 flex items-center gap-3">
                  <span className="w-8 h-8 bg-brand text-black rounded-full flex items-center justify-center text-sm font-sans font-bold">
                    5
                  </span>
                  Informacje o Skutkach Ubocznych i Powikłaniach
                </h2>
                <div className="space-y-6">
                  <p className="text-sm text-ui-textSecondary mb-4">
                    Zostałam/em poinformowana/y o przebiegu zabiegu i możliwości
                    naturalnego wystąpienia ryzyka:
                  </p>

                  <div className="bg-ui-bg p-5 rounded-xl border border-[#D4AF37]">
                    <p className="text-sm font-medium text-marble-text mb-3">
                      MOŻLIWE DO WYSTĄPIENIA NATURALNE REAKCJE PO ZABIEGU:
                    </p>
                    <ul className="space-y-2 text-sm text-ui-textSecondary">
                      {oczyszczanieTwarzyNaturalReactions.map(
                        (reaction, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <span className="text-brand">∙</span>
                            <span>{reaction}</span>
                          </li>
                        ),
                      )}
                    </ul>
                  </div>

                  <div className="bg-ui-bg p-5 rounded-xl border border-[#D4AF37]">
                    <p className="text-sm font-medium text-marble-text mb-3">
                      MOŻLIWE POWIKŁANIA PO ZABIEGU:
                    </p>
                    <ul className="space-y-2 text-sm text-ui-textSecondary">
                      {oczyszczanieTwarzyComplications.map(
                        (complication, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <span className="text-brand">∙</span>
                            <span>{complication}</span>
                          </li>
                        ),
                      )}
                    </ul>
                  </div>
                </div>
              </section>

              {/* Zalecenia Pozabiegowe */}
              <section className="bg-gradient-emerald rounded-2xl border border-[#D4AF37] p-6 md:p-8">
                <h2 className="text-2xl font-serif text-marble-text mb-6 flex items-center gap-3">
                  <span className="w-8 h-8 bg-brand text-black rounded-full flex items-center justify-center text-sm font-sans font-bold">
                    6
                  </span>
                  Zalecenia Pozabiegowe
                </h2>
                <div className="bg-ui-bg p-5 rounded-xl border border-[#D4AF37]">
                  <p className="text-sm text-ui-textSecondary leading-relaxed mb-4">
                    <strong>
                      Zobowiązuję się do przestrzegania następujących zaleceń:
                    </strong>
                  </p>
                  <ul className="space-y-2 text-sm text-ui-textSecondary">
                    {oczyszczanieTwarzyPostCare.map((instruction, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="text-brand">∙</span>
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

              {/* Regulamin Salonu */}
              <section className="bg-gradient-emerald rounded-2xl border border-[#D4AF37] p-6 md:p-8">
                <h2 className="text-2xl font-serif text-marble-text mb-6 flex items-center gap-3">
                  <span className="w-8 h-8 bg-brand text-black rounded-full flex items-center justify-center text-sm font-sans font-bold">
                    7
                  </span>
                  Regulamin Salonu
                </h2>
                <div className="bg-ui-bg p-5 rounded-xl border border-[#D4AF37]">
                  <p className="text-sm text-ui-textSecondary mb-4 font-medium uppercase tracking-wide">
                    Jestem świadoma poniższych zasad, wynikających z regulaminu
                    salonu:
                  </p>
                  <ol className="list-decimal pl-5 space-y-3 text-sm text-ui-textSecondary leading-relaxed">
                    <li>
                      Dokonanie zapisu na zabieg oznacza pełną akceptację
                      regulaminu oraz wymienione poniżej zasady.
                    </li>
                    <li>
                      Rezerwując termin warto jest się upewnić, że nie ma
                      żadnych przeciwwskazań do wykonania zabiegu.
                    </li>
                    <li>
                      Jeśli masz jakiekolwiek wątpliwości dotyczące zabiegu,
                      umów się telefonicznie na bezpłatną konsultację.
                    </li>
                    <li>
                      Klientka ma prawo odwołać wizytę na 24 godziny przed
                      planowanym terminem. Rezygnacja z terminu w ostatniej
                      chwili tj. tego samego dnia skutkuje wpisaniem Klientki
                      na naszą „Czarną listę&quot;. Rozumiemy sytuacje
                      wyjątkowe i przypadki losowe (należy je potwierdzić np.
                      zwolnieniem lekarskim).
                    </li>
                    <li>
                      Klientka ma prawo do zmiany terminu wizyty najpóźniej na
                      24h przed planowaną wizytą.
                    </li>
                    <li>
                      Specjalista ma prawo odmówić wykonania zabiegu, jeżeli
                      stwierdzi przeciwwskazania zdrowotne lub skórne
                      uniemożliwiające bezpieczne przeprowadzenie zabiegu.
                    </li>
                    <li>
                      Klientka zobowiązana jest poinformować Specjalistę o
                      wszelkich zmianach stanu zdrowia, przyjmowanych lekach
                      oraz alergiach przed przystąpieniem do zabiegu.
                    </li>
                    <li>
                      Salon nie ponosi odpowiedzialności za skutki wynikające
                      z nieprzestrzegania zaleceń pozabiegowych przekazanych
                      przez Specjalistę.
                    </li>
                    <li>
                      Zastrzegamy sobie prawo do zmiany poszczególnych punktów
                      regulaminu.
                    </li>
                    <li>
                      Zastrzegamy sobie prawo do zmiany ustalonego wcześniej
                      terminu wizyty po ustaleniu z Klientką innego, dogodnego
                      dla obu stron.
                    </li>
                  </ol>
                </div>
              </section>

              {/* Oświadczenia */}
              <section className="bg-gradient-emerald rounded-2xl border border-[#D4AF37] p-6 md:p-8">
                <h2 className="text-2xl font-serif text-marble-text mb-6 flex items-center gap-3">
                  <span className="w-8 h-8 bg-brand text-black rounded-full flex items-center justify-center text-sm font-sans font-bold">
                    8
                  </span>
                  Oświadczenia
                </h2>
                <div className="bg-ui-bg p-5 rounded-xl mb-6 border border-[#D4AF37]">
                  <h4 className="font-serif text-brand text-lg mb-4 uppercase tracking-wider">
                    OŚWIADCZENIE I ŚWIADOMA ZGODA NA ZABIEG OCZYSZCZANIA TWARZY
                  </h4>
                  <p className="text-sm text-ui-textSecondary mb-4 italic">
                    Ja, niżej podpisana/y, po przeprowadzeniu szczegółowego
                    wywiadu i konsultacji ze Specjalistą, oświadczam, że:
                  </p>

                  <div className="space-y-4 text-sm text-ui-textSecondary leading-relaxed">
                    <p>
                      <strong>Stan zdrowia i odpowiedzialność:</strong>{" "}
                      Specjalista poinformował mnie o przeciwwskazaniach do
                      zabiegu. Oświadczam, że nie występują u mnie żadne z nich
                      (m.in. ciąża, epilepsja, nowotwory, czynna gruźlica,
                      nadczynność tarczycy, implanty metalowe w miejscu zabiegu).
                    </p>
                    <p>
                      Udzieliłam/em pełnych i prawdziwych informacji o moim
                      stanie zdrowia. Mam pełną świadomość, że zatajenie
                      informacji lub podanie nieprawdy traktowane będzie jako
                      moje przyczynienie się do powstania ewentualnej szkody. W
                      przypadku zatajenia przeciwwskazań biorę na siebie pełną
                      odpowiedzialność za negatywne skutki zabiegu i zrzekam się
                      wszelkich roszczeń wobec osoby wykonującej zabieg.
                    </p>

                    <p>
                      <strong>Informacja o zabiegu i higiena:</strong>{" "}
                      Otrzymałam/em wyczerpujące informacje na temat zabiegu
                      oczyszczania twarzy, techniki jego wykonania oraz celu.
                      Miałam/em możliwość zadawania pytań i uzyskałam/em na nie
                      jasne odpowiedzi.
                    </p>
                    <p>
                      Potwierdzam, że sprzęt i materiały użyte do zabiegu są
                      czyste i zdezynfekowane. W Salonie zachowane są najwyższe
                      normy higieniczne.
                    </p>

                    <p>
                      <strong>Przebieg i rekonwalescencja:</strong> Zostałam/em
                      poinformowana/y, że po zabiegu naturalnym objawem może być
                      zaczerwienienie skóry, lekkie podrażnienie lub uczucie
                      ściągnięcia, które ustępują zazwyczaj w ciągu kilku godzin
                      do 2 dni.
                    </p>
                    <p>
                      Wiem, że mogę powrócić do codziennych czynności po
                      zabiegu, jednak zobowiązuję się do ograniczenia stosowania
                      makijażu i drażniących kosmetyków przez 12 godzin oraz
                      stosowania ochrony przeciwsłonecznej.
                    </p>

                    <p>
                      <strong>Częstotliwość i trwałość efektów:</strong>{" "}
                      Poinformowano mnie, że czas trwania zabiegu zależy od
                      wybranej metody i stanu skóry (średnio 45 min – 1,5h).
                    </p>
                    <p>
                      Dla uzyskania optymalnych efektów zaleca się regularne
                      wykonywanie zabiegów w odstępach co 3–4 tygodnie.
                    </p>

                    <p>
                      <strong>Brak gwarancji i czynniki indywidualne:</strong>{" "}
                      Poinformowano mnie, że efekty zabiegu zależą od wielu
                      czynników (wiek, biochemia, rodzaj skóry, styl życia) i
                      nie da się w pełni zagwarantować identycznego rezultatu u
                      każdego klienta.
                    </p>
                    <p>
                      Oświadczam, że brak uzyskania oczekiwanego przeze mnie
                      subiektywnego efektu nie będzie podstawą do roszczeń, o
                      ile zabieg został wykonany zgodnie ze sztuką.
                    </p>

                    <p>
                      <strong>Kwalifikacje i decyzja:</strong> Oświadczam, że
                      mam świadomość, iż Specjalista wykonujący zabieg posiada
                      odpowiednie kwalifikacje i przeszkolenie w zakresie
                      wykonywanych zabiegów kosmetycznych.
                    </p>
                    <p>
                      Decyzję o poddaniu się zabiegowi podejmuję świadomie,
                      dobrowolnie i na własną odpowiedzialność, akceptując
                      ryzyko zabiegowe.
                    </p>

                    <p className="font-bold border-t border-[#D4AF37]/50 pt-4 mt-4">
                      AKCEPTACJA REGULAMINU: Oświadczam, że zapoznałam/em się z
                      Regulaminem Salonu dostępnym na stronie internetowej oraz
                      w recepcji. W pełni akceptuję jego postanowienia, w tym
                      zasady dotyczące rezerwacji, zadatków, korekt oraz
                      reklamacji.
                    </p>

                    <p className="mt-4 font-medium text-brand">
                      * W przypadku osoby niepełnoletniej wymagany jest podpis
                      rodzica lub opiekuna prawnego.
                    </p>
                  </div>
                </div>

                {/* Podpis pod Zabiegiem */}
                <div className="bg-ui-bg backdrop-blur-sm rounded-2xl border border-[#D4AF37] p-6 md:p-8 mt-8">
                  <h2 className="text-xl font-serif text-marble-text mb-4 flex items-center gap-2">
                    <span className="w-6 h-6 bg-brand text-black rounded-full flex items-center justify-center text-xs font-sans font-bold">
                      9
                    </span>
                    Potwierdzenie Zgody na Zabieg
                  </h2>
                  <p className="text-sm text-ui-textSecondary mb-6 italic">
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
                  className="bg-brand text-white py-3 px-8 rounded-xl text-lg font-medium shadow-lg hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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
                <h2 className="text-2xl font-serif text-marble-text mb-6 flex items-center gap-3">
                  <span className="w-8 h-8 bg-brand text-black rounded-full flex items-center justify-center text-sm font-sans font-bold">
                    7
                  </span>
                  Zgody Dodatkowe
                </h2>
                <p className="text-sm text-ui-textSecondary mb-6">
                  Poniższe zgody są <strong>opcjonalne</strong>.
                </p>

                {/* Zgoda na marketing */}
                <div className="bg-ui-bg backdrop-blur-sm rounded-xl shadow-sm overflow-hidden border border-[#D4AF37] hover:shadow-md transition-shadow">
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

                {/* Zgoda na wizerunek */}
                <div className="bg-ui-bg backdrop-blur-sm rounded-xl shadow-sm overflow-hidden border border-[#D4AF37] hover:shadow-md transition-shadow">
                  <div className="p-6">
                    <h4 className="font-serif text-marble-text text-lg mb-3">
                      Zgoda na Wykorzystanie Wizerunku
                    </h4>
                    <p className="text-sm text-ui-textSecondary leading-relaxed mb-4">
                      Wyrażam nieodpłatną zgodę na utrwalenie i
                      rozpowszechnianie mojego wizerunku (zdjęcia/video efektów
                      zabiegu) w celach promocyjnych salonu {SALON_CONFIG.name}.
                    </p>

                    <div className="mb-6">
                      <label className="block text-xs uppercase tracking-wider text-marble-textSecondary mb-2 font-medium">
                        Gdzie możemy publikować? (opcjonalnie)
                      </label>
                      <input
                        type="text"
                        value={formData.miejscaPublikacjiFotografii}
                        onChange={(e) =>
                          handleInputChange(
                            "miejscaPublikacjiFotografii",
                            e.target.value,
                          )
                        }
                        className="w-full px-4 py-2 bg-ui-bg border-b border-[#D4AF37] focus:border-brand outline-none text-sm transition-colors text-marble-text"
                        placeholder="np. Instagram, Facebook (zostaw puste = wszystkie)"
                      />
                    </div>

                    <SignaturePad
                      label="Podpis (Zgadzam się)"
                      value={formData.podpisFotografie}
                      onChange={(sig) => {
                        handleInputChange("podpisFotografie", sig);
                        handleInputChange("zgodaFotografie", !!sig);
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
                  className="bg-brand text-white py-4 px-12 rounded-xl text-lg font-medium shadow-lg hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:-translate-y-0.5"
                >
                  {isSubmitting ? (
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
