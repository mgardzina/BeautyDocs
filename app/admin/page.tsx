"use client";

import { useEffect, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogOut, FileText, Check, X, Search } from "lucide-react";
import { SALON_CONFIG } from "@/app/config/salon";

interface ConsentFormSummary {
  id: string;
  type: string;
  createdAt: string;
  imieNazwisko: string;
  telefon: string;
  miejscowoscData: string;
  zgodaPrzetwarzanieDanych: boolean;
}

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [forms, setForms] = useState<ConsentFormSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Sprawdzenie autentykacji
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/admin/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated") {
      fetchForms();
    }
  }, [status]);

  const fetchForms = async () => {
    try {
      const response = await fetch("/api/consent-forms");
      const data = await response.json();
      if (data.success) {
        setForms(data.forms);
      }
    } catch (error) {
      console.error("Błąd pobierania formularzy:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredForms = forms.filter(
    (form) =>
      form.imieNazwisko.toLowerCase().includes(searchQuery.toLowerCase()) ||
      form.telefon.includes(searchQuery),
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pl-PL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Pokaż loading gdy sesja jest sprawdzana
  if (status === "loading" || status === "unauthenticated") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-brand text-lg">Ładowanie...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-gradient-emerald backdrop-blur-sm sticky top-0 z-50 shadow-lg border-b border-brand">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-xl md:text-2xl font-serif text-marble-text tracking-wider uppercase">
              {SALON_CONFIG.name}
            </h1>
            <p className="text-marble-text/60 text-sm">
              {session?.user?.email === SALON_CONFIG.email
                ? "Panel administracyjny"
                : session?.user?.name || "Panel"}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/admin/klientki"
              className="text-marble-text/80 hover:text-brand transition-colors bg-white/10 px-4 py-2 rounded-lg text-sm font-medium"
            >
              Baza Klientek
            </Link>
            <Link
              href="/admin/statystyki"
              className="text-marble-text/80 hover:text-brand transition-colors bg-white/10 px-4 py-2 rounded-lg text-sm font-medium"
            >
              Statystyki
            </Link>
            <button
              onClick={() => signOut({ callbackUrl: "/admin/login" })}
              className="flex items-center gap-2 text-marble-text/80 hover:text-brand transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span className="hidden md:inline">Wyloguj</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Search */}
        <div className="bg-gradient-emerald backdrop-blur-sm rounded-2xl shadow-lg p-4 md:p-6 mb-6 border border-brand/15">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-ui-textSecondary/50" />
            <input
              type="text"
              placeholder="Szukaj po nazwisku lub telefonie..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-ui-bg border border-brand/20 rounded-xl focus:border-brand focus:ring-2 focus:ring-brand/20 text-marble-text placeholder-marble-textSecondary outline-none transition-all"
            />
          </div>
        </div>

        {/* Forms List */}
        <div className="bg-gradient-emerald backdrop-blur-sm rounded-2xl shadow-lg overflow-hidden border border-brand/15">
          <div className="p-4 md:p-6 border-b border-brand/20">
            <h2 className="text-xl font-serif text-marble-text flex items-center gap-2">
              <FileText className="w-5 h-5 text-brand" />
              Formularze zgód
            </h2>
          </div>

          {isLoading ? (
            <div className="p-12 text-center text-[#8b8580]">Ładowanie...</div>
          ) : filteredForms.length === 0 ? (
            <div className="p-12 text-center text-ui-textSecondary">
              {searchQuery
                ? "Brak wyników dla podanego wyszukiwania"
                : "Brak formularzy"}
            </div>
          ) : (
            <div className="divide-y divide-brand/15">
              {filteredForms.map((form) => (
                <Link
                  key={form.id}
                  href={`/admin/formularz/${form.id}`}
                  className="block p-4 md:p-6 hover:bg-white/5 transition-colors"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h3 className="font-medium text-marble-text flex items-center gap-2">
                        {form.imieNazwisko}
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            form.type === "PMU"
                              ? "bg-green-500/20 text-green-400 border border-green-500/30"
                              : form.type === "LASER"
                                ? "bg-red-500/20 text-red-400 border border-red-500/30"
                                : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                          }`}
                        >
                          {form.type === "PMU"
                            ? "PMU"
                            : form.type === "LASER"
                              ? "LASER"
                              : "KWAS"}
                        </span>
                      </h3>
                      <p className="text-sm text-ui-textSecondary">
                        +48 {form.telefon} &bull; {form.miejscowoscData}
                      </p>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-3">
                        <span
                          className="flex items-center gap-1 text-xs"
                          title="Zgoda na dane"
                        >
                          {form.zgodaPrzetwarzanieDanych ? (
                            <Check className="w-4 h-4 text-green-500" />
                          ) : (
                            <X className="w-4 h-4 text-red-500" />
                          )}
                          RODO
                        </span>
                      </div>
                      <span className="text-sm text-ui-textSecondary">
                        {formatDate(form.createdAt)}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
