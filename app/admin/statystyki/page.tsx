"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BarChart3, Camera, Megaphone, Shield } from "lucide-react";

interface StatsData {
  total: number;
  zgodaMarketing: number;
  zgodaFotografie: number;
  zgodaPrzetwarzanieDanych: number;
}

export default function StatystykiPage() {
  const { status } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState<StatsData>({
    total: 0,
    zgodaMarketing: 0,
    zgodaFotografie: 0,
    zgodaPrzetwarzanieDanych: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/admin/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated") {
      fetchStats();
    }
  }, [status]);

  const fetchStats = async () => {
    try {
      const response = await fetch("/api/consent-forms");
      const data = await response.json();
      if (data.success) {
        const forms = data.forms;
        setStats({
          total: forms.length,
          zgodaMarketing: forms.filter(
            (f: { zgodaMarketing: boolean }) => f.zgodaMarketing,
          ).length,
          zgodaFotografie: forms.filter(
            (f: { zgodaFotografie: boolean }) => f.zgodaFotografie,
          ).length,
          zgodaPrzetwarzanieDanych: forms.filter(
            (f: { zgodaPrzetwarzanieDanych: boolean }) =>
              f.zgodaPrzetwarzanieDanych,
          ).length,
        });
      }
    } catch (error) {
      console.error("Błąd pobierania statystyk:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculatePercentage = (value: number) => {
    if (stats.total === 0) return 0;
    return Math.round((value / stats.total) * 100);
  };

  if (status === "loading" || status === "unauthenticated") {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-brand text-lg">Ładowanie...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="bg-gradient-emerald backdrop-blur-sm sticky top-0 z-50 shadow-lg border-b border-brand">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link
              href="/admin"
              className="text-white/60 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-serif text-white tracking-wider">
                Statystyki
              </h1>
              <p className="text-white/60 text-sm">Zgody i RODO</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {isLoading ? (
          <div className="text-center text-ui-textSecondary italic">
            Ładowanie...
          </div>
        ) : (
          <>
            {/* Główne statystyki */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {/* Wszystkie formularze */}
              <div className="bg-gradient-emerald backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-emerald/20">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 bg-brand/10 rounded-xl">
                    <BarChart3 className="w-6 h-6 text-brand" />
                  </div>
                  <p className="text-ui-textSecondary text-sm font-medium">
                    Wszystkie formularze
                  </p>
                </div>
                <p className="text-4xl font-serif text-white">{stats.total}</p>
              </div>

              {/* Zgody RODO */}
              <div className="bg-gradient-emerald backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-emerald/20">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 bg-green-500/10 rounded-xl">
                    <Shield className="w-6 h-6 text-green-500" />
                  </div>
                  <p className="text-ui-textSecondary text-sm font-medium">
                    Zgody RODO (dane)
                  </p>
                </div>
                <p className="text-4xl font-serif text-white">
                  {stats.zgodaPrzetwarzanieDanych}
                </p>
                <p className="text-sm text-ui-textSecondary mt-2 italic">
                  {calculatePercentage(stats.zgodaPrzetwarzanieDanych)}%
                  klientek
                </p>
              </div>

              {/* Zgody marketing */}
              <div className="bg-gradient-emerald backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-emerald/20">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 bg-purple-500/10 rounded-xl">
                    <Megaphone className="w-6 h-6 text-purple-400" />
                  </div>
                  <p className="text-ui-textSecondary text-sm font-medium">
                    Zgody marketing
                  </p>
                </div>
                <p className="text-4xl font-serif text-white">
                  {stats.zgodaMarketing}
                </p>
                <p className="text-sm text-ui-textSecondary mt-2 italic">
                  {calculatePercentage(stats.zgodaMarketing)}% klientek
                </p>
              </div>

              {/* Zgody foto */}
              <div className="bg-gradient-emerald backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-emerald/20">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 bg-blue-500/10 rounded-xl">
                    <Camera className="w-6 h-6 text-blue-400" />
                  </div>
                  <p className="text-ui-textSecondary text-sm font-medium">
                    Zgody foto
                  </p>
                </div>
                <p className="text-4xl font-serif text-white">
                  {stats.zgodaFotografie}
                </p>
                <p className="text-sm text-ui-textSecondary mt-2 italic">
                  {calculatePercentage(stats.zgodaFotografie)}% klientek
                </p>
              </div>
            </div>

            {/* Podsumowanie */}
            <div className="bg-gradient-emerald backdrop-blur-sm rounded-2xl p-6 md:p-8 shadow-lg border border-emerald/20">
              <h2 className="text-xl font-serif text-white mb-6 pb-3 border-b border-emerald/30">
                Podsumowanie zgód
              </h2>
              <div className="space-y-6">
                {/* RODO */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-ui-textSecondary font-medium">
                      Zgoda RODO (przetwarzanie danych)
                    </span>
                    <span className="text-brand font-medium">
                      {stats.zgodaPrzetwarzanieDanych} / {stats.total}
                    </span>
                  </div>
                  <div className="h-3 bg-black/40 rounded-full overflow-hidden border border-emerald/10">
                    <div
                      className="h-full bg-green-500 rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(34,197,94,0.3)]"
                      style={{
                        width: `${calculatePercentage(stats.zgodaPrzetwarzanieDanych)}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Marketing */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-ui-textSecondary font-medium">
                      Zgoda marketingowa
                    </span>
                    <span className="text-brand font-medium">
                      {stats.zgodaMarketing} / {stats.total}
                    </span>
                  </div>
                  <div className="h-3 bg-black/40 rounded-full overflow-hidden border border-emerald/10">
                    <div
                      className="h-full bg-purple-500 rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(168,85,247,0.3)]"
                      style={{
                        width: `${calculatePercentage(stats.zgodaMarketing)}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Foto */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-ui-textSecondary font-medium">
                      Zgoda na fotografie
                    </span>
                    <span className="text-brand font-medium">
                      {stats.zgodaFotografie} / {stats.total}
                    </span>
                  </div>
                  <div className="h-3 bg-black/40 rounded-full overflow-hidden border border-emerald/10">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(59,130,246,0.3)]"
                      style={{
                        width: `${calculatePercentage(stats.zgodaFotografie)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
