"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { SALON_CONFIG } from "@/app/config/salon";
import BackButton from "@/app/components/BackButton";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"credentials" | "otp">("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [maskedPhone, setMaskedPhone] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handlePreLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/pre-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Błąd logowania");
        setIsLoading(false);
        return;
      }

      if (data.requires2FA) {
        setMaskedPhone(data.maskedPhone);
        setStep("otp");
      } else {
        // Logowanie bez 2FA (jeśli dozwolone)
        await performLogin();
      }
    } catch {
      setError("Wystąpił błąd połączenia");
    } finally {
      setIsLoading(false);
    }
  };

  const performLogin = async () => {
    try {
      const result = await signIn("credentials", {
        email,
        password,
        code: otp, // Przekaż kod OTP (jeśli jest)
        redirect: false,
      });

      if (result?.error) {
        setError("Nieprawidłowy kod weryfikacyjny lub dane logowania");
        setIsLoading(false);
      } else {
        router.push("/admin");
        router.refresh();
      }
    } catch {
      setError("Wystąpił błąd podczas finalizacji logowania");
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    await performLogin();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-gradient-emerald backdrop-blur-sm rounded-3xl shadow-2xl p-6 md:p-12 w-full max-w-md border border-brand/20">
        <div className="text-center mb-8">
          <h1 className="text-2xl md:text-3xl font-serif text-marble-text mb-2 uppercase tracking-wider">
            {SALON_CONFIG.name}
          </h1>
          <p className="text-ui-textSecondary uppercase tracking-widest text-xs">
            Panel administracyjny
          </p>
        </div>

        {step === "credentials" ? (
          <form onSubmit={handlePreLogin} className="space-y-6">
            {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm text-ui-textSecondary mb-2 font-medium">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-ui-bg border border-brand/20 rounded-xl focus:border-brand focus:ring-2 focus:ring-brand/20 text-marble-text placeholder-marble-textSecondary outline-none transition-all"
                placeholder={SALON_CONFIG.email}
              />
            </div>

            <div>
              <label className="block text-sm text-ui-textSecondary mb-2 font-medium">
                Hasło
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-ui-bg border border-brand/20 rounded-xl focus:border-brand focus:ring-2 focus:ring-brand/20 text-marble-text placeholder-marble-textSecondary outline-none transition-all"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-brand text-white py-4 rounded-xl text-lg font-medium hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg gold-glow-sm"
            >
              {isLoading ? "Weryfikacja..." : "Dalej"}
            </button>
          </form>
        ) : (
          <form
            onSubmit={handleOtpSubmit}
            className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300"
          >
            {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm">
                {error}
              </div>
            )}

            <div className="text-center mb-6">
              <p className="text-marble-text text-sm mb-2">
                Wysłaliśmy kod weryfikacyjny SMS na numer:
              </p>
              <p className="text-brand font-mono text-lg font-bold">
                {maskedPhone}
              </p>
            </div>

            <div>
              <label className="block text-sm text-ui-textSecondary mb-2 font-medium text-center">
                Wprowadź 6-cyfrowy kod
              </label>
              <input
                type="text"
                required
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                className="w-full px-4 py-3 bg-ui-bg border border-brand/20 rounded-xl focus:border-brand focus:ring-2 focus:ring-brand/20 text-marble-text placeholder-marble-textSecondary outline-none transition-all text-center text-2xl tracking-widest font-mono"
                placeholder="000000"
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || otp.length !== 6}
              className="w-full bg-brand text-white py-4 rounded-xl text-lg font-medium hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg gold-glow-sm"
            >
              {isLoading ? "Logowanie..." : "Potwierdź kod"}
            </button>

            <button
              type="button"
              onClick={() => setStep("credentials")}
              className="w-full text-sm text-ui-textSecondary hover:text-brand transition-colors mt-4"
            >
              Zmień dane logowania
            </button>
          </form>
        )}

        <div className="flex justify-center mt-8">
          <BackButton
            onClick={() => router.push("/")}
            label="Powrót do strony głównej"
          />
        </div>
      </div>
    </div>
  );
}
