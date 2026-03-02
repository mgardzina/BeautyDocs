"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Phone, Shield, Check, AlertCircle, Loader2 } from "lucide-react";
import { sendOTP, verifyOTP, AuditLogData } from "@/app/actions/otp";

interface SignatureVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVerified: (signatureData: string, auditLog: AuditLogData) => void;
  phoneNumber: string;
  documentContent: string;
  clientName: string;
}

type Step = "phone" | "otp" | "success";

export default function SignatureVerificationModal({
  isOpen,
  onClose,
  onVerified,
  phoneNumber: initialPhone,
  documentContent,
  clientName,
}: SignatureVerificationModalProps) {
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState(initialPhone);
  const [maskedPhone, setMaskedPhone] = useState("");
  const [otpCode, setOtpCode] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [attemptsLeft, setAttemptsLeft] = useState(3);

  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  useEffect(() => {
    if (isOpen) {
      setStep("phone");
      setPhone(initialPhone);
      setOtpCode(["", "", "", "", "", ""]);
      setError("");
      setCooldown(0);
      setAttemptsLeft(3);
    }
  }, [isOpen, initialPhone]);

  const formatPhoneInput = (value: string): string => {
    const digits = value.replace(/\D/g, "").slice(0, 9);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhoneInput(e.target.value));
    setError("");
  };

  const handleSendOTP = async () => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length !== 9) {
      setError("Numer telefonu musi mieć 9 cyfr");
      return;
    }
    setIsLoading(true);
    setError("");
    const result = await sendOTP(`+48${digits}`);
    setIsLoading(false);
    if (result.success) {
      setMaskedPhone(result.maskedPhone || "");
      setStep("otp");
      setOtpCode(["", "", "", "", "", ""]);
      setTimeout(() => otpInputRefs.current[0]?.focus(), 100);
    } else {
      setError(result.error || "Błąd wysyłania kodu");
      if (result.cooldownSeconds) setCooldown(result.cooldownSeconds);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    if (value.length > 1) {
      const digits = value.slice(0, 6).split("");
      const newOtp = [...otpCode];
      digits.forEach((digit, i) => {
        if (index + i < 6) newOtp[index + i] = digit;
      });
      setOtpCode(newOtp);
      setError("");
      const nextIndex = Math.min(index + digits.length, 5);
      otpInputRefs.current[nextIndex]?.focus();
      return;
    }
    const newOtp = [...otpCode];
    newOtp[index] = value.slice(-1);
    setOtpCode(newOtp);
    setError("");
    if (value && index < 5) otpInputRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otpCode[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);
    const newOtp = [...otpCode];
    pastedData.split("").forEach((char, i) => {
      if (i < 6) newOtp[i] = char;
    });
    setOtpCode(newOtp);
    if (pastedData.length === 6) otpInputRefs.current[5]?.focus();
  };

  const handleVerifyOTP = async () => {
    const code = otpCode.join("");
    if (code.length !== 6) {
      setError("Wprowadź pełny 6-cyfrowy kod");
      return;
    }
    setIsLoading(true);
    setError("");
    const digits = phone.replace(/\D/g, "");
    const result = await verifyOTP(`+48${digits}`, code, documentContent, true);
    setIsLoading(false);
    if (result.success && result.auditLog) {
      setStep("success");
      setTimeout(() => {
        onVerified("SMS_VERIFIED_NO_SIGNATURE", result.auditLog!);
      }, 1500);
    } else {
      setError(result.error || "Błąd weryfikacji");
      if (result.attemptsLeft !== undefined)
        setAttemptsLeft(result.attemptsLeft);
    }
  };

  const handleResendOTP = async () => {
    if (cooldown > 0) return;
    await handleSendOTP();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 8 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 8 }}
          className="bg-[#F5F3F0] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-[#D4AF37]/40"
        >
          {/* Header */}
          <div className="bg-white px-6 py-5 border-b border-[#D4AF37]/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#D4AF37]/15 rounded-full flex items-center justify-center border border-[#D4AF37]/30">
                  <Shield className="w-5 h-5 text-[#D4AF37]" />
                </div>
                <div>
                  <h2 className="font-serif text-[#2c2825] text-lg tracking-wide">
                    Weryfikacja Tożsamości
                  </h2>
                  <p className="text-sm text-[#8b7355]">
                    Wymagane do przejścia dalej
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-[#D4AF37]/10 rounded-full transition-colors text-[#8b7355] hover:text-[#2c2825]"
                disabled={isLoading}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Progress dots */}
            <div className="flex items-center justify-center gap-3 mt-4">
              {(["phone", "otp", "success"] as Step[]).map((s, i) => (
                <div
                  key={s}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    step === s
                      ? "w-6 bg-[#D4AF37]"
                      : (["phone", "otp", "success"] as Step[]).indexOf(step) >
                          i
                        ? "w-6 bg-[#D4AF37]/50"
                        : "w-1.5 bg-[#d4cec4]"
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            <AnimatePresence mode="wait">
              {/* Step 1: Phone */}
              {step === "phone" && (
                <motion.div
                  key="phone"
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  className="space-y-5"
                >
                  <div className="text-center mb-6">
                    <p className="text-[#2c2825] font-serif text-lg tracking-wide">
                      Krok 1: Numer telefonu
                    </p>
                    <p className="text-sm text-[#8b7355] mt-1">
                      Wyślemy kod weryfikacyjny na podany numer
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm text-[#6b6560] font-medium uppercase tracking-wide">
                      Numer telefonu (bez prefiksu +48)
                    </label>
                    <div className="flex">
                      <span className="inline-flex items-center px-4 py-3 bg-white border border-r-0 border-[#D4AF37]/50 rounded-l-xl text-[#D4AF37] font-semibold text-sm">
                        +48
                      </span>
                      <div className="relative flex-1">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8b7355]" />
                        <input
                          type="tel"
                          value={phone}
                          onChange={handlePhoneChange}
                          placeholder="123 456 789"
                          className="w-full pl-10 pr-4 py-3 bg-white border border-[#D4AF37]/50 rounded-r-xl focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 text-[#2c2825] placeholder-[#d4cec4] outline-none transition-all text-sm"
                          maxLength={11}
                          autoFocus
                        />
                      </div>
                    </div>
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 px-4 py-2 rounded-lg border border-red-200">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      {error}
                    </div>
                  )}

                  <button
                    onClick={handleSendOTP}
                    disabled={
                      isLoading ||
                      cooldown > 0 ||
                      phone.replace(/\D/g, "").length !== 9
                    }
                    className="w-full bg-[#D4AF37] text-black py-3 rounded-xl font-semibold hover:bg-[#c9a432] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-sm"
                  >
                    {isLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : cooldown > 0 ? (
                      `Poczekaj ${cooldown}s`
                    ) : (
                      "Wyślij kod SMS"
                    )}
                  </button>
                </motion.div>
              )}

              {/* Step 2: OTP */}
              {step === "otp" && (
                <motion.div
                  key="otp"
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  className="space-y-5"
                >
                  <div className="text-center mb-6">
                    <p className="text-[#2c2825] font-serif text-lg tracking-wide">
                      Krok 2: Wprowadź kod
                    </p>
                    <p className="text-sm text-[#8b7355] mt-1">
                      Wpisz 6-cyfrowy kod wysłany na {maskedPhone}
                    </p>
                  </div>

                  <div className="flex justify-center gap-2">
                    {otpCode.map((digit, index) => (
                      <input
                        key={index}
                        ref={(el) => {
                          otpInputRefs.current[index] = el;
                        }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(index, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(index, e)}
                        onPaste={index === 0 ? handleOtpPaste : undefined}
                        className="w-11 h-13 text-center text-xl font-bold bg-white border-2 border-[#D4AF37]/40 rounded-xl focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 text-[#2c2825] outline-none transition-colors"
                        style={{ height: "52px" }}
                        autoComplete="one-time-code"
                      />
                    ))}
                  </div>

                  {error && (
                    <div className="flex items-center justify-center gap-2 text-red-600 text-sm bg-red-50 px-4 py-2 rounded-lg border border-red-200">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      {error}
                    </div>
                  )}

                  <p className="text-center text-xs text-[#8b7355]">
                    Pozostało prób: {attemptsLeft} • Kod ważny 5 minut
                  </p>

                  <button
                    onClick={handleVerifyOTP}
                    disabled={isLoading || otpCode.join("").length !== 6}
                    className="w-full bg-[#D4AF37] text-black py-3 rounded-xl font-semibold hover:bg-[#c9a432] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-sm"
                  >
                    {isLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      "Zweryfikuj tożsamość"
                    )}
                  </button>

                  <div className="flex justify-center flex-col gap-2 items-center">
                    <button
                      type="button"
                      onClick={() => setStep("phone")}
                      className="text-xs text-[#8b7355] hover:text-[#D4AF37] transition-colors underline underline-offset-2"
                    >
                      Zmień numer telefonu
                    </button>
                    <button
                      onClick={handleResendOTP}
                      disabled={cooldown > 0}
                      className="text-sm text-[#D4AF37] hover:text-[#c9a432] disabled:text-[#d4cec4] transition-colors font-medium"
                    >
                      {cooldown > 0
                        ? `Wyślij ponownie za ${cooldown}s`
                        : "Wyślij kod ponownie"}
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Step 3: Success */}
              {step === "success" && (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-8"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: "spring" }}
                    className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-green-200"
                  >
                    <Check className="w-10 h-10 text-green-600" />
                  </motion.div>
                  <h3 className="text-xl font-serif text-[#2c2825] mb-2 tracking-wide">
                    Tożsamość zweryfikowana!
                  </h3>
                  <p className="text-sm text-[#8b7355]">
                    Możesz bezpiecznie przejść do kolejnego kroku.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="bg-white/60 px-6 py-3 border-t border-[#D4AF37]/20">
            <p className="text-xs text-center text-[#8b7355]">
              Weryfikacja SMS zapewnia bezpieczeństwo Twoich danych
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
