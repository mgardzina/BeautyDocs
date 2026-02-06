"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Users, Search, ArrowLeft, FileText, StickyNote } from "lucide-react";

interface ClientSummary {
  id: string;
  imieNazwisko: string;
  telefon: string | null;
  formsCount: number;
  notesCount: number;
  lastVisit: string | null;
}

export default function ClientsPage() {
  const { status } = useSession();
  const router = useRouter();
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/admin/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated") {
      fetchClients();
    }
  }, [status]);

  const fetchClients = async () => {
    try {
      const response = await fetch("/api/clients");
      const data = await response.json();
      if (data.success) {
        setClients(data.clients);
      }
    } catch (error) {
      console.error("Błąd pobierania klientek:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredClients = clients.filter(
    (client) =>
      client.imieNazwisko.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (client.telefon && client.telefon.includes(searchQuery)),
  );

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Brak wizyt";
    return new Date(dateString).toLocaleDateString("pl-PL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
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
      <header className="bg-gradient-emerald backdrop-blur-sm sticky top-0 z-50 shadow-lg border-b border-emerald/30">
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
                Klientki
              </h1>
              <p className="text-white/60 text-sm">
                {clients.length}{" "}
                {clients.length === 1 ? "klientka" : "klientek"}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Search */}
        <div className="bg-gradient-emerald backdrop-blur-sm rounded-2xl shadow-lg p-4 md:p-6 mb-6 border border-emerald/20">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-ui-textSecondary/50" />
            <input
              type="text"
              placeholder="Szukaj po nazwisku lub telefonie..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-ui-appBg border border-emerald/30 rounded-xl focus:border-brand focus:ring-2 focus:ring-brand/20 text-white placeholder-white/30 outline-none transition-all"
            />
          </div>
        </div>

        {/* Clients List */}
        <div className="bg-gradient-emerald backdrop-blur-sm rounded-2xl shadow-lg overflow-hidden border border-emerald/20">
          <div className="p-4 md:p-6 border-b border-emerald/30">
            <h2 className="text-xl font-serif text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-brand" />
              Lista klientek
            </h2>
          </div>

          {isLoading ? (
            <div className="p-12 text-center text-ui-textSecondary italic">
              Ładowanie...
            </div>
          ) : filteredClients.length === 0 ? (
            <div className="p-12 text-center text-ui-textSecondary italic">
              {searchQuery
                ? "Brak wyników dla podanego wyszukiwania"
                : "Brak klientek"}
            </div>
          ) : (
            <div className="divide-y divide-emerald/30">
              {filteredClients.map((client) => (
                <Link
                  key={client.id}
                  href={`/admin/klientki/${client.id}`}
                  className="block p-4 md:p-6 hover:bg-white/5 transition-colors"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h3 className="font-medium text-white group-hover:text-brand transition-colors">
                        {client.imieNazwisko}
                      </h3>
                      <p className="text-sm text-ui-textSecondary">
                        {client.telefon
                          ? `+48 ${client.telefon}`
                          : "Brak telefonu"}
                      </p>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-1 text-sm text-ui-textSecondary">
                        <FileText className="w-4 h-4" />
                        {client.formsCount}{" "}
                        {client.formsCount === 1 ? "wizyta" : "wizyt"}
                      </div>
                      <div className="flex items-center gap-1 text-sm text-ui-textSecondary">
                        <StickyNote className="w-4 h-4" />
                        {client.notesCount}{" "}
                        {client.notesCount === 1 ? "notatka" : "notatek"}
                      </div>
                      <span className="text-sm text-ui-textSecondary font-light">
                        Ostatnia: {formatDate(client.lastVisit)}
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
