import { useState, useEffect } from "react";
import { Phone, Check, ArrowLeft, Instagram, Mail, Shield } from "lucide-react";
import { getTodayDate } from "@/lib/dateUtils";
import SignaturePad from "@/components/SignaturePad";
import SignatureVerificationModal from "@/components/SignatureVerificationModal";
import { AuditLogData } from "@/app/actions/otp";
import Footer from "@/app/components/Footer";
import AnatomyFaceSelector from "../AnatomyFaceSelector";
import BackButton from "../BackButton";
import { SALON_CONFIG } from "@/app/config/salon";
import {
  ConsentFormData,
  ContraindicationWithFollowUp,
  wolumetriaTwarzyContraindications,
  wolumetriaTwarzyNaturalReactions,
  wolumetriaTwarzyComplications,
  wolumetriaTwarzyPostCare,
  rodoInfo,
} from "../../../types/booking";

interface FacialVolumetryFormProps {
  onBack: () => void;
}

const initialFormData: ConsentFormData = {
  type: "FACIAL_VOLUMETRY",
  imieNazwisko: "",
  ulica: "",
  kodPocztowy: "",
  miasto: SALON_CONFIG.city,
  pesel: "",
  telefon: "",
  miejscowoscData: `${SALON_CONFIG.city}, ${getTodayDate()}`,
  osobaPrzeprowadzajacaZabieg: "",
  nazwaProduktu: "",
  obszarZabiegu: "",
  celEfektu: "",
  numerZabiegu: "",
  przeciwwskazania: Object.entries(wolumetriaTwarzyContraindications).reduce(
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

export default function FacialVolumetryForm({
  onBack,
}: FacialVolumetryFormProps) {
  const [formData, setFormData] = useState<ConsentFormData>(initialFormData);
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [currentContraindicationIndex, setCurrentContraindicationIndex] =
    useState(0);
  const [showContraindicationsWizard, setShowContraindicationsWizard] =
    useState(true);
  const [isWizardComplete, setIsWizardComplete] = useState(false);

  // Form Steps: DATA -> SMS -> RODO -> TREATMENT -> MARKETING
  type Step = "DATA" | "RODO" | "RODO2" | "TREATMENT" | "MARKETING";
  const [currentStep, setCurrentStep] = useState<Step>("DATA");

  // Digital Signature State
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [isSignatureVerified, setIsSignatureVerified] = useState(false);
  const [auditLog, setAuditLog] = useState<AuditLogData | null>(null);

  const contraindicationKeys = Object.keys(wolumetriaTwarzyContraindications);
  const currentContraindicationKey =
    contraindicationKeys[currentContraindicationIndex];
  const currentContraindicationValue =
    wolumetriaTwarzyContraindications[currentContraindicationKey];
  const currentContraindicationObject:
    | ContraindicationWithFollowUp
    | undefined =
    typeof currentContraindicationValue === "string"
      ? undefined
      : currentContraindicationValue;

  // Calculate next potential question index (skipping completed wizard steps)
  const getNextIncompleteIndex = () => {
    // If wizard not started or just starting
    if (currentContraindicationIndex === -1) return 0;

    // Check from current index onwards
    for (
      let i = currentContraindicationIndex;
      i < contraindicationKeys.length;
      i++
    ) {
      const key = contraindicationKeys[i];
      // If this key hasn't been answered yet (is null or undefined)
      if (
        formData.przeciwwskazania[key] === undefined ||
        formData.przeciwwskazania[key] === null
      ) {
        return i;
      }
    }
    return -1; // All done
  };

  // Update wizard completion status
  // REMOVED: Auto-completion effect caused premature closing on last question follow-up
  // useEffect(() => {
  //   const isComplete = contraindicationKeys.every(
  //     (key) =>
  //       formData.przeciwwskazania[key] !== undefined &&
  //       formData.przeciwwskazania[key] !== null,
  //   );
  //   setIsWizardComplete(isComplete);
  // }, [formData.przeciwwskazania, contraindicationKeys]);

  // Scroll to top on step change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [currentStep]);

  const handleWizardAnswer = (value: boolean) => {
    handleContraindicationChange(currentContraindicationKey, value);

    // If answer is YES and has follow-up, stay on step to allow input
    const hasFollowUp =
      typeof currentContraindicationObject === "object" &&
      currentContraindicationObject?.hasFollowUp;

    if (value === true && hasFollowUp) {
      return;
    }

    if (currentContraindicationIndex < contraindicationKeys.length - 1) {
      setCurrentContraindicationIndex((prev) => prev + 1);
    } else {
      setIsWizardComplete(true);
    }
  };

  const handleNextStep = () => {
    if (currentContraindicationIndex < contraindicationKeys.length - 1) {
      setCurrentContraindicationIndex((prev) => prev + 1);
    } else {
      setIsWizardComplete(true);
    }
  };

  const resetWizard = () => {
    // Clear all contraindication answers
    setFormData((prev) => ({
      ...prev,
      przeciwwskazania: {},
    }));
    setCurrentContraindicationIndex(0);
    setShowContraindicationsWizard(true);
    setIsWizardComplete(false);
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

  const handlePeselChange = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    setFormData((prev) => ({ ...prev, pesel: digits }));
  };

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
      pesel: formData.pesel,
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
    formData.pesel &&
    formData.pesel.length === 11 &&
    isWizardComplete;

  return (
    <div className="min-h-screen bg-ui-bg text-white selection:bg-brand/30">
      {/* Header */}
      <header className="bg-ui-bgSecondary/80 backdrop-blur-md sticky top-0 z-50 border-b border-brand shadow-lg">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h1 className="text-xl md:text-2xl font-serif text-white tracking-wider uppercase">
              {SALON_CONFIG.name}
            </h1>
          </div>
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
            <BackButton onClick={onBack} className="self-start" />
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
                  currentStep === "TREATMENT" ? "text-brand font-bold" : ""
                }
              >
                3. Zabieg
              </span>
              <span>→</span>
              <span
                className={
                  currentStep === "MARKETING" ? "text-brand font-bold" : ""
                }
              >
                4. Zgody
              </span>
            </div>
          </div>

          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-serif text-white mb-3 tracking-tight">
              Wypełnianie{" "}
              <span className="text-brand">Kwasem Hialuronowym</span>
            </h1>
            <div className="flex items-center justify-center gap-4">
              <div className="h-px w-12 bg-brand"></div>
              <p className="text-brand text-sm md:text-lg font-light tracking-[0.3em] uppercase drop-shadow-sm">
                Kwas Hialuronowy / Stymulatory Tkankowe
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
              <section className="bg-gradient-emerald rounded-2xl border border-[#D4AF37] p-6 md:p-8 gold-glow-sm">
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
                      className="w-full px-4 py-3 bg-ui-bg border border-[#D4AF37] rounded-xl focus:border-brand focus:ring-2 focus:ring-brand/20 text-white placeholder-white/40 outline-none transition-all"
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
                      className="w-full px-4 py-3 bg-ui-bg border border-[#D4AF37] rounded-xl focus:border-brand focus:ring-2 focus:ring-brand/20 text-white placeholder-white/40 outline-none transition-all"
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
                        className="w-full pl-12 pr-4 py-3 bg-ui-bg border border-[#D4AF37] rounded-xl focus:border-brand focus:ring-2 focus:ring-brand/20 text-white placeholder-white/40 outline-none transition-all"
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
                        className="w-full px-4 py-3 bg-ui-bg border border-[#D4AF37] rounded-xl focus:border-brand focus:ring-2 focus:ring-brand/20 text-white placeholder-white/40 outline-none transition-all"
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
                        className="w-full px-4 py-3 bg-ui-bg border border-[#D4AF37] rounded-xl focus:border-brand focus:ring-2 focus:ring-brand/20 text-white placeholder-white/40 outline-none transition-all"
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
                        className="w-full px-4 py-3 bg-ui-bg border border-[#D4AF37] rounded-xl focus:border-brand focus:ring-2 focus:ring-brand/20 text-white placeholder-white/40 outline-none transition-all"
                        placeholder={SALON_CONFIG.city}
                        autoComplete="address-level2"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-ui-textSecondary mb-2 font-medium">
                      PESEL *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.pesel}
                      onChange={(e) => handlePeselChange(e.target.value)}
                      className="w-full px-4 py-3 bg-ui-bg border border-[#D4AF37] rounded-xl focus:border-brand focus:ring-2 focus:ring-brand/20 text-white placeholder-white/40 outline-none transition-all"
                      placeholder="np. 85010112345"
                      maxLength={11}
                    />
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
                        className="w-full px-4 py-3 bg-ui-bg border border-[#D4AF37] rounded-r-xl focus:border-brand focus:ring-2 focus:ring-brand/20 text-white placeholder-white/40 outline-none transition-all"
                        placeholder="123 456 789"
                        maxLength={11}
                      />
                    </div>
                  </div>
                </div>
              </section>

              {/* Informacja o Zabiegu */}
              <section className="bg-gradient-emerald rounded-2xl border border-[#D4AF37] p-6 md:p-8 gold-glow-sm">
                <h2 className="text-2xl font-serif text-white mb-6 flex items-center gap-3">
                  <span className="w-8 h-8 bg-brand text-white rounded-full flex items-center justify-center text-sm font-sans">
                    2
                  </span>
                  Informacja o Zabiegu
                </h2>
                <div className="prose prose-sm max-w-none text-ui-textSecondary leading-relaxed space-y-4">
                  <p>
                    Wolumetria twarzy to zabieg medycyny estetycznej, którego
                    celem jest przywrócenie lub poprawa objętości tkanek
                    miękkich twarzy, modelowanie konturów oraz redukcja oznak
                    starzenia się, takich jak utrata jędrności i opadanie owalu.
                    Zabieg wykonywany jest przy użyciu kwasu hialuronowego lub
                    stymulatorów tkankowych. Jest to zabieg inwazyjny, związany
                    z przerwaniem ciągłości naskórka, dlatego nie jest
                    pozbawiony ryzyka.
                  </p>
                  <p>
                    Zabieg wykonywany jest przy użyciu produktów takich jak:
                    Stylage L, Stylage XL (kwas hialuronowy) lub Neauvia
                    Stimulate, Radiesse (stymulatory tkankowe). Wybór preparatu
                    zależy od indywidualnych potrzeb klienta i oczekiwanych
                    efektów.
                  </p>
                  <p>
                    Zabieg odbywa się zawsze po wykluczeniu wszelkich
                    przeciwwskazań. W rozmowie z Klientem określane są potrzeby
                    i oczekiwania, a specjalista dobiera odpowiedni preparat i
                    jego ilość.
                  </p>
                  <p>
                    Kolejnym etapem jest znieczulenie, które minimalizuje
                    dyskomfort podczas zabiegu. Próg bólu odczuwany jest
                    indywidualnie. Zastosowanie znieczulenia gwarantuje
                    zminimalizowanie bólu. Czas zabiegu zależny jest od obszaru
                    aplikacji oraz cech indywidualnych skóry, ale średnio trwa
                    około godziny. Efekt końcowy widoczny jest po kilku dniach
                    (kwas hialuronowy) lub kilku tygodniach (stymulatory
                    tkankowe) od przeprowadzonego zabiegu.
                  </p>
                  <p>
                    Efekty zabiegu wolumetrii twarzy nie są trwałe. W przypadku
                    kwasu hialuronowego utrzymują się od 6 do 18 miesięcy,
                    natomiast w przypadku stymulatorów tkankowych od 12 do 24
                    miesięcy. Czas utrzymywania się efektu zależy od rodzaju
                    preparatu, wstrzykniętej ilości, techniki iniekcji, a także
                    od indywidualnych cech organizmu i stylu życia. Specjalista
                    informuje Klienta, że efekty zabiegu nie są identyczne w
                    przypadku każdego Klienta.
                  </p>
                </div>
              </section>

              {/* Szczegóły Zabiegu */}
              <section className="bg-gradient-emerald rounded-2xl border border-[#D4AF37] p-6 md:p-8 gold-glow-sm">
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
                            name: "Revolax Deep ",
                            desc: "Gęstszy żel, który świetnie utrzymuje kształt. Polecany dla osób oczekujących wyraźniejszego powiększenia ust lub wypełnienia bruzd nosowo-wargowych.",
                          },
                          {
                            name: "Revolax Sub-Q",
                            desc: "Najgęstszy preparat, który imituje twardość kości. Używany do wyostrzania rysów: linii żuchwy i brody.",
                          },
                          {
                            name: "Neuramis Deep",
                            desc: "Plastyczny i miękki żel. Doskonały dla osób ceniących subtelny, naturalny wygląd ust (soft lips) oraz do spłycania średnich zmarszczek.",
                          },
                          {
                            name: "Neuramis Volume",
                            desc: "Preparat liftingujący. Służy do przywracania utraconej objętości w policzkach i poprawy owalu twarzy.",
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
                                      ? "text-white"
                                      : "text-white"
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

                  {/* Obszar Zabiegu - Anatomy Face Selector */}
                  <div>
                    <label className="block text-sm text-ui-textSecondary mb-2 font-medium">
                      Obszar Zabiegu
                    </label>
                    <div className="bg-ui-bg p-4 rounded-xl border border-[#D4AF37]">
                      <p className="text-xs text-ui-textSecondary mb-4 text-center">
                        Zaznacz na schemacie obszary, które mają zostać poddane
                        zabiegowi.
                      </p>
                      <AnatomyFaceSelector
                        initialSelected={
                          formData.obszarZabiegu
                            ? formData.obszarZabiegu.split(", ").filter(Boolean)
                            : []
                        }
                        onSelect={(selectedIds) => {
                          handleInputChange(
                            "obszarZabiegu",
                            selectedIds.join(", "),
                          );
                        }}
                      />
                    </div>
                  </div>

                  {/* Additional History Section */}
                  <div>
                    <div className="bg-ui-bg p-5 rounded-xl border border-[#D4AF37] mb-6 space-y-4">
                      <h3 className="font-serif text-white text-lg mb-2">
                        Historia zabiegów wolumetrycznych
                      </h3>
                      <p className="text-xs text-brand uppercase tracking-widest font-medium">
                        Informacje wymagane dla bezpieczeństwa
                      </p>
                      <div className="space-y-3">
                        {[
                          "Zabieg wykonywany pierwszy raz",
                          "Zabieg wykonywany drugi raz, w tym samym gabinecie",
                          "Zabieg wykonywany drugi raz, pierwszy raz w innym gabinecie",
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
                                  let parts = (
                                    formData.informacjaDodatkowa || ""
                                  )
                                    .split("\n")
                                    .filter(Boolean);

                                  if (e.target.checked) {
                                    // Remove other exclusive options if checked
                                    const exclusiveGroup = [
                                      "Zabieg wykonywany pierwszy raz",
                                      "Zabieg wykonywany drugi raz, w tym samym gabinecie",
                                      "Zabieg wykonywany drugi raz, pierwszy raz w innym gabinecie",
                                    ];
                                    // Also remove the "Multiple times" option which starts with the prefix
                                    const multipleTimesPrefix =
                                      "Zabieg wykonywany więcej razy";

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
                                className="w-5 h-5 rounded border-[#D4AF37] text-brand focus:ring-brand focus:ring-offset-0 accent-brand"
                              />
                            </div>
                            <span className="text-ui-textSecondary text-sm group-hover:text-white transition-colors">
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
                                ).includes("Zabieg wykonywany więcej razy")}
                                onChange={(e) => {
                                  let parts = (
                                    formData.informacjaDodatkowa || ""
                                  ).split("\n");
                                  const prefix =
                                    "Zabieg wykonywany więcej razy: ";
                                  if (e.target.checked) {
                                    // Remove other exclusive options
                                    const exclusiveGroup = [
                                      "Zabieg wykonywany pierwszy raz",
                                      "Zabieg wykonywany drugi raz, w tym samym gabinecie",
                                      "Zabieg wykonywany drugi raz, pierwszy raz w innym gabinecie",
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
                                className="w-5 h-5 rounded border-[#D4AF37] text-brand focus:ring-brand focus:ring-offset-0 accent-brand"
                              />
                            </div>
                            <span className="text-ui-textSecondary text-sm group-hover:text-white transition-colors">
                              Zabieg wykonywany więcej razy
                            </span>
                          </label>
                          {(formData.informacjaDodatkowa || "").includes(
                            "Zabieg wykonywany więcej razy",
                          ) && (
                            <input
                              type="text"
                              className="w-full ml-8 px-3 py-2 text-sm bg-ui-bg border border-[#D4AF37] rounded-lg focus:border-brand outline-none"
                              placeholder="Kiedy, jaki preparat, ile razy?"
                              value={
                                (formData.informacjaDodatkowa || "")
                                  .split("\n")
                                  .find((p) =>
                                    p.startsWith(
                                      "Zabieg wykonywany więcej razy: ",
                                    ),
                                  )
                                  ?.replace(
                                    "Zabieg wykonywany więcej razy: ",
                                    "",
                                  ) || ""
                              }
                              onChange={(e) => {
                                const parts = (
                                  formData.informacjaDodatkowa || ""
                                ).split("\n");
                                const index = parts.findIndex((p) =>
                                  p.startsWith(
                                    "Zabieg wykonywany więcej razy: ",
                                  ),
                                );
                                if (index !== -1) {
                                  parts[index] =
                                    `Zabieg wykonywany więcej razy: ${e.target.value}`;
                                  handleInputChange(
                                    "informacjaDodatkowa",
                                    parts.join("\n"),
                                  );
                                }
                              }}
                            />
                          )}
                        </div>

                        {/* Other */}
                        <div className="pt-2">
                          <label className="block text-sm text-ui-textSecondary mb-2 font-medium">
                            Inne informacje
                          </label>
                          <textarea
                            rows={3}
                            className="w-full px-4 py-3 bg-ui-bg border border-[#D4AF37] rounded-xl focus:border-brand outline-none text-sm"
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
                        "Poprawa owalu twarzy",
                        "Wypełnienie ubytków objętości",
                        "Redukcja zmarszczek",
                        "Poprawa jędrności skóry",
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
                              ? "border-brand bg-brand text-white"
                              : "border-[#D4AF37] bg-ui-bg text-ui-textSecondary hover:border-brand hover:text-brand"
                          }`}
                        >
                          {effect}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              {/* Wywiad Medyczny Hyaluronic */}
              <section className="bg-gradient-emerald rounded-2xl border border-[#D4AF37] p-6 md:p-8 gold-glow-sm">
                <h2 className="text-2xl font-serif text-white mb-6 flex items-center gap-3">
                  <span className="w-8 h-8 bg-brand text-white rounded-full flex items-center justify-center text-sm font-sans">
                    4
                  </span>
                  Wywiad Medyczny
                </h2>
                <p className="text-sm text-ui-textSecondary mb-6">
                  Czy posiadasz którekolwiek z poniższych przeciwwskazań?
                </p>

                {/* Medications Input */}
                <div className="bg-ui-bg p-5 rounded-xl border border-[#D4AF37] mb-6">
                  <h3 className="font-serif text-white text-lg mb-2">
                    PRZECIWWSKAZANIA DO WYKONANIA ZABIEGU
                  </h3>
                  <label className="block text-sm text-ui-textSecondary mb-2 font-medium">
                    Proszę wpisać wykaz wszystkich leków przyjmowanych w ciągu
                    ostatnich 6 miesięcy
                  </label>
                  <textarea
                    rows={3}
                    className="w-full px-4 py-3 bg-gradient-emerald border border-[#D4AF37] rounded-xl focus:border-brand outline-none text-sm text-white placeholder-ui-textMuted"
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
                        <div className="h-2 w-24 bg-ui-border rounded-full overflow-hidden">
                          <div
                            className="h-full bg-brand transition-all duration-300"
                            style={{
                              width: `${((currentContraindicationIndex + 1) / contraindicationKeys.length) * 100}%`,
                            }}
                          ></div>
                        </div>
                      </div>

                      <h4 className="text-xl md:text-2xl font-serif text-white mb-8 min-h-[5rem] flex items-center justify-center text-center">
                        {typeof wolumetriaTwarzyContraindications[
                          currentContraindicationKey
                        ] === "string"
                          ? (wolumetriaTwarzyContraindications[
                              currentContraindicationKey
                            ] as string)
                          : (
                              wolumetriaTwarzyContraindications[
                                currentContraindicationKey
                              ] as ContraindicationWithFollowUp
                            ).text}
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
                        formData.przeciwwskazania[
                          currentContraindicationKey
                        ] !== null && (
                          <div className="max-w-md mx-auto mt-4">
                            <button
                              type="button"
                              onClick={handleNextStep}
                              className="w-full py-4 px-6 rounded-xl bg-brand text-white transition-all text-lg font-medium shadow-sm hover:shadow-md hover:bg-brand-dark active:scale-95 flex items-center justify-center"
                            >
                              Dalej →
                            </button>
                          </div>
                        )}

                      <div className="mt-8 flex justify-between items-center border-t border-[#D4AF37] pt-6">
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
                        <span className="text-xs text-brand uppercase tracking-wider font-medium">
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

                      {Object.entries(wolumetriaTwarzyContraindications).map(
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
              <section className="bg-gradient-emerald rounded-2xl border border-[#D4AF37] p-6 md:p-8 gold-glow-sm">
                <h2 className="text-2xl font-serif text-white mb-6 flex items-center gap-3">
                  <span className="w-8 h-8 bg-brand text-white rounded-full flex items-center justify-center text-sm font-sans">
                    5
                  </span>
                  Informacje o Skutkach Ubocznych i Powikłaniach
                </h2>

                <div className="space-y-6">
                  {/* Częste skutki uboczne */}
                  <div className="bg-ui-bg p-5 rounded-xl border border-[#D4AF37]">
                    <p className="text-sm font-medium text-white mb-3">
                      MOŻLIWE DO WYSTĄPIENIA SKUTKI UBOCZNE PO PRZEPROWADZONYM
                      ZABIEGU - CZĘSTE
                    </p>
                    <div className="space-y-4">
                      {wolumetriaTwarzyNaturalReactions.map(
                        (reaction, index) => (
                          <div key={index} className="flex items-start gap-3">
                            <div className="mt-1">
                              <Check className="w-5 h-5 text-brand" />
                            </div>
                            <p className="text-ui-textSecondary leading-relaxed">
                              {reaction}
                            </p>
                          </div>
                        ),
                      )}
                    </div>
                  </div>

                  {/* Rzadkie powikłania */}
                  <div className="bg-ui-bg p-5 rounded-xl border border-[#D4AF37]">
                    <p className="text-sm font-medium text-white mb-3">
                      MOŻLIWE POWIKŁANIA PO PRZEPROWADZONYM ZABIEGU – RZADKIE
                    </p>
                    <ul className="space-y-2 text-sm text-ui-textSecondary">
                      {wolumetriaTwarzyComplications.rzadkie.map(
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
                  <div className="bg-ui-bg p-5 rounded-xl border border-[#D4AF37]/50">
                    <p className="text-sm font-medium text-white mb-3">
                      MOŻLIWE POWIKŁANIA PO PRZEPROWADZONYM ZABIEGU – BARDZO
                      RZADKIE
                    </p>
                    <ul className="space-y-2 text-sm text-ui-textSecondary">
                      {wolumetriaTwarzyComplications.bardzoRzadkie.map(
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
              <section className="bg-gradient-emerald rounded-2xl border border-[#D4AF37] p-6 md:p-8 gold-glow-sm">
                <h2 className="text-2xl font-serif text-white mb-6 flex items-center gap-3">
                  <span className="w-8 h-8 bg-brand text-white rounded-full flex items-center justify-center text-sm font-sans">
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
                    {wolumetriaTwarzyPostCare.map((instruction, index) => (
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
              <section className="bg-gradient-emerald rounded-2xl border border-[#D4AF37] overflow-hidden gold-glow-sm">
                <div className="p-6 md:p-8">
                  <h3 className="text-2xl font-serif text-white mb-6">
                    {rodoInfo.consentTitle}
                  </h3>
                  <div className="bg-ui-bg p-6 rounded-xl text-sm text-ui-textSecondary leading-relaxed whitespace-pre-line max-h-[60vh] overflow-y-auto mb-6 border border-[#D4AF37]">
                    {rodoInfo.consentText}
                  </div>
                  {/* Signature Area for RODO */}
                  <div className="mt-8">
                    <p className="text-sm text-ui-textSecondary mb-4 font-medium uppercase tracking-wide">
                      Podpis Klienta (Zgoda na przetwarzanie danych):
                    </p>
                    <div className="bg-ui-bg rounded-xl overflow-hidden min-h-[200px] border border-[#D4AF37] p-1">
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
              <section className="bg-gradient-emerald rounded-2xl border border-[#D4AF37] overflow-hidden gold-glow-sm">
                <div className="p-6 md:p-8">
                  <h3 className="text-2xl font-serif text-white mb-6">
                    {rodoInfo.clauseTitle}
                  </h3>
                  <div className="bg-ui-bg p-6 rounded-xl text-sm text-ui-textSecondary leading-relaxed whitespace-pre-line max-h-[60vh] overflow-y-auto mb-6 border border-[#D4AF37]">
                    {rodoInfo.clauseText}
                  </div>
                  {/* Signature Area for RODO 2 */}
                  <div className="mt-8">
                    <p className="text-sm text-ui-textSecondary mb-4 font-medium uppercase tracking-wide">
                      Podpis Klienta (Klauzula informacyjna):
                    </p>
                    <div className="bg-ui-bg rounded-xl overflow-hidden min-h-[200px] border border-[#D4AF37] p-1">
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

          {/* KROK 3: ZABIEG */}
          {currentStep === "TREATMENT" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Ryzyko Hyaluronic */}
              <section className="bg-gradient-emerald rounded-2xl border border-[#D4AF37] gold-glow-sm">
                <div className="p-6 md:p-8">
                  <h3 className="text-2xl font-serif text-white mb-6 border-b border-[#D4AF37] pb-2">
                    Świadomość Ryzyka
                  </h3>
                  <p className="text-sm text-ui-textSecondary mb-4">
                    Zostałam/em poinformowana/y o przebiegu zabiegu i możliwości
                    naturalnego wystąpienia ryzyka:
                  </p>

                  <div className="space-y-6">
                    <div className="bg-ui-bg p-5 rounded-xl border border-[#D4AF37]">
                      <p className="text-sm font-medium text-white mb-3">
                        Możliwe naturalne reakcje:
                      </p>
                      <ul className="space-y-2 text-sm text-ui-textSecondary">
                        {wolumetriaTwarzyNaturalReactions.map(
                          (reaction, index) => (
                            <li key={index} className="flex items-start gap-2">
                              <span className="text-brand">•</span>
                              {reaction}
                            </li>
                          ),
                        )}
                      </ul>
                    </div>

                    <div className="bg-ui-bg p-5 rounded-xl border border-[#D4AF37]">
                      <p className="text-sm font-medium text-white mb-3">
                        Możliwe powikłania:
                      </p>
                      <div className="space-y-3 text-sm text-ui-textSecondary">
                        <p>
                          <span className="font-medium">Częste:</span>{" "}
                          {wolumetriaTwarzyComplications.czeste.join(", ")}
                        </p>
                        <p>
                          <span className="font-medium">Rzadkie:</span>{" "}
                          {wolumetriaTwarzyComplications.rzadkie.join(", ")}
                        </p>
                        <p>
                          <span className="font-medium">Bardzo rzadkie:</span>{" "}
                          {wolumetriaTwarzyComplications.bardzoRzadkie.join(
                            ", ",
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Zalecenia Hyaluronic */}
              <section className="bg-gradient-emerald rounded-2xl border border-[#D4AF37] gold-glow-sm">
                <div className="p-6 md:p-8">
                  <h3 className="text-2xl font-serif text-white mb-6 border-b border-[#D4AF37] pb-2">
                    Zobowiązania Pozabiegowe
                  </h3>
                  <p className="text-sm text-ui-textSecondary mb-4">
                    Zobowiązuję się do przestrzegania następujących zaleceń:
                  </p>
                  <ul className="space-y-2 text-ui-textSecondary text-sm bg-ui-bg p-4 rounded-xl border border-[#D4AF37]/30">
                    {wolumetriaTwarzyPostCare.map((instruction, index) => (
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
              <section className="bg-gradient-emerald rounded-2xl border border-[#D4AF37] p-6 md:p-8 gold-glow-sm">
                <h3 className="text-2xl font-serif text-white mb-6 border-b border-[#D4AF37] pb-2">
                  Oświadczenia
                </h3>
                <div className="bg-ui-bg p-5 rounded-xl mb-6 border border-[#D4AF37]">
                  <h4 className="font-serif text-white text-lg mb-4">
                    OŚWIADCZENIE I ŚWIADOMA ZGODA NA ZABIEG WOLUMETRII TWARZY
                    (MODELOWANIE KWASEM HIALURONOWYM)
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
                      które mogłyby wpłynąć na moją decyzję. Mam świadomość
                      ryzyka wystąpienia reakcji alergicznej na środek
                      znieczulający lub wstrzyknięty preparat (kwas
                      hialuronowy). Akceptuję to ryzyko i w przypadku
                      wystąpienia reakcji uczuleniowej przyjmuję na siebie
                      odpowiedzialność za skutki jej wystąpienia. Decyzję o
                      poddaniu się zabiegowi wolumetrii podejmuję w pełni
                      świadomie, dobrowolnie i w sposób przemyślany.
                    </p>
                    <p>
                      <strong>Informacja o zabiegu i higiena:</strong>{" "}
                      Otrzymałam/em wyczerpujące informacje na temat zabiegu,
                      techniki jego wykonania, wskazań oraz przebiegu. Miałam/em
                      możliwość zadawania pytań i uzyskałam/em na nie zrozumiałe
                      odpowiedzi. Potwierdzam, że materiały (w tym
                      ampułkostrzykawka z kwasem hialuronowym) użyte do zabiegu
                      są sterylne, jednorazowe i zostały otwarte w mojej
                      obecności. W Salonie zachowane są najwyższe normy
                      higieniczne.
                    </p>
                    <p>
                      <strong>Ryzyko i powikłania:</strong> Zostałam/em
                      poinformowana/y o możliwych skutkach ubocznych, takich
                      jak: opuchlizna, zaczerwienienie, zasinienia (krwiaki),
                      tkliwość, które mogą utrzymywać się przez kilka dni w
                      zależności od mojego trybu życia. Oświadczam, że
                      rozumiejąc ryzyko powikłań, nie będę wnosić roszczeń
                      odszkodowawczych w przypadku wystąpienia typowych
                      następstw zabiegu, o których zostałam/em uprzedzona/y.
                    </p>
                    <p>
                      <strong>Efekty, trwałość i brak gwarancji:</strong>{" "}
                      Zostałam/em poinformowana/y, że efekt końcowy zależy od
                      indywidualnych cech organizmu (biochemii, rodzaju skóry,
                      ilości wstrzykniętego preparatu) oraz zastosowanej
                      techniki. Przyjmuję do wiadomości, że efekty zabiegu
                      wolumetrii utrzymują się zazwyczaj od 1 roku do 2 lat, co
                      jest kwestią indywidualną, a zabieg należy powtarzać dla
                      podtrzymania rezultatu. Rozumiem, że nie udziela się
                      gwarancji na uzyskanie identycznego efektu jak u innych
                      osób, ani na 100% zadowolenie z rezultatu estetycznego.
                      Rozbieżność między moimi oczekiwaniami a realnym
                      rezultatem (określonym przez Specjalistę jako możliwy do
                      osiągnięcia) nie stanowi podstawy do roszczeń.
                    </p>
                    <p>
                      <strong>Zalecenia pozabiegowe:</strong> Zobowiązuję się do
                      ścisłego przestrzegania zaleceń pozabiegowych, które
                      zostały mi przekazane i wyjaśnione. Mam świadomość, że
                      nieprzestrzeganie zaleceń może prowadzić do poważnych
                      powikłań, takich jak zakażenia czy powstanie blizn, za co
                      Specjalista nie ponosi odpowiedzialności.
                    </p>
                    <p>
                      <strong>Kwalifikacje wykonującego:</strong> Oświadczam, że
                      mam pełną świadomość, iż Specjalista wykonujący zabieg nie
                      jest lekarzem medycyny estetycznej, ale posiada bogate
                      doświadczenie i przeszkolenie w zakresie wykonywanych
                      zabiegów. Akceptuję ten fakt i w przypadku wykonania
                      zabiegu zgodnie z zasadami i etyką pracy, a nieuzyskania
                      spodziewanego efektu, nie będę wnosić roszczeń do osoby
                      wykonującej zabieg.
                    </p>
                    <p className="mt-4 font-medium text-brand">
                      * W przypadku osoby niepełnoletniej wymagany jest podpis
                      rodzica lub opiekuna prawnego.
                    </p>
                  </div>
                </div>

                {/* Podpis pod Zabiegiem (Nowy, obowiązkowy) */}
                <div className="bg-gradient-emerald rounded-2xl border border-[#D4AF37] p-6 md:p-8 mt-8 gold-glow-sm">
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
              <section className="bg-gradient-emerald rounded-2xl border border-[#D4AF37] p-6 md:p-8 gold-glow-sm">
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
                <div className="bg-ui-bg/60 backdrop-blur-sm rounded-xl shadow-sm overflow-hidden border border-brand/50 hover:shadow-md transition-shadow gold-glow-sm">
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
                <div className="bg-ui-bg/60 backdrop-blur-sm rounded-xl shadow-sm overflow-hidden border border-brand/50 hover:shadow-md transition-shadow gold-glow-sm">
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
                        className="w-full px-4 py-2 bg-ui-bg border-b border-[#D4AF37] focus:border-brand outline-none text-sm transition-colors text-white"
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

              <div className="flex justify-between pt-4 pb-12 items-center border-t border-[#D4AF37] mt-8">
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
