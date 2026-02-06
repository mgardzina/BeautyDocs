import { useState, useEffect } from "react";
import {
  Phone,
  Check,
  ArrowLeft,
  Instagram,
  Mail,
  Shield,
  CheckCircle2,
  X,
} from "lucide-react";
import { isAdult, getTodayDate } from "@/lib/dateUtils";
import SignaturePad from "@/components/SignaturePad";
import SignatureVerificationModal from "@/components/SignatureVerificationModal";
import { AuditLogData } from "@/app/actions/otp";
import Footer from "@/app/components/Footer";
import {
  ConsentFormData,
  ContraindicationWithFollowUp,
  rodoInfo,
  mezoterapiaIglowaContraindications,
  mezoterapiaIglowaCategoryBreaks,
  mezoterapiaIglowaNaturalReactions,
  mezoterapiaIglowaComplications,
  mezoterapiaIglowaComplicationsVeryRare,
  mezoterapiaIglowaPostCare,
} from "../../../types/booking";
import { SALON_CONFIG } from "@/app/config/salon";

interface NeedleMesotherapyFormProps {
  onBack: () => void;
}

const initialFormData: ConsentFormData = {
  type: "NEEDLE_MESOTHERAPY",
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
  przeciwwskazania: Object.entries(mezoterapiaIglowaContraindications).reduce(
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

export default function NeedleMesotherapyForm({
  onBack,
}: NeedleMesotherapyFormProps) {
  const [formData, setFormData] = useState<ConsentFormData>(initialFormData);
  const [email, setEmail] = useState("");
  const [birthDateError, setBirthDateError] = useState<string | null>(null);
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

  const contraindicationKeys = Object.keys(mezoterapiaIglowaContraindications);
  const currentContraindicationKey =
    contraindicationKeys[currentContraindicationIndex];

  const currentContraindicationValue = mezoterapiaIglowaContraindications[
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
    const currentValue =
      mezoterapiaIglowaContraindications[currentContraindicationKey];
    const hasFollowUp =
      typeof currentValue === "object" && currentValue.hasFollowUp;
    if (hasFollowUp) {
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

  const formatBirthDate = (value: string): string => {
    const digits = value.replace(/\D/g, "").slice(0, 8);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
    return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`;
  };

  const handleBirthDateChange = (value: string) => {
    const formatted = formatBirthDate(value);
    setFormData((prev) => ({ ...prev, dataUrodzenia: formatted }));

    // Validate age if full date is entered
    if (formatted.length === 10) {
      if (!isAdult(formatted)) {
        setBirthDateError(
          "Musisz być osobą pełnoletnią, aby wypełnić formularz.",
        );
      } else {
        setBirthDateError(null);
      }
    } else {
      setBirthDateError(null);
    }
  };

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
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="bg-gradient-emerald backdrop-blur-sm rounded-3xl shadow-2xl border border-[#D4AF37] p-12 max-w-lg text-center">
          <div className="w-20 h-20 bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check className="w-10 h-10 text-green-500" />
          </div>
          <h2 className="text-3xl font-serif text-white mb-4">Dziękujemy!</h2>
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
            <button
              onClick={onBack}
              className="text-brand px-8 py-2 hover:text-brand-light transition-colors"
            >
              Wróć do wyboru zabiegu
            </button>
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
    isWizardComplete &&
    !birthDateError;

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="bg-black/95 backdrop-blur-sm sticky top-0 z-50 border-b border-[#D4AF37]">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl md:text-2xl font-serif text-white tracking-wider uppercase">
            {SALON_CONFIG.name}
          </h1>
          <div className="flex items-center gap-4">
            <a
              href={`tel:${SALON_CONFIG.phone.replace(/\s/g, "")}`}
              className="text-white/80 hover:text-white transition-colors"
            >
              <Phone className="w-5 h-5" />
            </a>
            <a
              href={SALON_CONFIG.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/80 hover:text-white transition-colors"
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
            <button
              onClick={onBack}
              className="text-brand hover:text-white border border-brand hover:bg-brand px-4 py-2 rounded-lg transition-all font-medium self-start uppercase tracking-wider text-sm"
            >
              Powrót
            </button>
            <div className="flex gap-2 text-xs md:text-sm font-medium text-white/50 overflow-x-auto pb-2 md:pb-0">
              <span
                className={currentStep === "DATA" ? "text-brand font-bold" : ""}
              >
                1. Dane
              </span>
              <span>→</span>
              <span
                className={currentStep === "RODO" ? "text-brand font-bold" : ""}
              >
                2. RODO
              </span>
              <span>→</span>
              <span
                className={
                  currentStep === "RODO2" ? "text-brand font-bold" : ""
                }
              >
                3. RODO 2
              </span>
              <span>→</span>
              <span
                className={
                  currentStep === "TREATMENT" ? "text-brand font-bold" : ""
                }
              >
                4. Zabieg
              </span>
              <span>→</span>
              <span
                className={
                  currentStep === "MARKETING" ? "text-brand font-bold" : ""
                }
              >
                5. Zgody
              </span>
            </div>
          </div>

          <div className="text-center">
            <h1 className="text-3xl md:text-4xl font-serif text-white mb-2">
              Mezoterapia Igłowa
            </h1>
            <p className="text-brand text-lg font-light tracking-wide uppercase">
              Zabieg rewitalizacji i odżywiania skóry
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* KROK 1: DANE I WYWIAD */}
          {currentStep === "DATA" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Dane osobowe */}
              <section className="bg-gradient-emerald backdrop-blur-sm rounded-2xl shadow-lg p-6 md:p-8">
                <h2 className="text-2xl font-serif text-white mb-6 flex items-center gap-3">
                  <span className="w-8 h-8 bg-brand text-white rounded-full flex items-center justify-center text-sm font-sans">
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
                      className="w-full px-4 py-3 bg-ui-appBg border border-[#D4AF37] rounded-xl focus:border-brand focus:ring-2 focus:ring-brand/20 text-white placeholder-white/40 outline-none transition-all"
                      placeholder="Joanna Wielgos"
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
                      className="w-full px-4 py-3 bg-ui-appBg border border-[#D4AF37] rounded-xl focus:border-brand focus:ring-2 focus:ring-brand/20 text-white placeholder-white/40 outline-none transition-all"
                      placeholder={`${SALON_CONFIG.city}, 27.01.2026`}
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-ui-textSecondary mb-2 font-medium">
                      Adres E-mail
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-ui-appBg border border-[#D4AF37] rounded-xl focus:border-brand focus:ring-2 focus:ring-brand/20 text-white placeholder-white/40 outline-none transition-all"
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
                        className="w-full px-4 py-3 bg-ui-appBg border border-[#D4AF37] rounded-xl focus:border-brand focus:ring-2 focus:ring-brand/20 text-white placeholder-white/40 outline-none transition-all"
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
                        className="w-full px-4 py-3 bg-ui-appBg border border-[#D4AF37] rounded-xl focus:border-brand focus:ring-2 focus:ring-brand/20 text-white placeholder-white/40 outline-none transition-all"
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
                        className="w-full px-4 py-3 bg-ui-appBg border border-[#D4AF37] rounded-xl focus:border-brand focus:ring-2 focus:ring-brand/20 text-white placeholder-white/40 outline-none transition-all"
                        placeholder={SALON_CONFIG.city}
                        autoComplete="address-level2"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-ui-textSecondary mb-2 font-medium">
                      Data urodzenia
                    </label>
                    <input
                      type="text"
                      value={formData.dataUrodzenia}
                      onChange={(e) => handleBirthDateChange(e.target.value)}
                      className="w-full px-4 py-3 bg-ui-appBg border border-[#D4AF37] rounded-xl focus:border-brand focus:ring-2 focus:ring-brand/20 text-white placeholder-white/40 outline-none transition-all"
                      placeholder="DD.MM.RRRR"
                    />
                    {birthDateError && (
                      <div className="mt-2 flex items-center gap-2 text-red-500 text-sm animate-in fade-in slide-in-from-top-1">
                        <X className="w-4 h-4" />
                        <span>{birthDateError}</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm text-ui-textSecondary mb-2 font-medium">
                      Telefon * (do weryfikacji SMS)
                    </label>
                    <div className="flex">
                      <span className="inline-flex items-center px-4 py-3 bg-gradient-emerald border border-r-0 border-[#D4AF37] rounded-l-xl text-ui-textSecondary font-medium select-none">
                        +48
                      </span>
                      <input
                        type="tel"
                        required
                        value={formData.telefon}
                        onChange={(e) => handlePhoneChange(e.target.value)}
                        className="w-full px-4 py-3 bg-ui-appBg border border-[#D4AF37] rounded-r-xl focus:border-brand focus:ring-2 focus:ring-brand/20 text-white placeholder-white/40 outline-none transition-all"
                        placeholder="123 456 789"
                        maxLength={11}
                      />
                    </div>
                  </div>
                </div>
              </section>

              {/* Informacja o Zabiegu */}
              <section className="bg-gradient-emerald backdrop-blur-sm rounded-2xl shadow-lg p-6 md:p-8">
                <h2 className="text-2xl font-serif text-white mb-6 flex items-center gap-3">
                  <span className="w-8 h-8 bg-brand text-white rounded-full flex items-center justify-center text-sm font-sans">
                    2
                  </span>
                  Informacja o Zabiegu
                </h2>
                <div className="prose prose-sm max-w-none text-ui-textSecondary leading-relaxed space-y-4">
                  <p>
                    <strong>INFORMACJA O ZABIEGU</strong>
                    <br />
                    Zabieg mezoterapii igłowej polega na bezpośrednim podaniu
                    cienką igłą małych dawek substancji aktywnych śródskórnie w
                    miejsca, które zostaną poddane zabiegowi. Wstrzyknięcie
                    substancji do obszaru tkanki poddanej zabiegowi tworzy
                    depozyt, z którego substancja zostaje uwalniana stopniowo.
                  </p>
                  <p>
                    Wskazaniem do zabiegu są: przebarwienia, skóra zmęczona -
                    wymagająca rewitalizacji, łojotok, osłabienie włosów i
                    wypadanie włosów, łysienie, cellulit a także stosuje się w
                    profilaktyce przeciwstarzeniowej skóry oraz w usuwaniu
                    objawów starzenia się skóry związanych z wiekiem, ekspozycją
                    na słońce jak również paleniem tytoniu.
                  </p>
                  <div className="bg-gradient-emerald p-4 rounded-xl border border-[#D4AF37]/50 space-y-4">
                    <p>
                      <strong>Mezoterapia igłowa twarzy</strong> jest jednym z
                      najlepszych zabiegów, który skutecznie redukuje zmarszczki
                      mimiczne i chroni skórę przed negatywnym działaniem
                      czynników zewnętrznych występujących w środowisku. Do
                      mezoterapii twarzy najczęściej stosowane są preparaty na
                      bazie kwasu hialuronowego oraz witamin A, C, E a także
                      oraz czynnych substancji aktywnych.
                    </p>
                    <p>
                      <strong>Mezoterapia igłowa szyi i dekoltu</strong> - obok
                      twarzy - jest obszarem najczęściej poddawanym zabiegowi
                      mezoterapii. Poprawia elastyczność i odżywia skórę. W
                      miejscach, takich jak szyja czy dekolt, skóra szybko traci
                      blask, a po zabiegu jest nie tylko zregenerowana i
                      odmłodzona, ale też bardzo mocno nawilżona. Zmniejszone i
                      wygładzone zostają także zmarszczki i bruzdy.
                    </p>
                    <p>
                      <strong>Mezoterapia igłowa skóry głowy</strong> stosowana
                      jest jako profilaktyka i leczenie łysienia. Jej wykonanie
                      przywraca prawidłowe krążenie w skórze głowy, które
                      pobudza wzrost nowych mieszków włosowych. Szczególnie
                      polecana jest dla osób cierpiących na łysienie plackowate
                      oraz androgenowe.
                    </p>
                  </div>
                  <p>
                    Zabieg mezoterapii igłowej wykonywany jest z użyciem jednego
                    z wybranych produktów lub mieszanki produktów. Zabieg odbywa
                    się zawsze po wykluczeniu wszelkich przeciwwskazań do
                    wykonania zabiegu. W rozmowie określone zostają potrzeby i
                    oczekiwania od wykonania zabiegu mezoterapii igłowej.
                  </p>
                  <p>
                    Kolejnym etapem jest znieczulenie, które minimalizuje
                    dyskomfort podczas zabiegu. Próg bólu odczuwany jest
                    indywidualnie oraz uzależniony jest od rodzaju skóry.
                    Stosowane jest znieczulenie <strong>Lidokaina 9,6%</strong>.
                    Zastosowanie znieczulenia gwarantuje zminimalizowanie bólu,
                    który w większości przypadków określany jest, jako niemal
                    nie odczuwalny.
                  </p>
                  <p>
                    Czas trwania zabiegu zależny jest od cech indywidualnych
                    naskórka, ale średnio trwa ok. godziny. W celu uzyskania
                    optymalnego efektu utrzymującego się przez ok. 6–12 miesięcy
                    zaleca się wykonanie pełnej serii zabiegów, powtarzanych w
                    odstępach co 2–4 tygodnie. Zabieg mezoterapii igłowej nie
                    jest zabiegiem trwałym, dla podtrzymania efektu zaleca się
                    wykonywanie zabiegu przypominającego co 3–6 miesięcy.
                  </p>
                </div>
              </section>

              {/* Szczegóły Zabiegu */}
              <section className="bg-gradient-emerald backdrop-blur-sm rounded-2xl shadow-lg p-6 md:p-8">
                <h2 className="text-2xl font-serif text-white mb-6 flex items-center gap-3">
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
                            name: "Kwas hialuronowy Jetema - Vitten hydro plus",
                            desc: "Nawilżenie i rewitalizacja skóry.",
                          },
                          {
                            name: "Pink Glow",
                            desc: "Zaawansowana mezoterapia, odżywienie i blask.",
                          },
                          {
                            name: "Witaminy C",
                            desc: "Rozświetlenie, antyoksydacja i poprawa kolorytu.",
                          },
                        ].map((product) => {
                          const currentName = formData.nazwaProduktu || "";
                          // Check if base product name matches (ignoring volume suffix)
                          const baseName =
                            currentName.includes(" - ") &&
                            !product.name.includes(" - ")
                              ? currentName
                                  .split(" - ")
                                  .slice(0, -1)
                                  .join(" - ") // Handle "Product - Name - 1.0ml" case if product name has dash
                              : currentName.split(" - ")[0]; // Simple split for standard cases

                          // More robust check: does currentName start with product.name?
                          const isSelectedProduct = currentName.startsWith(
                            product.name,
                          );

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
                                  : "border-[#D4AF37] bg-ui-appBg hover:border-brand"
                              }`}
                            >
                              <div className="flex justify-between items-center mb-1">
                                <span
                                  className={`font-serif text-lg font-medium ${
                                    isSelectedProduct
                                      ? "text-white"
                                      : "text-white"
                                  }`}
                                >
                                  {product.name}
                                </span>
                                {isSelectedProduct && (
                                  <CheckCircle2 className="w-6 h-6 text-brand gold-glow-sm" />
                                )}
                              </div>
                              <p className="text-sm text-ui-textSecondary leading-relaxed mb-4">
                                {product.desc}
                              </p>

                              {/* Volume Selection inside Product Card */}
                              {isSelectedProduct && (
                                <div className="border-t border-[#D4AF37]/50 pt-3 animate-in fade-in slide-in-from-top-2 duration-300">
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
                                            e.stopPropagation();
                                            handleInputChange(
                                              "nazwaProduktu",
                                              `${product.name} - ${vol}ml`,
                                            );
                                          }}
                                          className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                                            isSelectedVolume
                                              ? "border-brand bg-brand text-white shadow-sm"
                                              : "border-[#D4AF37] bg-ui-appBg text-ui-textSecondary hover:border-brand hover:text-brand"
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

                  {/* Znieczulenie */}
                  <div>
                    <label className="block text-sm text-ui-textSecondary mb-2 font-medium">
                      Znieczulenie
                    </label>
                    <div className="space-y-4">
                      {/* Anesthesia Selection */}
                      <div className="flex flex-col gap-3">
                        <button
                          type="button"
                          className="text-left p-4 rounded-xl border-2 border-brand bg-brand/10 gold-glow transition-all group"
                        >
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-serif text-lg font-medium text-white">
                              Lidokaina 9,6%
                            </span>
                            <CheckCircle2 className="w-6 h-6 text-brand gold-glow-sm" />
                          </div>
                          <p className="text-sm text-ui-textSecondary leading-relaxed">
                            Znieczulenie miejscowe jest zawsze stosowane podczas
                            zabiegu.
                          </p>
                        </button>
                      </div>
                    </div>
                  </div>
                  {/* Obszar zabiegu */}
                  <div>
                    <label className="block text-sm text-ui-textSecondary mb-2 font-medium">
                      Obszar zabiegu
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
                      {[
                        "Twarz",
                        "Szyja",
                        "Dekolt",
                        "Okolice Oczu",
                        "Okolice Ud",
                        "Głowa",
                      ].map((area) => (
                        <button
                          key={area}
                          type="button"
                          onClick={() =>
                            handleInputChange("obszarZabiegu", area)
                          }
                          className={`py-3 px-4 rounded-xl border-2 transition-all font-medium text-sm ${
                            formData.obszarZabiegu === area
                              ? "border-brand bg-brand text-white"
                              : "border-[#D4AF37] bg-ui-appBg text-ui-textSecondary hover:border-brand hover:text-brand"
                          }`}
                        >
                          {area}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              <section className="bg-gradient-emerald backdrop-blur-sm rounded-2xl shadow-lg p-6 md:p-8">
                <h2 className="text-2xl font-serif text-white mb-6 flex items-center gap-3">
                  <span className="w-8 h-8 bg-brand text-white rounded-full flex items-center justify-center text-sm font-sans">
                    4
                  </span>
                  Wywiad Medyczny
                </h2>

                {/* Sekcja Wykaz Leki */}
                <div className="mb-8">
                  <label className="block text-sm font-bold text-white mb-3 uppercase tracking-wide">
                    PRZECIWSKAZANIA DO WYKONANIA ZABIEGU
                  </label>
                  <label className="block text-sm text-ui-textSecondary mb-2 font-medium">
                    Proszę wpisać wykaz wszystkich leków przyjmowanych w ciągu
                    ostatnich 6 miesięcy:
                  </label>
                  <textarea
                    value={formData.wykazLekow || ""}
                    onChange={(e) =>
                      handleInputChange("wykazLekow", e.target.value)
                    }
                    className="w-full h-24 px-4 py-3 bg-ui-appBg border border-[#D4AF37] rounded-xl focus:border-brand focus:ring-2 focus:ring-brand/20 text-white placeholder-white/40 outline-none transition-all resize-none"
                    placeholder="Wpisz nazwy leków..."
                  />
                </div>

                <p className="text-sm text-ui-textSecondary mb-6">
                  Czy posiadasz którekolwiek z poniższych przeciwwskazań?
                </p>

                {showContraindicationsWizard ? (
                  <div className="bg-gradient-emerald p-6 rounded-xl border border-[#D4AF37] max-w-2xl mx-auto shadow-sm animate-in slide-in-from-right-4 duration-300">
                    {/* Category Header */}

                    <div className="flex justify-between items-center mb-8">
                      <span className="text-sm font-medium text-brand">
                        Pytanie {currentContraindicationIndex + 1} z{" "}
                        {contraindicationKeys.length}
                      </span>
                      <div className="h-2 w-24 bg-ui-border rounded-full overflow-hidden">
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
                        <h3 className="text-xl md:text-2xl font-serif text-white leading-relaxed">
                          {typeof currentContraindicationValue === "string"
                            ? currentContraindicationValue
                            : currentContraindicationValue.text}
                        </h3>
                        {currentContraindicationObject?.hasFollowUp &&
                          formData.przeciwwskazania[
                            currentContraindicationKey
                          ] === true && (
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
                                className="w-full px-4 py-3 bg-ui-appBg border border-[#D4AF37] rounded-xl focus:border-brand focus:ring-2 focus:ring-brand/20 text-white placeholder-white/40 outline-none transition-all"
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
                            : "bg-ui-appBg border-[#D4AF37] text-ui-textSecondary active:border-green-500 active:bg-green-500 active:text-white md:hover:border-green-500 md:hover:bg-green-500 md:hover:text-white"
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
                            : "bg-ui-appBg border-[#D4AF37] text-ui-textSecondary active:border-red-500 active:bg-red-500 active:text-white md:hover:border-red-500 md:hover:bg-red-500 md:hover:text-white"
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
                        className="flex items-center gap-2 text-sm text-white/50 disabled:opacity-0 hover:text-brand transition-colors"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        Poprzednie
                      </button>
                      <span className="text-xs text-white/50 uppercase tracking-wider font-medium">
                        Krok {currentContraindicationIndex + 1}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-green-900/20 border border-green-900/50 rounded-xl mb-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-green-900/30 rounded-full flex items-center justify-center">
                          <Check className="w-5 h-5 text-green-500" />
                        </div>
                        <span className="text-green-400 font-medium">
                          Wywiad medyczny zakończony
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={resetWizard}
                        className="text-sm text-green-400 hover:text-green-300 font-medium underline"
                      >
                        Edytuj odpowiedzi
                      </button>
                    </div>

                    {Object.entries(mezoterapiaIglowaContraindications).map(
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

                {/* Inne schorzenia */}
                <div className="mt-8">
                  <label className="block text-sm text-ui-textSecondary mb-2 font-medium">
                    Inne schorzenia, proszę podać jakie:
                  </label>
                  <textarea
                    value={formData.inneSchorzenia || ""}
                    onChange={(e) =>
                      handleInputChange("inneSchorzenia", e.target.value)
                    }
                    className="w-full h-24 px-4 py-3 bg-ui-appBg border border-[#D4AF37] rounded-xl focus:border-brand focus:ring-2 focus:ring-brand/20 text-white placeholder-white/40 outline-none transition-all resize-none"
                    placeholder="Opisz inne schorzenia..."
                  />
                </div>
              </section>

              {/* Skutki Uboczne i Powikłania */}
              <section className="bg-gradient-emerald backdrop-blur-sm rounded-2xl shadow-lg p-6 md:p-8">
                <h2 className="text-2xl font-serif text-white mb-6 flex items-center gap-3">
                  <span className="w-8 h-8 bg-brand text-white rounded-full flex items-center justify-center text-sm font-sans">
                    5
                  </span>
                  Informacje o Skutkach Ubocznych i Powikłaniach
                </h2>

                <div className="space-y-6">
                  {/* Częste skutki uboczne */}
                  <div className="bg-gradient-emerald p-5 rounded-xl border border-[#D4AF37]/50">
                    <p className="text-sm font-medium text-white mb-3">
                      MOŻLIWE DO WYSTĄPIENIA REAKCJE PO PRZEPROWADZONYM ZABIEGU
                      - CZĘSTE
                    </p>
                    <p className="text-sm text-ui-textSecondary mb-3">
                      Zostałem/am poinformowany/a o przebiegu zabiegu i
                      możliwości naturalnego wystąpienia po zabiegu reakcji
                      organizmu:
                    </p>
                    <ul className="space-y-2 text-sm text-ui-textSecondary">
                      {mezoterapiaIglowaNaturalReactions.map(
                        (reaction, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <span className="text-brand">∙</span>
                            <span>{reaction}</span>
                          </li>
                        ),
                      )}
                    </ul>
                    <p className="text-sm font-bold text-brand mt-4">
                      UWAGA! Zabieg mezoterapii igłowej przeprowadzany w trakcie
                      menstruacji może być bardziej bolesny, ponieważ odczuwanie
                      bólu w tym czasie jest zwykle zwiększone.
                    </p>
                  </div>

                  {/* Rzadkie powikłania */}
                  <div className="bg-gradient-emerald p-5 rounded-xl border border-[#D4AF37]/50">
                    <p className="text-sm font-medium text-white mb-3">
                      MOŻLIWE POWIKŁANIA PO PRZEPROWADZONYM ZABIEGU – RZADKIE
                    </p>
                    <ul className="space-y-2 text-sm text-ui-textSecondary">
                      {mezoterapiaIglowaComplications.map(
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
                  <div className="bg-gradient-emerald p-5 rounded-xl border border-[#D4AF37]/50">
                    <p className="text-sm font-medium text-white mb-3">
                      MOŻLIWE POWIKŁANIA PO PRZEPROWADZONYM ZABIEGU – BARDZO
                      RZADKIE
                    </p>
                    <ul className="space-y-2 text-sm text-ui-textSecondary">
                      {mezoterapiaIglowaComplicationsVeryRare.map(
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

              {/* Zalecenia Pozabiegowe */}
              <section className="bg-gradient-emerald backdrop-blur-sm rounded-2xl shadow-lg p-6 md:p-8">
                <h2 className="text-2xl font-serif text-white mb-6 flex items-center gap-3">
                  <span className="w-8 h-8 bg-brand text-white rounded-full flex items-center justify-center text-sm font-sans">
                    6
                  </span>
                  Zalecenia Pozabiegowe
                </h2>

                <div className="bg-gradient-emerald p-5 rounded-xl border border-[#D4AF37]/50 mb-6">
                  <p className="text-sm text-ui-textSecondary leading-relaxed mb-4">
                    <strong>ZALECENIA PO PRZEPROWADZONYM ZABIEGU</strong>
                    <br />
                    Niniejszym oświadczam, że zostałam/em poinformowana o
                    konieczności stosowania się po przeprowadzonym zabiegu do
                    przestrzegania następujących zaleceń:
                  </p>
                  <ul className="space-y-2 text-sm text-ui-textSecondary">
                    {mezoterapiaIglowaPostCare.map((instruction, index) => (
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
              <section className="bg-gradient-emerald backdrop-blur-sm rounded-2xl shadow-lg overflow-hidden">
                <div className="p-6 md:p-8">
                  <h3 className="text-2xl font-serif text-white mb-6">
                    {rodoInfo.consentTitle}
                  </h3>
                  <div className="bg-gradient-emerald p-6 rounded-xl text-sm text-ui-textSecondary leading-relaxed whitespace-pre-line max-h-[60vh] overflow-y-auto mb-6 border border-[#D4AF37]">
                    {rodoInfo.consentText}
                  </div>
                  {/* Signature Area for RODO */}
                  <div className="mt-8">
                    <p className="text-sm text-ui-textSecondary mb-4 font-medium uppercase tracking-wide">
                      Podpis Klienta (Zgoda na przetwarzanie danych):
                    </p>
                    <div className="bg-ui-appBg rounded-xl overflow-hidden min-h-[200px] border border-[#D4AF37] p-1">
                      <SignaturePad
                        label=""
                        value={formData.podpisRodo || ""}
                        onChange={(sig) => {
                          handleInputChange("podpisRodo", sig);
                          // Auto-approve RODO consent when signed
                          if (sig && !formData.zgodaPrzetwarzanieDanych) {
                            handleInputChange("zgodaPrzetwarzanieDanych", true);
                          }
                        }}
                        date={formData.miejscowoscData}
                        hasBorder={false}
                      />
                    </div>
                  </div>
                </div>
              </section>

              <div className="flex justify-between pt-4 pb-12">
                <button
                  type="button"
                  onClick={() => setCurrentStep("DATA")}
                  className="text-brand hover:text-white px-6 py-3 font-medium transition-colors"
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
              <section className="bg-gradient-emerald backdrop-blur-sm rounded-2xl shadow-lg overflow-hidden">
                <div className="p-6 md:p-8">
                  <h3 className="text-2xl font-serif text-white mb-6">
                    {rodoInfo.clauseTitle}
                  </h3>
                  <div className="bg-gradient-emerald p-6 rounded-xl text-sm text-ui-textSecondary leading-relaxed whitespace-pre-line max-h-[60vh] overflow-y-auto mb-6 border border-[#D4AF37]">
                    {rodoInfo.clauseText}
                  </div>
                  {/* Signature Area for RODO 2 */}
                  <div className="mt-8">
                    <p className="text-sm text-ui-textSecondary mb-4 font-medium uppercase tracking-wide">
                      Podpis Klienta (Klauzula informacyjna):
                    </p>
                    <div className="bg-ui-appBg rounded-xl overflow-hidden min-h-[200px] border border-[#D4AF37] p-1">
                      <SignaturePad
                        label=""
                        value={formData.podpisRodo2 || ""}
                        onChange={(sig) => {
                          handleInputChange("podpisRodo2", sig);
                        }}
                        date={formData.miejscowoscData}
                        hasBorder={false}
                      />
                    </div>
                    <p className="text-xs text-white/50 mt-3 italic">
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
                  className="text-brand hover:text-white px-6 py-3 font-medium transition-colors"
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
              <section className="bg-gradient-emerald backdrop-blur-sm rounded-2xl shadow-lg">
                <div className="p-6 md:p-8">
                  <h3 className="text-2xl font-serif text-white mb-6 border-b border-[#D4AF37] pb-2">
                    Świadomość Ryzyka
                  </h3>
                  <p className="text-sm text-ui-textSecondary mb-4">
                    Zostałam/em poinformowana/y o przebiegu zabiegu i możliwości
                    naturalnego wystąpienia ryzyka:
                  </p>

                  <div className="space-y-6">
                    <div className="bg-gradient-emerald p-5 rounded-xl border border-[#D4AF37]/50">
                      <p className="text-sm font-medium text-white mb-3">
                        Możliwe naturalne reakcje:
                      </p>
                      <ul className="space-y-2 text-sm text-ui-textSecondary">
                        {mezoterapiaIglowaNaturalReactions.map(
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
                      <p className="text-sm font-medium text-white mb-3">
                        Możliwe powikłania:
                      </p>
                      <div className="space-y-3 text-sm text-ui-textSecondary">
                        <p>
                          <span className="font-medium">Powikłania:</span>{" "}
                          {mezoterapiaIglowaComplications.join(", ")}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Zalecenia Hyaluronic */}
              <section className="bg-gradient-emerald backdrop-blur-sm rounded-2xl shadow-lg">
                <div className="p-6 md:p-8">
                  <h3 className="text-2xl font-serif text-white mb-6 border-b border-[#D4AF37] pb-2">
                    Zobowiązania Pozabiegowe
                  </h3>
                  <p className="text-sm text-ui-textSecondary mb-4">
                    Zobowiązuję się do przestrzegania następujących zaleceń:
                  </p>
                  <ul className="space-y-2 text-ui-textSecondary text-sm bg-ui-appBg/50 p-4 rounded-xl border border-[#D4AF37]/30">
                    {mezoterapiaIglowaPostCare.map((instruction, index) => (
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

              {/* Regulamin Salonu */}
              <section className="bg-gradient-emerald backdrop-blur-sm rounded-2xl shadow-lg">
                <div className="p-6 md:p-8">
                  <h3 className="text-2xl font-serif text-white mb-6 border-b border-[#D4AF37] pb-2">
                    Regulamin Salonu
                  </h3>
                  <p className="text-sm text-ui-textSecondary mb-4 font-medium">
                    Jestem świadoma poniższych zasad, wynikających z regulaminu
                    Salonu:
                  </p>
                  <ol className="list-decimal pl-5 space-y-3 text-sm text-ui-textSecondary leading-relaxed">
                    <li>
                      Dokonanie zapisu na zabieg oznacza pełną akceptację
                      regulaminu oraz wymienione poniżej zasady.
                    </li>
                    <li>
                      Przy rezerwacji terminu na makijaż permanentny wymagana
                      jest opłata (zadatek) w wysokości 50% wartości zabiegu.
                    </li>
                    <li>
                      Na uregulowanie zadatku Klient/ka ma 3 dni od momentu
                      zapisu. Jeśli tego nie zrobi rezerwacja zostaje
                      automatycznie anulowana, a zarezerwowany dotychczas termin
                      staje się dostępny dla innych Klientów.
                    </li>
                    <li>
                      Jeżeli zabieg się odbędzie, to jego cena pomniejszona jest
                      o wartość zadatku.
                    </li>
                    <li>
                      Zadatek można uregulować przelewem na konto bankowe. Numer
                      konta dostępny jest na stronie www, na miejscu, po
                      kontakcie telefonicznym lub na FB:{" "}
                      <span className="font-medium text-white">
                        NUMER KONTA 76249000050000460039252048
                      </span>{" "}
                      — w tytule przelewu należy wpisać datę zabiegu oraz imię i
                      nazwisko Klienta.
                    </li>
                    <li>
                      Rezerwując termin warto jest się upewnić, że nie ma
                      żadnych przeciwwskazań do wykonania zabiegu.
                    </li>
                    <li>
                      Konsultacja dotycząca wykonania zabiegu makijażu
                      permanentnego jest zawsze bezpłatna. Jeśli masz
                      jakiekolwiek wątpliwości dotyczące zabiegu umów się
                      telefonicznie na bezpłatną konsultację.
                    </li>
                    <li>
                      Klientka ma prawo odwołać wizytę na 3 dni przed planowanym
                      terminem. Jeśli odwołanie wizyty odbędzie się w terminie
                      krótszym niż 3 dni przed planowanym zabiegiem wówczas
                      Klient zobowiązuje się na swoje miejsce znaleźć inną
                      osobę. Jeśli na zarezerwowaną wizytę nie znajdzie się
                      osoba chętna wówczas przedpłata przepada.
                    </li>
                    <li>
                      Klientka ma prawo do zmiany terminu wizyty najpóźniej na
                      24h przed planowaną wizytą, rezygnacja z terminu w
                      ostatniej chwili tj. tego samego dnia skutkuje wpisaniem
                      Klientki na naszą „Czarną listę&quot;. Rozumiemy sytuacje
                      wyjątkowe i przypadki losowe (należy je potwierdzić np.
                      zwolnieniem lekarskim).
                    </li>
                    <li>
                      Klientki, które miały kiedykolwiek wykonywany makijaż
                      permanentny na danym obszarze (nawet mało widoczny) są
                      zobowiązane przy zapisie powiadomić o tym fakcie recepcję,
                      ponieważ zdarza się, że zabieg makijażu permanentnego
                      powinien zostać poprzedzony laserowym usuwaniem śladów po
                      starym, a to wymaga innego czasu oraz sprzętu.
                    </li>
                    <li>
                      Podczas zabiegu makijażu permanentnego wykonywana jest
                      wizualizacja i wybierana jest odpowiednia metoda makijażu
                      permanentnego. Rodzaj metody oraz pigmenty wybierane są
                      przez linergistkę i dopasowane do naturalnej urody
                      Klientki.
                    </li>
                    <li>
                      Linergistka ma prawo do odmowy wykonania usługi, jeżeli
                      oczekiwania Klientki co do kształtu są niezgodne z
                      klasycznym układem brwi.
                    </li>
                    <li>
                      Decydując się na zabieg należy zapoznać się z pracami,
                      stylem i techniką linergistek w Salonie.
                    </li>
                    <li>
                      W przypadku, gdy Klientka nie akceptuje proponowanego
                      kształtu, metody i koloru pigmentu oraz decyduje o
                      rezygnacji z pigmentacji podczas wizyty — zadatek nie jest
                      zwracany.
                    </li>
                    <li>
                      Jeżeli Klientka, która skorzystała z usługi makijażu
                      permanentnego w naszym salonie ma uwagi co do
                      koloru/kształtu itp. to w ciągu 2 miesięcy od wykonania
                      może je do nas zgłosić (i zostaną one bezpłatnie
                      skorygowane), natomiast wszelkie sugestie po upływie 2
                      miesięcy od zabiegu będą wyceniane indywidualnie.
                    </li>
                    <li>
                      Jeśli Klientka ma umówioną darmową korektę przysługującą w
                      ciągu 50 dni od daty zabiegu makijażu i na tę wizytę nie
                      przyjdzie/nie odwoła na 24 godz. to uważa się ją za odbytą
                      i kolejna umówiona korekta jest już płatna — dokładną cenę
                      usługi w tej sytuacji ustala linergistka podczas wizyty.
                      Każdy 1 miesiąc opóźnienia to dodatkowa opłata 100 zł.
                    </li>
                    <li>
                      Jeżeli Klientka jest z zagranicy i nie może odbyć korekty
                      w ciągu 50 dni od daty pierwszego zabiegu, to istnieje
                      możliwość wydłużenia umownego okresu do 3 miesięcy po
                      pierwszej pigmentacji, należy jednak zgłosić fakt
                      przebywania za granicą linergistce, która zanotuje
                      informacje w systemie i tylko na tej podstawie okres
                      korekty wydłuża się. Jeśli Klientka nie zgłosi się w
                      terminie 3 miesięcy od dnia pierwszej wizyty na korektę
                      makijażu, to po tym czasie korekta jest już płatna. Cenę
                      ustala linergistka podczas wizyty.
                    </li>
                    <li>
                      Jeżeli Klientka, która wykonywała zabieg makijażu
                      permanentnego brwi w naszym Salonie po zabiegu dowiaduje
                      się o ciąży i odkłada korektę makijażu do okresu po
                      porodzie, i chce dokonać korekty np. po ok. roku to
                      wówczas cena zabiegu to 50% aktualnej ceny makijażu
                      permanentnego.
                    </li>
                    <li>
                      Makijaż permanentny zmienia swoją intensywność w kolejnych
                      miesiącach po zabiegu dlatego po roku zaleca się wykonanie
                      korekty płatnej, której koszt zgodnie z cennikiem to 50%
                      aktualnej ceny makijażu permanentnego. Jeżeli natomiast
                      będzie potrzebna dodatkowa pigmentacja jej koszt to 200zł.
                      Korekta po upływie min. 2 latach od ostatniego zabiegu
                      makijażu permanentnego to koszt 100% aktualnej ceny lub w
                      wyjątkowych sytuacjach wycena indywidualna.
                    </li>
                    <li>
                      Korekty makijażu permanentnego po innych salonach są
                      zawsze wyceniane indywidualnie i zwykle traktowane jako
                      usługa wykonywana od początku + koszt usuwania laserem
                      wyceniany jest indywidualnie.
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
                    <li>
                      Korekta po około roku dotyczy głównie makijażu
                      permanentnego brwi, ponieważ pigment w innych częściach
                      utrzymuje się dłużej w związku z tym np. usta po roku są
                      wyraźnie zabarwione i nie wymagają korekty. Brwi natomiast
                      znajdują się w strefie T, co skutkuje szybszym
                      wypłukiwaniem barwnika.
                    </li>
                  </ol>
                </div>
              </section>

              {/* Oświadczenia */}
              <section className="bg-gradient-emerald backdrop-blur-sm rounded-2xl shadow-lg p-6 md:p-8">
                <h3 className="text-2xl font-serif text-white mb-6 border-b border-[#D4AF37] pb-2">
                  Oświadczenia
                </h3>
                <div className="bg-gradient-emerald p-5 rounded-xl mb-6 border border-[#D4AF37]/50">
                  <h4 className="font-serif text-white text-lg mb-4">
                    OŚWIADCZENIE I ŚWIADOMA ZGODA NA ZABIEG MEZOTERAPII IGŁOWEJ
                  </h4>
                  <p className="text-sm text-ui-textSecondary mb-4">
                    Ja, niżej podpisana/y, po przeprowadzeniu szczegółowego
                    wywiadu i konsultacji ze Specjalistą, oświadczam, że:
                  </p>

                  <div className="space-y-4 text-sm text-ui-textSecondary leading-relaxed">
                    <p>
                      <strong>Stan zdrowia i odpowiedzialność:</strong>{" "}
                      Specjalista poinformował mnie o przeciwwskazaniach do
                      zabiegu. Oświadczam, że nie występują u mnie żadne z nich
                      (m.in. ciąża, cukrzyca, choroby krwi, aktywne infekcje).
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
                      mezoterapii igłowej, techniki jego wykonania oraz celu.
                      Miałam/em możliwość zadawania pytań i uzyskałam/em na nie
                      jasne odpowiedzi.
                    </p>
                    <p>
                      Potwierdzam, że materiały użyte do zabiegu (igły,
                      strzykawki) są sterylne, jednorazowe i zostały otwarte w
                      mojej obecności. W Salonie zachowane są najwyższe normy
                      higieniczne.
                    </p>

                    <p>
                      <strong>Przebieg i rekonwalescencja:</strong> Zostałam/em
                      poinformowana/y, że po zabiegu naturalnym objawem jest
                      opuchlizna i zaczerwienienie skóry, które ustępują
                      zazwyczaj w ciągu 3-4 dni, w zależności od trybu życia.
                      Mogą również pojawić się drobne sińce i krwiaki w
                      miejscach wkłuć.
                    </p>
                    <p>
                      Wiem, że mogę powrócić do codziennych czynności po
                      zabiegu, jednak zobowiązuję się do ograniczenia stosowania
                      makijażu i drażniących kosmetyków przez 24 godziny.
                    </p>

                    <p>
                      <strong>Częstotliwość i trwałość efektów:</strong>{" "}
                      Poinformowano mnie, że czas trwania zabiegu zależy od
                      obszaru i cech naskórka (średnio ok. 1h).
                    </p>
                    <p>
                      W celu uzyskania optymalnego efektu utrzymującego się
                      przez ok. 6–12 miesięcy, zaleca się wykonanie pełnej serii
                      zabiegów (zazwyczaj 3 do 6 powtórzeń), w odstępach co 2–4
                      tygodnie.
                    </p>
                    <p>
                      Rozumiem, że zabieg mezoterapii nie jest zabiegiem trwałym
                      i dla podtrzymania efektu zaleca się wykonywanie zabiegu
                      przypominającego co 3–6 miesięcy.
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
                      mam świadomość, iż Specjalista wykonujący zabieg nie jest
                      lekarzem medycyny estetycznej, ale posiada bogate
                      doświadczenie i przeszkolenie w zakresie wykonywanych
                      zabiegów.
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

                {/* Podpis pod Zabiegiem (Nowy, obowiązkowy) */}
                <div className="bg-gradient-emerald backdrop-blur-sm rounded-2xl shadow-lg p-6 md:p-8 mt-8">
                  <h3 className="text-xl font-serif text-white mb-4 border-b border-[#D4AF37] pb-2">
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
                  className="text-brand hover:text-white px-6 py-3 font-medium transition-colors"
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
              <section className="bg-gradient-emerald backdrop-blur-sm rounded-2xl shadow-lg p-6 md:p-8">
                <h3 className="text-2xl font-serif text-white mb-6 flex items-center gap-3">
                  <span className="w-8 h-8 bg-brand text-white rounded-full flex items-center justify-center text-sm font-sans">
                    7
                  </span>
                  Zgody Dodatkowe
                </h3>
                <p className="text-sm text-ui-textSecondary mb-6">
                  Poniższe zgody są <strong>opcjonalne</strong>.
                </p>

                {/* Zgoda na marketing */}
                <div className="bg-gradient-emerald backdrop-blur-sm rounded-xl shadow-sm overflow-hidden border border-[#D4AF37] hover:shadow-md transition-shadow">
                  <div className="p-6">
                    <h4 className="font-serif text-white text-lg mb-3">
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
                <div className="bg-gradient-emerald backdrop-blur-sm rounded-xl shadow-sm overflow-hidden border border-[#D4AF37] hover:shadow-md transition-shadow">
                  <div className="p-6">
                    <h4 className="font-serif text-white text-lg mb-3">
                      Zgoda na Wykorzystanie Wizerunku
                    </h4>
                    <p className="text-sm text-ui-textSecondary leading-relaxed mb-4">
                      Wyrażam nieodpłatną zgodę na utrwalenie i
                      rozpowszechnianie mojego wizerunku (zdjęcia/video efektów
                      zabiegu) w celach promocyjnych salonu Royal Lips.
                    </p>

                    <div className="mb-6">
                      <label className="block text-xs uppercase tracking-wider text-white/50 mb-2 font-medium">
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
                        className="w-full px-4 py-2 bg-gradient-emerald border-b border-[#D4AF37] focus:border-brand outline-none text-sm transition-colors text-white"
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
                  className="text-brand hover:text-white px-6 py-3 font-medium transition-colors"
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
