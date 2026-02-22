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
  makijazPermanentnyNaturalReactions,
  makijazPermanentnyComplications,
  makijazPermanentnyPostCare,
  rodoInfo,
  makijazPermanentnyContraindications,
} from "../../../types/booking";
import { SALON_CONFIG } from "@/app/config/salon";
import AnatomyFaceSelector from "../AnatomyFaceSelector";
import { ZONES as PMU_ZONES } from "@/types/face-zone-pernament";

interface LipModelingFormProps {
  onBack: () => void;
}

const initialFormData: ConsentFormData = {
  type: "PERMANENT_MAKEUP",
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
  przeciwwskazania: Object.entries(makijazPermanentnyContraindications).reduce(
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

  const contraindicationKeys = Object.keys(makijazPermanentnyContraindications);
  const currentContraindicationKey =
    contraindicationKeys[currentContraindicationIndex];
  const currentContraindicationValue = makijazPermanentnyContraindications[
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
      makijazPermanentnyContraindications[currentContraindicationKey];
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
    formData.dataUrodzenia &&
    isAgeValid &&
    isWizardComplete;

  return (
    <div className="min-h-screen bg-ui-bg text-white selection:bg-brand/30">
      {/* Header */}
      <header className="bg-ui-bgSecondary/80 backdrop-blur-md sticky top-0 z-50 border-b border-brand shadow-lg">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
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
            <h1 className="text-4xl md:text-6xl font-serif text-white mb-3 tracking-tighter drop-shadow-lg">
              Makijaż <span className="text-brand">Permanentny</span>
            </h1>
            <div className="flex items-center justify-center gap-4">
              <div className="h-[1px] w-12 bg-gradient-to-r from-transparent to-brand"></div>
              <p className="text-brand text-xs md:text-base font-light tracking-[0.4em] uppercase">
                Zabieg z zakresu makijażu permanentnego
              </p>
              <div className="h-[1px] w-12 bg-gradient-to-l from-transparent to-brand"></div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* KROK 1: DANE I WYWIAD */}
          {currentStep === "DATA" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <section className="bg-gradient-emerald rounded-2xl border border-[#D4AF37] p-6 md:p-8">
                <h2 className="text-2xl font-serif text-white mb-6 flex items-center gap-3">
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
                      className="w-full px-4 py-3 bg-ui-bg border border-[#D4AF37] rounded-xl focus:border-brand focus:ring-2 focus:ring-brand/20 text-white placeholder-white/40 outline-none transition-all"
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
                      className={`w-full px-4 py-3 bg-ui-bg border rounded-xl focus:border-brand focus:ring-2 focus:ring-brand/20 text-white placeholder-white/40 outline-none transition-all ${
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
                        className="w-full px-4 py-3 bg-ui-bg border border-[#D4AF37] rounded-r-xl focus:border-brand focus:ring-2 focus:ring-brand/20 text-white placeholder-white/40 outline-none transition-all"
                        placeholder="123 456 789"
                        maxLength={11}
                      />
                    </div>
                  </div>
                </div>
              </section>

              {/* Informacja o Zabiegu */}
              <section className="bg-gradient-emerald rounded-2xl border border-[#D4AF37] p-6 md:p-8">
                <h2 className="text-2xl font-serif text-white mb-6 flex items-center gap-3">
                  <span className="w-8 h-8 bg-brand text-black rounded-full flex items-center justify-center text-sm font-sans font-bold">
                    2
                  </span>
                  Informacja o Zabiegu
                </h2>
                <div className="bg-ui-bg p-6 rounded-xl border border-[#D4AF37] text-ui-textSecondary leading-relaxed space-y-4">
                  <p>
                    Makijaż permanentny jest zabiegiem inwazyjnym gdyż związany
                    jest z przerwaniem ciągłości naskórka, wobec czego nie jest
                    pozbawiony ryzyka. Zabieg polega na wprowadzaniu pigmentów
                    koloru w skórę przy użyciu igły.
                  </p>
                  <p>
                    Celem makijażu permanentnego jest podkreślenie oprawy oczu,
                    korekta kształtu łuku brwiowego lub podkreślenie i
                    wyrównanie asymetrii ust a także wzmocnienie ich naturalnego
                    koloru. Głównym celem jest także poprawa walorów
                    estetycznych i samopoczucia klienta.
                  </p>
                  <p>
                    Zabieg wykonywany jest zawsze po wykluczeniu wszelkich
                    przeciwwskazań do wykonania zabiegu. Następnie w rozmowie
                    zostają określone potrzeby i oczekiwania od wykonanego
                    zabiegu makijażu permanentnego. Specjalista wraz z Klientką
                    dobierają odpowiednio kolor pigmentu, a następnie
                    Specjalista wykonuje rysunek wstępny imitujący efekt
                    makijażu trwałego. Warunkiem przystąpienia do zabiegu
                    makijażu permanentnego jest akceptacja rysunku wstępnego.
                  </p>
                  <p>
                    Kolejnym etapem jest znieczulenie, które minimalizuje
                    dyskomfort podczas zabiegu. Próg bólu odczuwany jest
                    indywidualnie oraz uzależniony jest od partii twarzy,
                    któremu poddawana jest pigmentacja.
                  </p>
                  <p>
                    Wybór techniki, która zostanie zastosowana przy zabiegu
                    zależy od predyspozycji i indywidualnych potrzeb Klienta.
                  </p>
                  <div className="bg-ui-bg p-4 rounded-xl border border-[#D4AF37]/50 space-y-4">
                    <div>
                      <p className="font-medium text-white mb-1">BRWI</p>
                      <p>
                        Nie wykonujemy makijażu permanentnego brwi w kolorze
                        czarnym z uwagi na połączenie zimnych barw, które po
                        czasie wypłukują się w chłodne tony: grafit i niebieski.
                        Brąz jest połączeniem czarnego i pomarańczowego wobec
                        czego brwi mogą się wybarwiać na kolor łososiowy. Bardzo
                        chłodne brązy mają tendencję do wybarwiania się w kolor
                        szarości, z racji większej ilości barwy czarnej w
                        pigmencie. Kiedy Klient decyduje się na korektę brwi w
                        odcieniu rudości, to musi być świadomy, że barwnik ten
                        może pojawić się na nowo po pewnym czasie od wykonanej
                        pigmentacji.
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-white mb-1">USTA</p>
                      <p>
                        W przypadku pigmentacji ust nie zaleca się stosowania
                        bardzo jasnych odcieni, ponieważ po wygojeniu odcień
                        jest niezauważalny. Jeśli na ustach wystąpi opryszczka i
                        pigment się wypłucze, co nie jest zależne od
                        wykonującego zabieg, zdarza się, że potrzebna jest 3
                        korekta, która jest bezpłatna.
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-white mb-1">KRESKI</p>
                      <p>
                        Kreski permanentne dolne i górne zazwyczaj wykonujemy
                        kolorem czarnym, jest to chłodny barwnik dlatego pod
                        skórą, szczególnie jasną skórą może się wybarwiać na
                        grafit lub wyglądać jakby miał cząstki granatu.
                      </p>
                    </div>
                  </div>

                  <p className="font-medium text-white">
                    Informacja dodatkowa:
                  </p>
                  <ul className="list-disc pl-5 space-y-3">
                    <li>
                      Makijaż permanentny zmienia swoją intensywność w kolejnych
                      miesiącach po zabiegu dlatego po upływie 1 roku zaleca się
                      wykonanie korekty płatnej, której koszt zgodnie z
                      cennikiem wynosi 50% aktualnej ceny makijażu
                      permanentnego. Korekta po upływie min. 2 latach od
                      ostatniego zabiegu makijażu permanentnego wynosi 100%
                      aktualnej ceny lub w wyjątkowych sytuacjach jest wyceniana
                      indywidualnie. Korekta po około roku dotyczy głównie
                      makijażu permanentnego brwi, ponieważ pigment na innych
                      częściach twarzy utrzymuje się dłużej w związku z tym np.
                      usta po roku są wyraźnie zabarwione i nie wymagają
                      korekty. Brwi natomiast znajdują się w strefie T, co
                      skutkuje szybszym wypłukiwaniem barwnika.
                    </li>
                    <li>
                      Korekta makijażu permanentnego, która ma zostać wykonana w
                      ramach poprawy po innym salonie jest zawsze wyceniana
                      indywidualnie i zwykle traktowana jest jako usługa
                      wykonywana od początku + do której doliczany jest koszt
                      usuwania laserem/removerem wyceniany indywidualnie.
                    </li>
                    <li>
                      Jeżeli Klientka, która skorzystała z usługi makijażu
                      permanentnego w naszym salonie ma uwagi co do
                      koloru/kształtu itp. w ciągu 2 miesięcy od wykonania
                      przysługuje jej prawo zgłoszenia reklamacji. W przypadku
                      pozytywnego rozpatrzenia reklamacji wady zostaną
                      bezpłatnie skorygowane. Wszelkie sugestie po upływie 2
                      miesięcy od zabiegu będą wyceniane indywidualnie.
                    </li>
                    <li>
                      Jeżeli Klientka, która wykonywała zabieg makijażu
                      permanentnego brwi w naszym Salonie po zabiegu dowiaduje
                      się o ciąży i odkłada korektę makijażu do okresu po
                      porodzie, i chce dokonać korekty np. po ok. 1 roku,
                      wówczas cena zabiegu wynosi 50% aktualnej ceny makijażu
                      permanentnego.
                    </li>
                  </ul>

                  <div className="bg-ui-bg p-4 rounded-xl border border-[#D4AF37]/50">
                    <p className="font-medium text-white mb-2">
                      ALTERNATYWNE SPOSOBY WYKONANIA ZABIEGU
                    </p>
                    <p>
                      Nie występują żadne alternatywne metody dla zabiegu
                      makijażu permanentnego z uwagi na ich nietrwały efekt. Do
                      zabiegów, w wyniku których występują podobne efekty jak w
                      przypadku makijażu permanentnego - ale nie są trwałe można
                      zaliczyć wykonanie: henny brwi; wykonanie makijażu
                      klasycznego: ust, brwi czy powiek.
                    </p>
                  </div>
                </div>
              </section>

              {/* Szczegóły Zabiegu */}
              <section className="bg-gradient-emerald rounded-2xl border border-[#D4AF37] p-6 md:p-8">
                <h2 className="text-2xl font-serif text-white mb-6 flex items-center gap-3">
                  <span className="w-8 h-8 bg-brand text-black rounded-full flex items-center justify-center text-sm font-sans font-bold">
                    3
                  </span>
                  Szczegóły Zabiegu
                </h2>
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm text-ui-textSecondary mb-2 font-medium">
                      Anatomia (zaznacz obszar zabiegu)
                    </label>
                    <AnatomyFaceSelector
                      customZones={PMU_ZONES}
                      initialSelected={(formData.obszarZabiegu || "")
                        .split(", ")
                        .filter(Boolean)}
                      onSelect={(selectedIds) => {
                        handleInputChange(
                          "obszarZabiegu",
                          selectedIds.join(", "),
                        );
                      }}
                    />
                  </div>
                  {/* Obszar zabiegu */}
                  <div>
                    <label className="block text-sm text-ui-textSecondary mb-2 font-medium">
                      Wykonywany zabieg dotyczy makijażu permanentnego:
                    </label>
                    <div className="grid grid-cols-3 gap-3 mb-3">
                      {[
                        { id: "lips", label: "Ust" },
                        {
                          id: "eyebrows",
                          label: "Brwi",
                          ids: ["eyebrow_left", "eyebrow_right"],
                        },
                        {
                          id: "eyelids",
                          label: "Powiek",
                          ids: ["eyelid_left", "eyelid_right"],
                        },
                      ].map((item) => {
                        const currentZones = (formData.obszarZabiegu || "")
                          .split(", ")
                          .filter(Boolean);
                        const isSelected = item.ids
                          ? item.ids.every((id) => currentZones.includes(id))
                          : currentZones.includes(item.id);

                        return (
                          <button
                            key={item.label}
                            type="button"
                            onClick={() => {
                              let newZones = [...currentZones];
                              const targets = item.ids || [item.id];

                              if (isSelected) {
                                // Remove all targets
                                newZones = newZones.filter(
                                  (z) => !targets.includes(z),
                                );
                              } else {
                                // Add missing targets
                                targets.forEach((t) => {
                                  if (!newZones.includes(t)) newZones.push(t);
                                });
                              }

                              handleInputChange(
                                "obszarZabiegu",
                                newZones.join(", "),
                              );
                            }}
                            className={`py-3 px-4 rounded-xl border-2 transition-all font-medium text-sm ${
                              isSelected
                                ? "border-brand bg-brand text-black shadow-lg shadow-brand/20 scale-[1.02]"
                                : "border-[#D4AF37] bg-ui-bg text-ui-textSecondary hover:border-brand hover:text-brand"
                            }`}
                          >
                            {item.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Oczekiwany efekt */}
                  <div>
                    <label className="block text-sm text-ui-textSecondary mb-2 font-medium">
                      Po przeprowadzonym zabiegu oczekuję efektu:
                    </label>
                    <div className="grid grid-cols-3 gap-3 mb-3">
                      {[
                        "Intensywnego / mocnego",
                        "Średniego",
                        "Delikatnego / subtelnego",
                      ].map((effect) => (
                        <button
                          key={effect}
                          type="button"
                          onClick={() => {
                            const newValue =
                              formData.celEfektu === effect ? "" : effect;
                            handleInputChange("celEfektu", newValue);
                          }}
                          className={`py-3 px-4 rounded-xl border-2 transition-all font-medium text-sm ${
                            formData.celEfektu === effect
                              ? "border-brand bg-brand text-black shadow-lg shadow-brand/20 scale-[1.02]"
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

              {/* Wywiad Medyczny */}
              <section className="bg-gradient-emerald rounded-2xl border border-[#D4AF37] p-6 md:p-8">
                <h2 className="text-2xl font-serif text-white mb-6 flex items-center gap-3">
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
                  <h3 className="font-serif text-white text-lg mb-2">
                    PRZECIWSKAZANIA DO WYKONANIA ZABIEGU
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
                              width: `${((currentContraindicationIndex + 1) / contraindicationKeys.length) * 100}%`,
                            }}
                          ></div>
                        </div>
                      </div>

                      <h4 className="text-xl md:text-2xl font-serif text-white mb-8 min-h-[5rem] flex items-center justify-center text-center">
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

                      <div className="grid grid-cols-2 gap-6 max-w-md mx-auto">
                        <button
                          type="button"
                          onClick={() => handleWizardAnswer(false)}
                          className={`py-4 px-6 rounded-xl border-2 transition-all text-lg font-medium shadow-sm hover:shadow-md active:scale-95 flex items-center justify-center ${
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

                      {Object.entries(makijazPermanentnyContraindications).map(
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
                <h2 className="text-2xl font-serif text-white mb-6 flex items-center gap-3">
                  <span className="w-8 h-8 bg-brand text-black rounded-full flex items-center justify-center text-sm font-sans font-bold">
                    5
                  </span>
                  Informacje o Skutkach Ubocznych i Powikłaniach
                </h2>

                <div className="space-y-6">
                  {/* Częste skutki uboczne */}
                  <div className="bg-ui-bg p-5 rounded-xl border border-[#D4AF37]/50">
                    <p className="text-sm font-medium text-white mb-3">
                      MOŻLIWE DO WYSTĄPIENIA SKUTKI UBOCZNE PO PRZEPROWADZONYM
                      ZABIEGU - CZĘSTE
                    </p>
                    <ul className="space-y-2 text-sm text-ui-textSecondary">
                      {makijazPermanentnyNaturalReactions.map(
                        (reaction, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <span className="text-brand">∙</span>
                            <span>{reaction}</span>
                          </li>
                        ),
                      )}
                    </ul>
                  </div>

                  {/* Rzadkie powikłania */}
                  <div className="bg-ui-bg p-5 rounded-xl border border-[#D4AF37]/50">
                    <p className="text-sm font-medium text-white mb-3">
                      MOŻLIWE POWIKŁANIA PO PRZEPROWADZONYM ZABIEGU – RZADKIE
                    </p>
                    <ul className="space-y-2 text-sm text-ui-textSecondary">
                      {makijazPermanentnyComplications.rzadkie.map(
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
                      {makijazPermanentnyComplications.bardzoRzadkie.map(
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
                <h2 className="text-2xl font-serif text-white mb-6 flex items-center gap-3">
                  <span className="w-8 h-8 bg-brand text-black rounded-full flex items-center justify-center text-sm font-sans font-bold">
                    6
                  </span>
                  Zalecenia Pozabiegowe
                </h2>

                <div className="bg-ui-bg p-5 rounded-xl border border-[#D4AF37]/50 mb-6">
                  <p className="text-sm text-ui-textSecondary leading-relaxed mb-4">
                    <strong>
                      Niniejszym oświadczam, że zostałam/em poinformowana/y o
                      konieczności stosowania się po przeprowadzonym zabiegu do
                      przestrzegania następujących zaleceń:
                    </strong>
                  </p>
                  <ul className="space-y-2 text-sm text-ui-textSecondary">
                    {makijazPermanentnyPostCare.map((instruction, index) => (
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
                    <div className="bg-ui-bg rounded-xl overflow-hidden border border-[#D4AF37]">
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
              <section className="bg-gradient-emerald rounded-2xl border border-[#D4AF37] overflow-hidden">
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
                    <div className="bg-ui-bg rounded-xl overflow-hidden border border-[#D4AF37]">
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

          {currentStep === "TREATMENT" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Świadomość Ryzyka */}
              <section className="bg-gradient-emerald rounded-2xl border border-[#D4AF37] p-6 md:p-8">
                <div className="p-0">
                  <h3 className="text-2xl font-serif text-white mb-6 border-b border-[#D4AF37] pb-2">
                    Świadomość Ryzyka
                  </h3>
                  <p className="text-sm text-ui-textSecondary mb-4">
                    Zostałam/em poinformowana/y o przebiegu zabiegu i możliwości
                    naturalnego wystąpienia ryzyka:
                  </p>

                  <div className="space-y-6">
                    <div className="bg-ui-bg p-5 rounded-xl border border-[#D4AF37]/50">
                      <p className="text-sm font-medium text-white mb-3">
                        Możliwe naturalne reakcje:
                      </p>
                      <ul className="space-y-2 text-sm text-ui-textSecondary">
                        {makijazPermanentnyNaturalReactions.map(
                          (reaction, index) => (
                            <li key={index} className="flex items-start gap-2">
                              <span className="text-brand">•</span>
                              {reaction}
                            </li>
                          ),
                        )}
                      </ul>
                    </div>

                    <div className="bg-ui-bg p-5 rounded-xl border border-[#D4AF37]/50">
                      <p className="text-sm font-medium text-white mb-3">
                        Możliwe powikłania:
                      </p>
                      <div className="space-y-3 text-sm text-ui-textSecondary">
                        <p>
                          <span className="font-medium">Częste:</span>{" "}
                          {makijazPermanentnyComplications.czeste.join(", ")}
                        </p>
                        <p>
                          <span className="font-medium">Rzadkie:</span>{" "}
                          {makijazPermanentnyComplications.rzadkie.join(", ")}
                        </p>
                        <p>
                          <span className="font-medium">Bardzo rzadkie:</span>{" "}
                          {makijazPermanentnyComplications.bardzoRzadkie.join(
                            ", ",
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Zalecenia Pozabiegowe */}
              <section className="bg-gradient-emerald rounded-2xl border border-[#D4AF37] p-6 md:p-8">
                <div className="p-0">
                  <h3 className="text-2xl font-serif text-white mb-6 border-b border-[#D4AF37] pb-2">
                    Zobowiązania Pozabiegowe
                  </h3>
                  <p className="text-sm text-ui-textSecondary mb-4">
                    Zobowiązuję się do przestrzegania następujących zaleceń:
                  </p>
                  <ul className="space-y-2 text-ui-textSecondary text-sm bg-ui-bg p-4 rounded-xl border border-[#D4AF37]/30">
                    {makijazPermanentnyPostCare.map((instruction, index) => (
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
              <section className="bg-gradient-emerald rounded-2xl border border-[#D4AF37] p-6 md:p-8">
                <h3 className="text-2xl font-serif text-white mb-6 border-b border-[#D4AF37] pb-2">
                  Regulamin Salonu
                </h3>
                <div className="bg-ui-bg p-6 rounded-xl border border-[#D4AF37]/50">
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
                      Klientki na naszą „Czarną listę". Rozumiemy sytuacje
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
              <section className="bg-gradient-emerald rounded-2xl border border-[#D4AF37] p-6 md:p-8">
                <h3 className="text-2xl font-serif text-white mb-6 border-b border-[#D4AF37] pb-2">
                  Oświadczenia
                </h3>
                <div className="bg-ui-bg p-5 rounded-xl mb-6 border border-[#D4AF37]/50">
                  <h4 className="font-serif text-white text-lg mb-4">
                    OŚWIADCZENIE I ŚWIADOMA ZGODA NA ZABIEG MAKIJAŻU
                    PERMANENTNEGO
                  </h4>
                  <p className="text-sm text-ui-textSecondary mb-4">
                    Ja, niżej podpisana/y, po przeprowadzeniu szczegółowego
                    wywiadu i konsultacji ze Specjalistą, oświadczam, że:
                  </p>

                  <div className="space-y-4 text-sm text-ui-textSecondary leading-relaxed">
                    <p>
                      <strong>Stan zdrowia i odpowiedzialność:</strong>{" "}
                      Oświadczam, że Specjalista poinformował mnie o
                      przeciwwskazaniach do zabiegu. Potwierdzam, że nie
                      występują u mnie żadne z wymienionych czynników (np.
                      ciąża, infekcje, nieustabilizowana cukrzyca, choroby
                      skóry).
                    </p>
                    <p>
                      Udzieliłam/em pełnych i prawdziwych informacji o moim
                      stanie zdrowia. Mam świadomość, że zatajenie informacji
                      lub podanie nieprawdy traktowane będzie jako moje
                      przyczynienie się do powstania ewentualnej szkody. W
                      przypadku zatajenia przeciwwskazań biorę na siebie pełną
                      odpowiedzialność za negatywne skutki zabiegu i zrzekam się
                      wszelkich roszczeń wobec osoby wykonującej zabieg.
                    </p>
                    <p>
                      <strong>
                        Informacja o zabiegu i akceptacja rysunku:
                      </strong>{" "}
                      Otrzymałam/em wyczerpujące informacje na temat techniki
                      wykonania makijażu, wskazań oraz przebiegu procedury.
                      Miałam/em możliwość zadawania pytań i uzyskałam/em na nie
                      jasne odpowiedzi.
                    </p>
                    <p>
                      Oświadczam, że rysunek wstępny (kształt i forma) został w
                      pełni dopracowany przez Specjalistę i w pełni go
                      akceptuję. Rozumiem, że jest to kluczowy etap, a po
                      rozpoczęciu pigmentacji zmiana kształtu może być
                      niemożliwa.
                    </p>
                    <p>
                      <strong>Przebieg gojenia i efekty:</strong> Zostałam/em
                      poinformowana/y, że bezpośrednio po zabiegu pigment jest
                      intensywny i ciemniejszy, a opuchlizna i zaczerwienienie
                      są naturalną reakcją, która ustępuje w ciągu kilku dni.
                    </p>
                    <p>
                      Rozumiem, że proces gojenia i stabilizacji pigmentu w
                      skórze trwa około 4-6 tygodni. Wiem, że makijaż rozjaśni
                      się w procesie wyłuszczania naskórka (nawet do 50%), a
                      ostateczny kolor będzie widoczny po około{" "}
                      <input
                        type="text"
                        className="inline-block w-16 px-2 py-0.5 text-center bg-ui-bg border-b-2 border-[#D4AF37] focus:border-brand outline-none text-sm"
                        placeholder="..."
                        value={formData.numerZabiegu || ""}
                        onChange={(e) =>
                          handleInputChange("numerZabiegu", e.target.value)
                        }
                      />{" "}
                      tygodniach.
                    </p>
                    <p>
                      <strong>Brak gwarancji i czynniki indywidualne:</strong>{" "}
                      Poinformowano mnie, że trwałość i przyjęcie się pigmentu
                      zależy od wielu czynników indywidualnych, takich jak:
                      biochemia organizmu, typ skóry (np. skóra tłusta/porowata
                      słabiej przyjmuje pigment), wiek, hormony oraz stosowana
                      pielęgnacja.
                    </p>
                    <p>
                      Przyjmuję do wiadomości, że w związku z powyższym nie
                      udziela się gwarancji na identyczny efekt u każdego
                      klienta, ani gwarancji na czas utrzymywania się makijażu.
                      Rozumiem, że w niektórych przypadkach (np. trudna skóra)
                      pigment może się wyłuszczyć mocniej lub nierównomiernie,
                      co nie jest błędem w sztuce, lecz cechą osobniczą
                      organizmu.
                    </p>
                    <p>
                      <strong>Ryzyko i higiena:</strong> Mam świadomość ryzyka
                      wystąpienia reakcji alergicznej na środek znieczulający
                      (np. lidokainę) lub pigment. W przypadku wystąpienia
                      alergii, biorę na siebie odpowiedzialność za skutki.
                    </p>
                    <p>
                      Oświadczam, że materiały użyte do zabiegu (igły/kartridże)
                      są sterylne, jednorazowe i zostały otwarte w mojej
                      obecności.
                    </p>
                    <p>
                      <strong>Zalecenia i decyzja:</strong> Otrzymałam/em
                      instrukcję pielęgnacji pozabiegowej i zobowiązuję się do
                      jej przestrzegania. Rozumiem, że „skubanie" strupków,
                      opalanie czy moczenie miejsca zabiegowego może zniszczyć
                      efekt, za co Specjalista nie odpowiada.
                    </p>
                    <p>
                      Decyzję o zabiegu podejmuję świadomie i dobrowolnie.
                      Oświadczam, że w przypadku wykonania zabiegu zgodnie z
                      zasadami sztuki i etyki, a nieuzyskania spodziewanego do
                      osoby wykonującej zabieg.
                    </p>

                    <p className="mt-4 font-medium text-brand">
                      * W przypadku osoby niepełnoletniej wymagany jest podpis
                      rodzica lub opiekuna prawnego.
                    </p>
                  </div>
                </div>

                {/* Podpis pod Zabiegiem (Nowy, obowiązkowy) */}
                <div className="bg-ui-bg rounded-2xl border border-[#D4AF37] p-6 md:p-8 mt-8">
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

          {/* KROK 5: MARKETING */}
          {currentStep === "MARKETING" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <section className="bg-gradient-emerald rounded-2xl border border-[#D4AF37] p-6 md:p-8">
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
                <div className="bg-ui-bg rounded-xl border border-[#D4AF37] overflow-hidden hover:shadow-lg transition-shadow">
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
                <div className="bg-ui-bg rounded-xl border border-[#D4AF37] overflow-hidden hover:shadow-lg transition-shadow">
                  <div className="p-6">
                    <h4 className="font-serif text-white text-lg mb-3">
                      Zgoda na Wykorzystanie Wizerunku
                    </h4>
                    <p className="text-sm text-ui-textSecondary leading-relaxed mb-4">
                      Wyrażam nieodpłatną zgodę na utrwalenie i
                      rozpowszechnianie mojego wizerunku (zdjęcia/video efektów
                      zabiegu) w celach promocyjnych salonu {SALON_CONFIG.name}.
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
