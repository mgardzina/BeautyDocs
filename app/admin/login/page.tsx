"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { SALON_CONFIG } from "@/app/config/salon";
import BackButton from "@/app/components/BackButton";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Nieprawidłowy email lub hasło");
      } else {
        router.push("/admin");
        router.refresh();
      }
    } catch {
      setError("Wystąpił błąd podczas logowania");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="bg-gradient-emerald backdrop-blur-sm rounded-3xl shadow-2xl p-6 md:p-12 w-full max-w-md border border-emerald/30">
        <div className="text-center mb-8">
          <h1 className="text-2xl md:text-3xl font-serif text-white mb-2 uppercase tracking-wider">
            {SALON_CONFIG.name}
          </h1>
          <p className="text-ui-textSecondary uppercase tracking-widest text-xs">
            Panel administracyjny
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
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
              className="w-full px-4 py-3 bg-ui-appBg border border-emerald/30 rounded-xl focus:border-brand focus:ring-2 focus:ring-brand/20 text-white placeholder-white/30 outline-none transition-all"
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
              className="w-full px-4 py-3 bg-ui-appBg border border-emerald/30 rounded-xl focus:border-brand focus:ring-2 focus:ring-brand/20 text-white placeholder-white/30 outline-none transition-all"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-brand text-white py-4 rounded-xl text-lg font-medium hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg gold-glow-sm"
          >
            {isLoading ? "Logowanie..." : "Zaloguj się"}
          </button>
        </form>

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
