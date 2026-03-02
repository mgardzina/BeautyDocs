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
  modelowanieUstNaturalReactions,
  modelowanieUstComplications,
  modelowanieUstPostCare,
  rodoInfo,
} from "../../../types/booking";
import { modelowanieUstContraindications } from "../../../types/booking";
import { SALON_CONFIG } from "@/app/config/salon";

interface LipModelingFormProps {
  onBack: () => void;
}

const initialFormData: ConsentFormData = {
  type: "LIP_AUGMENTATION",
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
  przeciwwskazania: Object.entries(modelowanieUstContraindications).reduce(
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
};

export default function LipModelingForm({ onBack }: LipModelingFormProps) {
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

  const contraindicationKeys = Object.keys(modelowanieUstContraindications);
  const currentContraindicationKey =
    contraindicationKeys[currentContraindicationIndex];
  const currentContraindicationValue = modelowanieUstContraindications[
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
    // Determine if the answer given requires a follow-up
    const hasFollowUp = currentContraindicationObject?.hasFollowUp;
    const isSafePositive = currentContraindicationObject?.isPositiveAnswerSafe;
    const requiresFollowUp = hasFollowUp && (isSafePositive ? value === false : value === true);
    
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

  const handleContraindicationChange = (key: string, value: boolean) => {
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
            <h1 className="text-4xl md:text-6xl font-serif text-marble-text mb-3 tracking-tight">
              Modelowanie <span className="text-brand">Ust</span>
            </h1>
            <div className="flex items-center justify-center gap-4">
              <div className="h-px w-12 bg-brand"></div>
              <p className="text-brand text-sm md:text-lg font-light tracking-[0.3em] uppercase drop-shadow-sm">
                Kwas Hialuronowy
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
                      className="w-full px-4 py-3 bg-ui-bg border border-[#D4AF37] rounded-xl focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition-all text-marble-text placeholder-marble-textSecondary"
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
                      className="w-full px-4 py-3 bg-ui-bg border border-[#D4AF37] rounded-xl focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition-all text-marble-text placeholder-marble-textSecondary"
                      placeholder="Krosno, 27.01.2026"
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
                        className="w-full pl-12 pr-4 py-3 bg-ui-bg border border-[#D4AF37] rounded-xl focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition-all text-marble-text placeholder-marble-textSecondary"
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
                        className="w-full px-4 py-3 bg-ui-bg border border-[#D4AF37] rounded-xl focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition-all text-marble-text placeholder-marble-textSecondary"
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
                        className="w-full px-4 py-3 bg-ui-bg border border-[#D4AF37] rounded-xl focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition-all text-marble-text placeholder-marble-textSecondary"
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
                        className="w-full px-4 py-3 bg-ui-bg border border-[#D4AF37] rounded-xl focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition-all text-marble-text placeholder-marble-textSecondary"
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
                        className="w-full px-4 py-3 bg-ui-bg border border-[#D4AF37] rounded-r-xl focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition-all text-marble-text placeholder-marble-textSecondary"
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
                    Zabieg modelowania ust wykonywany jest przy użyciu kwasu
                    hialuronowego. Jest zabiegiem inwazyjnym gdyż związany jest
                    z przerwaniem ciągłości naskórka - wobec czego nie jest
                    pozbawiony ryzyka.
                  </p>
                  <p>
                    Zabieg polega na wstrzyknięciu produktu za pomocą igły w
                    miejsce poddane zabiegowi. Celem zabiegu jest powiększenie
                    ust, nawilżenie ust, wyrównanie asymetrii, uniesienie
                    kącików ust, stworzenie odpowiedniej proporcji między
                    wargami, a także poprawa walorów estetycznych i samopoczucia
                    klienta. Wprowadzony produkt jest przeźroczystym, ulegającym
                    biodegradacji żelem zawierającym kwas hialuronowy,
                    pochodzenia niezwierzęcego.
                  </p>
                  <p>
                    Zabieg odbywa się zawsze po wykluczeniu wszelkich
                    przeciwwskazań do wykonania zabiegu. W rozmowie z Klientem
                    zostają określone potrzeby i oczekiwania od wykonania
                    zabiegu z użyciem kwasu hialuronowego. Specjalista wraz z
                    klientką dobierają odpowiednio ilość preparatu, który ma
                    zostać podany w trakcie zabiegu.
                  </p>
                  <p>
                    Kolejnym etapem jest znieczulenie, które minimalizuje
                    dyskomfort podczas zabiegu. Próg bólu odczuwany jest
                    indywidualnie. Do zabiegu wykorzystuje się znieczulenie.
                    Zastosowanie znieczulenia gwarantuje zminimalizowanie bólu,
                    który w większości przypadków. Czas zabiegu zależny jest od
                    miejsca aplikacji oraz cech indywidualnych naskórka, ale
                    średnio trwa ok. godziny. Efekt końcowy widoczny jest po 21
                    dniach od przeprowadzonego zabiegu.
                  </p>
                  <p>
                    Zabieg modelowania ust nie daje efektów trwałych, jego efekt
                    utrzymuje się przez okres około od 1 do 10 miesięcy i należy
                    go powtórzyć. Efekt zabiegu utrzymuje się w zależności od
                    rodzaju skóry, wstrzykniętej ilości preparatu, oraz techniki
                    iniekcji, ale także od jakości życia. Średni okres
                    utrzymywania się efektu może być krótszy ze względu na silne
                    unaczynienie. Specjalista informuje Klienta o tym, że efekty
                    zabiegu nie są identyczne w przypadku każdego Klienta.
                  </p>
                </div>
              </section>

              {/* Szczegóły Zabiegu */}
              <section className="bg-gradient-emerald rounded-2xl border border-[#D4AF37] p-6 md:p-8 gold-glow-sm">
                <h2 className="text-2xl font-serif text-marble-text mb-6 flex items-center gap-3">
                  <span className="w-8 h-8 bg-brand text-white rounded-full flex items-center justify-center text-sm font-sans">
                    3
                  </span>
                  Szczegóły Zabiegu
                </h2>
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm text-ui-textSecondary mb-2 font-medium">
                      Nazwa preparatu
                    </label>
                    <div className="space-y-4">
                      {/* Product Selection */}
                      <div className="flex flex-col gap-3">
                        {[
                          {
                            name: "Revolax Deep ",
                            desc: "Gęstszy żel, który świetnie utrzymuje kształt. Polecany dla osób oczekujących wyraźniejszego powiększenia ust lub wypełnienia bruzd nosowo-wargowych.",
                          },
                          {
                            name: "Neuramis Deep",
                            desc: "Plastyczny i miękki żel. Doskonały dla osób ceniących subtelny, naturalny wygląd ust (soft lips) oraz do spłycania średnich zmarszczek.",
                          },
                        ].map((product) => {
                          const currentName = formData.nazwaProduktu || "";
                          const baseName = currentName
                            .split(" (")[0]
                            .split(" - ")[0];
                          const isSelectedProduct = baseName === product.name;

                          return (
                            <div
                              key={product.name}
                              onClick={() => {
                                // Select product only, reset volume if switching to new product
                                if (!isSelectedProduct) {
                                  handleInputChange(
                                    "nazwaProduktu",
                                    product.name,
                                  );
                                }
                              }}
                              className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
                                isSelectedProduct
                                  ? "border-brand bg-brand/10 gold-glow"
                                  : "border-[#D4AF37] bg-ui-bg hover:border-brand/60"
                              } shadow-xl shadow-brand/5`}
                            >
                              <div className="flex justify-between items-center mb-1">
                                <span
                                  className={`font-serif text-lg font-medium ${
                                    isSelectedProduct
                                      ? "text-marble-text"
                                      : "text-marble-text"
                                  }`}
                                >
                                  {product.name}
                                </span>
                                {isSelectedProduct && (
                                  <div className="w-6 h-6 bg-brand rounded flex items-center justify-center">
                                    <Check className="w-4 h-4 text-black" />
                                  </div>
                                )}
                              </div>
                              <p className="text-sm text-ui-textSecondary leading-relaxed mb-4">
                                {product.desc}
                              </p>

                              {/* Volume Selection inside Product Card */}
                              {isSelectedProduct && (
                                <div className="border-t border-[#D4AF37] pt-3 animate-in fade-in slide-in-from-top-2 duration-300">
                                  <p className="text-xs font-medium text-brand mb-2 uppercase tracking-wide">
                                    Wybierz ilość:
                                  </p>
                                  <div className="flex flex-wrap gap-2">
                                    {["1.0", "2.0", "3.0", "4.0"].map((vol) => {
                                      const isSelectedVolume =
                                        currentName ===
                                        `${product.name} - ${vol}ml`;
                                      return (
                                        <button
                                          key={vol}
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation(); // Prevent bubbling
                                            handleInputChange(
                                              "nazwaProduktu",
                                              `${product.name} - ${vol}ml`,
                                            );
                                          }}
                                          className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                                            isSelectedVolume
                                              ? "border-brand bg-brand text-white shadow-sm"
                                              : "border-[#D4AF37] bg-ui-bg text-ui-textSecondary hover:border-brand hover:text-brand"
                                          }`}
                                        >
                                          {vol} ml
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Additional History Section */}
                <div className="pt-8 mt-8 border-t border-brand/10">
                  <div className="bg-gradient-emerald p-5 rounded-xl border border-[#D4AF37] mb-6 space-y-4">
                    <h3 className="ont-serif text-marble-text text-lg mb-2">
                      Historia zabiegowa ust
                    </h3>
                    <p className="text-xs text-brand uppercase tracking-widest font-medium">
                      Informacje wymagane dla bezpieczeństwa
                    </p>
                    <div className="space-y-3">
                      {[
                        "Usta modelowane pierwszy raz",
                        "Usta modelowane drugi raz, w tym samym gabinecie",
                        "Usta modelowane drugi raz, pierwszy raz w innym gabinecie",
                      ].map((option) => (
                        <label
                          key={option}
                          className="flex items-start gap-3 cursor-pointer group"
                        >
                          <div className="relative flex items-center pt-1">
                            <input
                              type="checkbox"
                              checked={(
                                formData.informacjaDodatkowa || ""
                              ).includes(option)}
                              onChange={(e) => {
                                let parts = (formData.informacjaDodatkowa || "")
                                  .split("\n")
                                  .filter(Boolean);

                                if (e.target.checked) {
                                  // Remove other exclusive options if checked
                                  const exclusiveGroup = [
                                    "Usta modelowane pierwszy raz",
                                    "Usta modelowane drugi raz, w tym samym gabinecie",
                                    "Usta modelowane drugi raz, pierwszy raz w innym gabinecie",
                                  ];
                                  // Also remove the "Multiple times" option which starts with the prefix
                                  const multipleTimesPrefix =
                                    "Usta modelowane więcej razy";

                                  parts = parts.filter(
                                    (p) =>
                                      !exclusiveGroup.includes(p) &&
                                      !p.startsWith(multipleTimesPrefix),
                                  );
                                  parts.push(option);
                                } else {
                                  parts = parts.filter((p) => p !== option);
                                }
                                handleInputChange(
                                  "informacjaDodatkowa",
                                  parts.join("\n"),
                                );
                              }}
                              className="w-5 h-5 rounded border-brand/30 text-brand focus:ring-brand focus:ring-offset-0 accent-brand bg-ui-bgSecondary"
                            />
                          </div>
                          <span className="text-ui-textSecondary text-sm group-hover:text-brand transition-colors">
                            {option}
                          </span>
                        </label>
                      ))}

                      {/* Multiple Times with customized input */}
                      <div className="space-y-2">
                        <label className="flex items-start gap-3 cursor-pointer group">
                          <div className="relative flex items-center pt-1">
                            <input
                              type="checkbox"
                              checked={(
                                formData.informacjaDodatkowa || ""
                              ).includes("Usta modelowane więcej razy")}
                              onChange={(e) => {
                                let parts = (
                                  formData.informacjaDodatkowa || ""
                                ).split("\n");
                                const prefix = "Usta modelowane więcej razy: ";
                                if (e.target.checked) {
                                  // Remove other exclusive options
                                  const exclusiveGroup = [
                                    "Usta modelowane pierwszy raz",
                                    "Usta modelowane drugi raz, w tym samym gabinecie",
                                    "Usta modelowane drugi raz, pierwszy raz w innym gabinecie",
                                  ];
                                  parts = parts.filter(
                                    (p) => !exclusiveGroup.includes(p),
                                  );
                                  parts.push(prefix);
                                } else {
                                  parts = parts.filter(
                                    (p) => !p.startsWith(prefix),
                                  );
                                }
                                handleInputChange(
                                  "informacjaDodatkowa",
                                  parts.filter(Boolean).join("\n"),
                                );
                              }}
                              className="w-5 h-5 rounded border-[#D4AF37] text-brand focus:ring-brand focus:ring-offset-0 accent-brand bg-ui-bg"
                            />
                          </div>
                          <span className="text-ui-textSecondary text-sm group-hover:text-brand transition-colors">
                            Usta modelowane więcej razy
                          </span>
                        </label>
                        {(formData.informacjaDodatkowa || "").includes(
                          "Usta modelowane więcej razy",
                        ) && (
                          <input
                            type="text"
                            className="w-full ml-8 px-3 py-2 text-sm bg-ui-bg border border-[#D4AF37] rounded-lg focus:border-brand outline-none text-marble-text placeholder-marble-textSecondary"
                            placeholder="Kiedy, jaki preparat, ile razy?"
                            value={
                              (formData.informacjaDodatkowa || "")
                                .split("\n")
                                .find((p) =>
                                  p.startsWith("Usta modelowane więcej razy: "),
                                )
                                ?.replace(
                                  "Usta modelowane więcej razy: ",
                                  "",
                                ) || ""
                            }
                            onChange={(e) => {
                              const parts = (
                                formData.informacjaDodatkowa || ""
                              ).split("\n");
                              const index = parts.findIndex((p) =>
                                p.startsWith("Usta modelowane więcej razy: "),
                              );
                              if (index !== -1) {
                                parts[index] =
                                  `Usta modelowane więcej razy: ${e.target.value}`;
                                handleInputChange(
                                  "informacjaDodatkowa",
                                  parts.join("\n"),
                                );
                              }
                            }}
                          />
                        )}
                      </div>

                      {/* Hyaluronidase */}
                      <label className="flex items-start gap-3 cursor-pointer group pt-2 border-t border-[#D4AF37]/50">
                        <div className="relative flex items-center pt-1">
                          <input
                            type="checkbox"
                            checked={(
                              formData.informacjaDodatkowa || ""
                            ).includes("Usta po hialuronidazie")}
                            onChange={(e) => {
                              let parts = (
                                formData.informacjaDodatkowa || ""
                              ).split("\n");
                              if (e.target.checked) {
                                parts.push("Usta po hialuronidazie");
                              } else {
                                parts = parts.filter(
                                  (p) => p !== "Usta po hialuronidazie",
                                );
                              }
                              handleInputChange(
                                "informacjaDodatkowa",
                                parts.filter(Boolean).join("\n"),
                              );
                            }}
                            className="w-5 h-5 rounded border-[#D4AF37] text-brand focus:ring-brand focus:ring-offset-0 accent-brand bg-ui-bg"
                          />
                        </div>
                        <span className="text-ui-textSecondary text-sm group-hover:text-brand transition-colors">
                          Usta po hialuronidazie
                        </span>
                      </label>

                      {/* Other */}
                      <div className="pt-2">
                        <label className="block text-sm text-ui-textSecondary mb-2 font-medium">
                          Inne informacje
                        </label>
                        <textarea
                          rows={3}
                          className="w-full px-4 py-3 bg-ui-bg border border-[#D4AF37] rounded-xl focus:border-brand outline-none text-sm text-marble-text placeholder-marble-textSecondary"
                          placeholder="Dodatkowe uwagi..."
                          value={
                            (formData.informacjaDodatkowa || "")
                              .split("\n")
                              .find((p) => p.startsWith("Inne: "))
                              ?.replace("Inne: ", "") || ""
                          }
                          onChange={(e) => {
                            const parts = (
                              formData.informacjaDodatkowa || ""
                            ).split("\n");
                            const newVal = `Inne: ${e.target.value}`;
                            const index = parts.findIndex((p) =>
                              p.startsWith("Inne: "),
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
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-ui-textSecondary mb-2 font-medium">
                    Oczekiwany efekt
                  </label>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    {[
                      "Delikatny efekt",
                      "Powiększenie",
                      "Nawilżenie",
                      "Wyrównanie asymetrii",
                    ].map((effect) => (
                      <button
                        key={effect}
                        type="button"
                        onClick={() => {
                          const current = formData.celEfektu
                            ? formData.celEfektu.split(", ")
                            : [];
                          const newValue = current.includes(effect)
                            ? current.filter((i) => i !== effect).join(", ")
                            : [...current, effect].join(", ");
                          handleInputChange("celEfektu", newValue);
                        }}
                        className={`py-3 px-4 rounded-xl border-2 transition-all font-medium text-sm ${
                          formData.celEfektu.split(", ").includes(effect)
                            ? "border-brand bg-brand text-black"
                            : "border-[#D4AF37] bg-ui-bg text-ui-textSecondary hover:border-brand hover:text-brand"
                        }`}
                      >
                        {effect}
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              {/* Wywiad Medyczny Hyaluronic */}
              <section className="bg-gradient-emerald rounded-2xl border border-[#D4AF37] p-6 md:p-8">
                <h2 className="text-2xl font-serif text-marble-text mb-6 flex items-center gap-3">
                  <span className="w-8 h-8 bg-brand text-black rounded-full flex items-center justify-center text-sm font-sans font-bold">
                    4
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

                <div className="space-y-3">
                  {showContraindicationsWizard &&
                  !isWizardComplete &&
                  currentContraindicationIndex < contraindicationKeys.length ? (
                    <div
                      key={currentContraindicationIndex}
                      className="bg-ui-bg p-6 rounded-xl border border-[#D4AF37] max-w-2xl mx-auto shadow-sm"
                    >
                      <div className="flex justify-between items-center mb-6">
                        <span className="text-sm font-medium text-brand">
                          Pytanie {currentContraindicationIndex + 1} z{" "}
                          {contraindicationKeys.length}
                        </span>
                        <div className="h-2 w-24 bg-gradient-emerald rounded-full overflow-hidden">
                          <div
                            className="h-full bg-brand transition-all duration-300"
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
                              className="w-full px-4 py-3 text-base bg-ui-bg border-2 border-[#D4AF37] rounded-xl focus:border-brand outline-none transition-colors text-marble-text placeholder-marble-textSecondary"
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

                      <div className="grid grid-cols-2 gap-6 max-w-md mx-auto">
                        <button
                          type="button"
                          onClick={() => handleWizardAnswer(false)}
                          className={`py-4 px-6 rounded-xl border-2 transition-all text-lg font-medium shadow-sm hover:shadow-md active:scale-95 flex items-center justify-center ${
                            currentContraindicationObject?.hasFollowUp &&
                            formData.przeciwwskazania[
                              currentContraindicationKey
                            ] === false
                              ? "border-green-600 bg-green-600 text-marble-text"
                              : "bg-ui-bg border-[#D4AF37] text-ui-textSecondary active:border-green-600 active:bg-green-600 active:text-white md:hover:border-green-600 md:hover:bg-green-600 md:hover:text-brand"
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
                              : "bg-ui-bg border-[#D4AF37] text-ui-textSecondary active:border-red-500 active:bg-red-500 active:text-white md:hover:border-red-500 md:hover:bg-red-500 md:hover:text-brand"
                          }`}
                        >
                          TAK
                        </button>
                      </div>

                      {currentContraindicationObject?.hasFollowUp &&
                        formData.przeciwwskazania[
                          currentContraindicationKey
                        ] !== null && (
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
                      <div className="flex items-center justify-between p-4 bg-green-900/10 border border-green-500/20 rounded-xl mb-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                            <Check className="w-5 h-5 text-green-600" />
                          </div>
                          <span className="text-green-500 font-medium">
                            Wywiad medyczny zakończony
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={resetWizard}
                          className="text-sm text-green-500 hover:text-green-400 font-medium underline"
                        >
                          Edytuj odpowiedzi
                        </button>
                      </div>

                      {Object.entries(modelowanieUstContraindications).map(
                        ([key, value], index) => {
                          const questionText =
                            typeof value === "string" ? value : value.text;
                          const hasFollowUp =
                            typeof value === "object" && value.hasFollowUp;
                          const followUpDetails =
                            formData.przeciwwskazania[`${key}_details`];

                          return (
                            <div
                              key={key}
                              className={`flex items-start gap-4 p-4 rounded-xl transition-colors ${
                                formData.przeciwwskazania[key]
                                  ? "bg-red-900/10 border border-red-500/20"
                                  : "bg-green-900/10 border border-green-500/20"
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
                          );
                        },
                      )}
                    </div>
                  )}
                </div>
              </section>

              {/* Skutki Uboczne i Powikłania */}
              <section className="bg-gradient-emerald rounded-2xl border border-[#D4AF37] p-6 md:p-8">
                <h2 className="text-2xl font-serif text-marble-text mb-6 flex items-center gap-3">
                  <span className="w-8 h-8 bg-brand text-black rounded-full flex items-center justify-center text-sm font-sans font-bold">
                    5
                  </span>
                  Informacje o Skutkach Ubocznych i Powikłaniach
                </h2>

                <div className="space-y-6">
                  {/* Częste skutki uboczne */}
                  <div className="bg-ui-bg p-5 rounded-xl border border-[#D4AF37]">
                    <p className="text-sm font-medium text-marble-text mb-3">
                      MOŻLIWE DO WYSTĄPIENIA SKUTKI UBOCZNE PO PRZEPROWADZONYM
                      ZABIEGU - CZĘSTE
                    </p>
                    <ul className="space-y-2 text-sm text-ui-textSecondary">
                      {modelowanieUstNaturalReactions.map((reaction, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="text-brand">∙</span>
                          <span>{reaction}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Rzadkie powikłania */}
                  <div className="bg-ui-bg p-5 rounded-xl border border-[#D4AF37]">
                    <p className="text-sm font-medium text-marble-text mb-3">
                      MOŻLIWE POWIKŁANIA PO PRZEPROWADZONYM ZABIEGU – RZADKIE
                    </p>
                    <ul className="space-y-2 text-sm text-ui-textSecondary">
                      {modelowanieUstComplications.rzadkie.map(
                        (complication, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <span className="text-brand">∙</span>
                            <span>{complication}</span>
                          </li>
                        ),
                      )}
                    </ul>
                  </div>

                  {/* Bardzo rzadkie powikłania */}
                  <div className="bg-ui-bg p-5 rounded-xl border border-[#D4AF37]">
                    <p className="text-sm font-medium text-marble-text mb-3">
                      MOŻLIWE POWIKŁANIA PO PRZEPROWADZONYM ZABIEGU – BARDZO
                      RZADKIE
                    </p>
                    <ul className="space-y-2 text-sm text-ui-textSecondary">
                      {modelowanieUstComplications.bardzoRzadkie.map(
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

                <div className="bg-ui-bg p-5 rounded-xl border border-[#D4AF37] mb-6">
                  <p className="text-sm text-ui-textSecondary leading-relaxed mb-4">
                    <strong>
                      Niniejszym oświadczam, że zostałam/em poinformowana/y o
                      konieczności stosowania się po przeprowadzonym zabiegu do
                      przestrzegania następujących zaleceń:
                    </strong>
                  </p>
                  <ul className="space-y-2 text-sm text-ui-textSecondary">
                    {modelowanieUstPostCare.map((instruction, index) => (
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
                  className="bg-brand text-black py-4 px-8 rounded-xl text-lg font-bold shadow-lg hover:bg-brand-dark hover:text-brand disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-3"
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
                  className="text-brand hover:text-brand-light px-6 py-3 font-medium transition-colors"
                >
                  ← Wróć do danych
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep("RODO2")}
                  disabled={!formData.podpisRodo}
                  className="bg-brand text-black py-3 px-8 rounded-xl text-lg font-bold shadow-lg hover:bg-brand-dark hover:text-brand disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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
                  className="text-brand hover:text-brand-light px-6 py-3 font-medium transition-colors"
                >
                  ← Wróć do RODO
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep("TREATMENT")}
                  disabled={!formData.podpisRodo2}
                  className="bg-brand text-black py-3 px-8 rounded-xl text-lg font-bold shadow-lg hover:bg-brand-dark hover:text-brand disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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
              <section className="bg-gradient-emerald rounded-2xl border border-[#D4AF37] shadow-lg">
                <div className="p-6 md:p-8">
                  <h3 className="text-2xl font-serif text-marble-text mb-6 border-b border-[#D4AF37] pb-2">
                    Świadomość Ryzyka
                  </h3>
                  <p className="text-sm text-ui-textSecondary mb-4">
                    Zostałam/em poinformowana/y o przebiegu zabiegu i możliwości
                    naturalnego wystąpienia ryzyka:
                  </p>

                  <div className="space-y-6">
                    <div className="bg-ui-bg p-5 rounded-xl border border-[#D4AF37]">
                      <p className="text-sm font-medium text-marble-text mb-3">
                        Możliwe naturalne reakcje:
                      </p>
                      <ul className="space-y-2 text-sm text-ui-textSecondary">
                        {modelowanieUstNaturalReactions.map(
                          (reaction, index) => (
                            <li key={index} className="flex items-start gap-2">
                              <span className="text-brand">•</span>
                              {reaction}
                            </li>
                          ),
                        )}
                      </ul>
                    </div>

                    <div className="bg-gradient-emerald p-5 rounded-xl border border-[#D4AF37]/50">
                      <p className="text-sm font-medium text-marble-text mb-3">
                        Możliwe powikłania:
                      </p>
                      <div className="space-y-3 text-sm text-ui-textSecondary">
                        <p>
                          <span className="font-medium">Częste:</span>{" "}
                          {modelowanieUstComplications.czeste.join(", ")}
                        </p>
                        <p>
                          <span className="font-medium">Rzadkie:</span>{" "}
                          {modelowanieUstComplications.rzadkie.join(", ")}
                        </p>
                        <p>
                          <span className="font-medium">Bardzo rzadkie:</span>{" "}
                          {modelowanieUstComplications.bardzoRzadkie.join(", ")}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Zalecenia Hyaluronic */}
              <section className="bg-gradient-emerald rounded-2xl border border-[#D4AF37] shadow-lg">
                <div className="p-6 md:p-8">
                  <h3 className="text-2xl font-serif text-marble-text mb-6 border-b border-[#D4AF37] pb-2">
                    Zobowiązania Pozabiegowe
                  </h3>
                  <p className="text-sm text-ui-textSecondary mb-4">
                    Zobowiązuję się do przestrzegania następujących zaleceń:
                  </p>
                  <ul className="space-y-2 text-ui-textSecondary text-sm bg-ui-bg p-4 rounded-xl border border-[#D4AF37]">
                    {modelowanieUstPostCare.map((instruction, index) => (
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
              <section className="bg-gradient-emerald rounded-2xl border border-[#D4AF37] shadow-lg p-6 md:p-8">
                <h3 className="text-2xl font-serif text-marble-text mb-6 border-b border-[#D4AF37] pb-2">
                  Oświadczenia
                </h3>
                <div className="bg-ui-bg p-5 rounded-xl mb-6 border border-[#D4AF37]">
                  <h4 className="font-serif text-marble-text text-lg mb-4">
                    OŚWIADCZENIE I ŚWIADOMA ZGODA NA ZABIEG MODELOWANIA /
                    POWIĘKSZANIA UST
                  </h4>
                  <p className="text-sm text-ui-textSecondary mb-4">
                    Ja, niżej podpisana/y, po przeprowadzeniu szczegółowego
                    wywiadu i konsultacji ze Specjalistą, oświadczam, że:
                  </p>

                  <div className="space-y-4 text-sm text-ui-textSecondary leading-relaxed">
                    <p>
                      <strong>Stan zdrowia i świadomość:</strong> Udzieliłam/em
                      pełnych i prawdziwych odpowiedzi na pytania dotyczące
                      mojego stanu zdrowia. Oświadczam, że nie występują u mnie
                      żadne przeciwwskazania medyczne, fizyczne lub psychiczne,
                      które mogłyby wpłynąć na moją decyzję. W chwili
                      podpisywania niniejszego dokumentu nie jestem pod wpływem
                      alkoholu, narkotyków ani innych środków odurzających.
                      Decyzję o poddaniu się zabiegowi podejmuję w pełni
                      świadomie, dobrowolnie i w sposób przemyślany.
                    </p>
                    <p>
                      <strong>Informacja o zabiegu i higiena:</strong>{" "}
                      Otrzymałam/em wyczerpujące informacje na temat zabiegu,
                      techniki jego wykonania, wskazań oraz przebiegu. Miałam/em
                      możliwość zadawania pytań i uzyskałam/em na nie zrozumiałe
                      odpowiedzi. Potwierdzam, że materiały (w tym
                      ampułkostrzykawka z preparatem) użyte do zabiegu są
                      sterylne, jednorazowe i zostały otwarte w mojej obecności.
                    </p>
                    <p>
                      <strong>Ryzyko i powikłania:</strong> Zostałam/em
                      poinformowana/y o możliwych skutkach ubocznych, takich
                      jak: opuchlizna, zaczerwienienie, zasinienia (krwiaki),
                      tkliwość, które mogą utrzymywać się przez kilka dni. Mam
                      świadomość ryzyka wystąpienia reakcji alergicznej na
                      środek znieczulający lub wstrzyknięty preparat. Akceptuję
                      to ryzyko i nie będę wnosić roszczeń z tytułu
                      indywidualnej reakcji mojego organizmu. Oświadczam, że
                      rozumiejąc ryzyko powikłań, nie będę wnosić roszczeń
                      odszkodowawczych w przypadku wystąpienia typowych
                      następstw zabiegu lub powikłań, o których zostałam/em
                      uprzedzona/y.
                    </p>
                    <p>
                      <strong>Efekty i brak gwarancji:</strong> Zostałam/em
                      poinformowana/y, że efekt końcowy zależy od indywidualnych
                      cech organizmu (biochemii, rodzaju skóry, plastyczności
                      tkanek, kształtu anatomicznego) oraz ilości użytego
                      preparatu (np. różnica przy użyciu 1 ml jest zależna od
                      wielkości obszaru zabiegowego). Przyjmuję do wiadomości,
                      że efekty zabiegu utrzymują się zazwyczaj od 1 miesiąca do
                      1 roku, co jest kwestią indywidualną. Rozumiem, że
                      medycyna estetyczna i kosmetologia nie są naukami
                      ścisłymi, w związku z czym nie udziela się gwarancji na
                      uzyskanie identycznego efektu jak u innych osób, ani na
                      100% zadowolenie z rezultatu estetycznego. Rozbieżność
                      między moimi oczekiwaniami a realnym rezultatem
                      (określonym przez Specjalistę) nie stanowi podstawy do
                      roszczeń.
                    </p>
                    <p>
                      <strong>Zalecenia pozabiegowe:</strong> Zobowiązuję się do
                      ścisłego przestrzegania zaleceń pozabiegowych, które
                      zostały mi przekazane i wyjaśnione. Mam świadomość, że
                      nieprzestrzeganie zaleceń (np. higieny, unikania pewnych
                      czynników) może prowadzić do poważnych powikłań, takich
                      jak zakażenia, przemieszczenie preparatu czy powstanie
                      blizn, za co Specjalista nie ponosi odpowiedzialności.
                    </p>
                    <p>
                      <strong>Kwalifikacje wykonującego:</strong> Oświadczam, że
                      mam pełną świadomość, iż Specjalista wykonujący zabieg nie
                      jest lekarzem medycyny, ale posiada odpowiednie
                      przeszkolenie i doświadczenie w zakresie wykonywanych
                      zabiegów estetycznych. Akceptuję ten fakt.
                    </p>
                    <p className="mt-4 font-medium text-brand">
                      * W przypadku osoby niepełnoletniej wymagany jest podpis
                      rodzica lub opiekuna prawnego.
                    </p>
                  </div>
                </div>

                {/* Podpis pod Zabiegiem (Nowy, obowiązkowy) */}
                <div className="bg-gradient-emerald rounded-2xl border border-[#D4AF37] shadow-lg p-6 md:p-8 mt-8">
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
                  className="text-brand hover:text-brand-light px-6 py-3 font-medium transition-colors"
                >
                  ← Wróć do RODO
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep("MARKETING")}
                  disabled={!formData.podpisDane}
                  className="bg-brand text-black py-3 px-8 rounded-xl text-lg font-bold shadow-lg hover:bg-brand-dark hover:text-brand disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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
                    7
                  </span>
                  Zgody Dodatkowe
                </h3>
                <p className="text-sm text-ui-textSecondary mb-6">
                  Poniższe zgody są <strong>opcjonalne</strong>.
                </p>

                {/* Zgoda na marketing */}
                <div className="bg-ui-bg rounded-xl shadow-sm overflow-hidden border border-[#D4AF37] hover:border-brand transition-colors">
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
                <div className="bg-ui-bg rounded-xl shadow-sm overflow-hidden border border-[#D4AF37] hover:border-brand transition-colors">
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
                        className="w-full px-4 py-2 bg-gradient-emerald border-b border-[#D4AF37] focus:border-brand outline-none text-sm transition-colors text-marble-text placeholder-marble-textSecondary"
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
                  className="text-brand hover:text-brand-light px-6 py-3 font-medium transition-colors"
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
