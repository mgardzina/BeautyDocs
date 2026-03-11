"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BackButton from "@/app/components/BackButton";
import ConfirmModal from "@/app/components/ConfirmModal";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Calendar,
  Phone,
  StickyNote,
  FileText,
  Mail,
  AlertTriangle,
  Heart,
  MessageSquare,
  Edit2,
  X,
  Check,
  Syringe,
  Eraser,
  Sparkles,
} from "lucide-react";
import { ZONES } from "@/types/face-zones";

// Helper do tłumaczenia stref
const translateZones = (zonesString: string | null): string => {
  if (!zonesString) return "Brak szczegółów";
  const selectedIds = zonesString.split(",").map((s) => s.trim());
  return selectedIds
    .map((id) => {
      const zone = ZONES.find((z) => z.id === id);
      return zone ? zone.name : id;
    })
    .join(", ");
};

// Mapowanie ikon zabiegów
const formTypeIcons: Record<string, typeof Check> = {
  HYALURONIC: Heart,
  PMU: Sparkles,
  LASER: Sparkles, // Or generic
  WRINKLE_REDUCTION: Sparkles,
  FacialVolumetryForm: Syringe, // fallback check
};

const formTypeLabels: Record<string, string> = {
  HYALURONIC: "Modelowanie ust",
  FACIAL_VOLUMETRY: "Wolumetria twarzy",
  WRINKLE_REDUCTION: "Niwelowanie zmarszczek",
  NEEDLE_MESOTHERAPY: "Mezoterapia igłowa",
  INJECTION_LIPOLYSIS: "Lipoliza iniekcyjna",
  PMU: "Makijaż permanentny (Legacy)",
  PERMANENT_MAKEUP: "Makijaż permanentny",
  LASER: "Laser",
  LASER_HAIR_REMOVAL: "Depilacja laserowa",
  LASER_TATTOO_REMOVAL: "Usuwanie tatuażu",
};

interface Note {
  id: string;
  content: string;
  category: NoteCategory;
  createdAt: string;
}

interface Form {
  id: string;
  type: string;
  createdAt: string;
  obszarZabiegu: string | null;
  nazwaProduktu: string | null;
  osobaPrzeprowadzajacaZabieg: string | null;
  email: string | null;
  telefon: string;
  znieczulenie: string | null;
}

type NoteCategory = "NOTATKA" | "ALERGIA" | "UWAGA" | "PREFERENCJA";

const noteCategoryConfig: Record<
  NoteCategory,
  { label: string; color: string; bgColor: string; icon: typeof StickyNote }
> = {
  NOTATKA: {
    label: "Notatka",
    color: "text-gray-600",
    bgColor: "bg-gray-50 border-gray-200",
    icon: MessageSquare,
  },
  ALERGIA: {
    label: "Alergia",
    color: "text-red-600",
    bgColor: "bg-red-50 border-red-200",
    icon: AlertTriangle,
  },
  UWAGA: {
    label: "Uwaga",
    color: "text-amber-600",
    bgColor: "bg-amber-50 border-amber-200",
    icon: AlertTriangle,
  },
  PREFERENCJA: {
    label: "Preferencja",
    color: "text-purple-600",
    bgColor: "bg-purple-50 border-purple-200",
    icon: Heart,
  },
};

interface ClientDetails {
  id: string;
  imieNazwisko: string;
  telefon: string | null;
  forms: Form[];
  notes: Note[];
}

export default function ClientDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { status } = useSession();
  const router = useRouter();
  const [client, setClient] = useState<ClientDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [newNote, setNewNote] = useState("");
  const [newNoteCategory, setNewNoteCategory] =
    useState<NoteCategory>("NOTATKA");
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const [clientId, setClientId] = useState<string>("");

  // History State
  interface TreatmentHistory {
    id: string;
    date: string;
    description: string;
    znieczulenie?: string;
  }
  const [history, setHistory] = useState<TreatmentHistory[]>([]);
  const [newHistory, setNewHistory] = useState({
    date: "",
    description: "",
    znieczulenie: "",
  });
  const [isAddingHistory, setIsAddingHistory] = useState(false);
  const [showAddHistoryForm, setShowAddHistoryForm] = useState(false);
  const [editingHistoryId, setEditingHistoryId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState({
    date: "",
    description: "",
    znieczulenie: "",
  });
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Modal state
  const [modal, setModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    variant: "danger" | "warning" | "success" | "info";
    alertOnly: boolean;
    onConfirm?: () => void;
  }>({ isOpen: false, title: "", message: "", variant: "info", alertOnly: false });

  const showConfirm = (title: string, message: string, onConfirm: () => void, variant: "danger" | "warning" = "danger") => {
    setModal({ isOpen: true, title, message, variant, alertOnly: false, onConfirm });
  };

  const showAlert = (title: string, message: string, variant: "danger" | "warning" | "success" | "info" = "warning") => {
    setModal({ isOpen: true, title, message, variant, alertOnly: true });
  };

  useEffect(() => {
    params.then((p) => setClientId(p.id));
  }, [params]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/admin/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated" && clientId) {
      fetchClientDetails();
    }
  }, [status, clientId]);

  const fetchClientDetails = async () => {
    try {
      const response = await fetch(`/api/clients/${clientId}`);
      const data = await response.json();
      if (data.success) {
        setClient(data.client);
      }
    } catch (error) {
      console.error("Błąd pobierania danych klientki:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    setIsSubmittingNote(true);
    try {
      const response = await fetch(`/api/clients/${clientId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newNote, category: newNoteCategory }),
      });
      const data = await response.json();
      if (data.success) {
        setNewNote("");
        setNewNoteCategory("NOTATKA");
        fetchClientDetails();
      }
    } catch (error) {
      console.error("Błąd dodawania notatki:", error);
    } finally {
      setIsSubmittingNote(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const response = await fetch(`/api/clients/${clientId}/history`);
      if (response.ok) {
        const data = await response.json();
        setHistory(data);
      }
    } catch (error) {
      console.error("Error fetching history:", error);
    }
  };

  useEffect(() => {
    if (clientId) {
      fetchHistory();
    }
  }, [clientId]);

  const handleAddHistory = async (): Promise<boolean> => {
    if (!newHistory.date || !newHistory.description) {
      showAlert("Brakujące dane", "Wypełnij datę i opis wizyty.", "warning");
      return false;
    }

    setIsAddingHistory(true);
    try {
      const response = await fetch(`/api/clients/${clientId}/history`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newHistory),
      });

      if (response.ok) {
        await fetchHistory();
        setNewHistory({ date: "", description: "", znieczulenie: "" });
        return true;
      } else {
        const err = await response.json();
        console.error("API Error Response:", err);
        if (err.error?.includes("Client has no forms")) {
          showAlert(
            "Brak formularza",
            "Klientka nie ma jeszcze żadnego formularza. Wypełnij najpierw formularz, aby dodać historię.",
            "warning",
          );
        } else {
          const details = err.details ? `\n\nSzczegóły: ${err.details}` : "";
          showAlert("Błąd zapisu", `${err.error || "Nieznany błąd"}${details}`, "danger");
        }
        return false;
      }
    } catch (error) {
      console.error("Error adding history:", error);
      showAlert("Błąd połączenia", "Wystąpił błąd połączenia z serwerem.", "danger");
      return false;
    } finally {
      setIsAddingHistory(false);
    }
  };

  const handleDeleteNote = (noteId: string) => {
    showConfirm(
      "Usunąć notatkę?",
      "Ta notatka zostanie trwale usunięta.",
      async () => {
        try {
          const response = await fetch(`/api/clients/${clientId}/notes/${noteId}`, {
            method: "DELETE",
          });
          const data = await response.json();
          if (data.success) {
            fetchClientDetails();
          }
        } catch (error) {
          console.error("Błąd usuwania notatki:", error);
        }
      },
    );
  };

  const handleDeleteHistory = (historyId: string) => {
    showConfirm(
      "Usunąć wizytę?",
      "Ta wizyta zostanie trwale usunięta z historii.",
      async () => {
        try {
          const response = await fetch(`/api/history/${historyId}`, {
            method: "DELETE",
          });
          if (response.ok) {
            await fetchHistory();
          } else {
            showAlert("Błąd", "Wystąpił błąd podczas usuwania.", "danger");
          }
        } catch (error) {
          console.error("Error deleting history:", error);
          showAlert("Błąd połączenia", "Nie udało się połączyć z serwerem.", "danger");
        }
      },
    );
  };

  const startEditingHistory = (item: TreatmentHistory) => {
    setEditingHistoryId(item.id);
    setEditFormData({
      date: item.date,
      description: item.description,
      znieczulenie: item.znieczulenie || "",
    });
  };

  const cancelEditing = () => {
    setEditingHistoryId(null);
    setEditFormData({ date: "", description: "", znieczulenie: "" });
  };

  const handleUpdateHistory = async () => {
    if (!editingHistoryId || !editFormData.date || !editFormData.description)
      return;

    setIsSavingEdit(true);
    try {
      const response = await fetch(`/api/history/${editingHistoryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editFormData),
      });

      if (response.ok) {
        await fetchHistory();
        cancelEditing();
      } else {
        showAlert("Błąd", "Nie udało się zaktualizować wpisu.", "danger");
      }
    } catch (error) {
      console.error("Error updating history:", error);
      showAlert("Błąd połączenia", "Nie udało się połączyć z serwerem.", "danger");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pl-PL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Sortuj notatki: najpierw alergie i uwagi, potem reszta
  const sortedNotes = client?.notes
    ? [...client.notes].sort((a, b) => {
        const priority: Record<NoteCategory, number> = {
          ALERGIA: 0,
          UWAGA: 1,
          PREFERENCJA: 2,
          NOTATKA: 3,
        };
        return priority[a.category] - priority[b.category];
      })
    : [];

  if (status === "loading" || status === "unauthenticated" || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-brand text-lg">Ładowanie...</div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen p-8 text-center text-ui-textSecondary italic">
        Klientka nie znaleziona
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-gradient-emerald backdrop-blur-sm sticky top-0 z-50 shadow-lg border-b border-brand">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <BackButton onClick={() => router.push("/admin/klientki")} />
            <div>
              <h1 className="text-2xl font-serif text-marble-text tracking-wider">
                {client.imieNazwisko}
              </h1>
              <div className="flex items-center gap-4 text-marble-text/60 text-sm">
                <span className="flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {client.telefon ? `+48 ${client.telefon}` : "Brak telefonu"}
                </span>
                {client.forms.length > 0 && client.forms[0].email && (
                  <span className="flex items-center gap-1">
                    <Mail className="w-3 h-3" />
                    {client.forms[0].email}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Lewa kolumna - Notatki */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-gradient-emerald backdrop-blur-sm rounded-2xl shadow-lg p-4 md:p-6 border border-brand/15">
            <h2 className="text-xl font-serif text-marble-text flex items-center gap-2 mb-4">
              <StickyNote className="w-5 h-5 text-brand" />
              Notatki i adnotacje
            </h2>

            <form onSubmit={handleAddNote} className="mb-6">
              <div className="mb-3">
                <label className="block text-sm font-medium text-[#8b8580] mb-2">
                  Kategoria
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    Object.entries(noteCategoryConfig) as [
                      NoteCategory,
                      (typeof noteCategoryConfig)[NoteCategory],
                    ][]
                  ).map(([key, config]) => {
                    const Icon = config.icon;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setNewNoteCategory(key)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all border ${
                          newNoteCategory === key
                            ? `${config.bgColor.replace("bg-gray-50", "bg-white/10").replace("bg-red-50", "bg-red-500/10").replace("bg-amber-50", "bg-amber-500/10").replace("bg-purple-50", "bg-purple-500/10")} ${config.color.replace("text-gray-600", "text-marble-text").replace("text-red-600", "text-red-400").replace("text-amber-600", "text-amber-400").replace("text-purple-600", "text-purple-400")} border-current`
                            : "bg-ui-bg border-brand/20 text-ui-textSecondary/50 hover:bg-white/5"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {config.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder={
                  newNoteCategory === "ALERGIA"
                    ? "Opisz alergię lub przeciwwskazanie..."
                    : newNoteCategory === "UWAGA"
                      ? "Dodaj ważną uwagę..."
                      : newNoteCategory === "PREFERENCJA"
                        ? "Opisz preferencję klientki..."
                        : "Dodaj notatkę..."
                }
                className="w-full p-3 bg-ui-bg border border-brand/20 rounded-xl focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none text-marble-text placeholder-marble-textSecondary transition-all resize-none h-24 text-sm"
              />
              <button
                type="submit"
                disabled={isSubmittingNote || !newNote.trim()}
                className="mt-2 w-full bg-brand text-white py-2 rounded-lg hover:bg-brand-dark transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm shadow-lg gold-glow-sm"
              >
                <Plus className="w-4 h-4" />
                Dodaj {noteCategoryConfig[newNoteCategory].label.toLowerCase()}
              </button>
            </form>

            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {sortedNotes.length === 0 ? (
                <p className="text-sm text-[#8b8580] text-center py-4">
                  Brak notatek
                </p>
              ) : (
                sortedNotes.map((note) => {
                  const config =
                    noteCategoryConfig[note.category] ||
                    noteCategoryConfig.NOTATKA;
                  const Icon = config.icon;
                  return (
                    <div
                      key={note.id}
                      className="p-4 rounded-xl border relative group bg-black border-brand/50 shadow-lg"
                    >
                      <div className="flex items-start gap-2 mb-2">
                        <Icon
                          className={`w-4 h-4 mt-0.5 ${config.color.replace("text-gray-600", "text-brand").replace("text-red-600", "text-red-400").replace("text-amber-600", "text-amber-400").replace("text-purple-600", "text-purple-400")}`}
                        />
                        <span
                          className={`text-xs font-medium uppercase tracking-wider ${config.color.replace("text-gray-600", "text-brand").replace("text-red-600", "text-red-400").replace("text-amber-600", "text-amber-400").replace("text-purple-600", "text-purple-400")}`}
                        >
                          {config.label}
                        </span>
                      </div>
                      <p className="text-marble-text font-medium text-sm whitespace-pre-wrap pl-6">
                        {note.content}
                      </p>
                      <div className="mt-2 flex justify-between items-center text-xs text-[#8b8580] pl-6">
                        <span>{formatDate(note.createdAt)}</span>
                        <button
                          onClick={() => handleDeleteNote(note.id)}
                          className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 transition-all p-1"
                          title="Usuń notatkę"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Prawa kolumna - Historia zabiegów */}
        <div className="lg:col-span-2 space-y-8">
          {/* Sekcja dodawania nowej wizyty (Szybka akcja) - widoczna tylko po kliknięciu */}
          {showAddHistoryForm && (
            <div className="bg-gradient-emerald backdrop-blur-sm rounded-2xl shadow-lg p-6 md:p-8 border border-brand/20 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-serif text-marble-text flex items-center gap-2">
                  <FileText className="w-6 h-6 text-brand" />
                  Dodaj nową wizytę
                </h2>
                <button
                  onClick={() => setShowAddHistoryForm(false)}
                  className="text-ui-textSecondary hover:text-brand transition-colors"
                >
                  Anuluj
                </button>
              </div>

              <div className="bg-marble-border/20 rounded-xl p-5 shadow-inner border border-brand/10">
                <div className="grid gap-4">
                  {/* Data i Czas - osobne pola */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-ui-textSecondary mb-1 uppercase tracking-wider">
                        Data wizyty
                      </label>
                      <input
                        type="date"
                        value={
                          newHistory.date ? newHistory.date.split("T")[0] : ""
                        }
                        onChange={(e) => {
                          const time = newHistory.date
                            ? newHistory.date.split("T")[1]
                            : "12:00";
                          setNewHistory({
                            ...newHistory,
                            date: `${e.target.value}T${time}`,
                          });
                        }}
                        className="w-full px-3 py-2 bg-ui-bg border border-brand/20 rounded-lg focus:border-brand outline-none text-marble-text text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-ui-textSecondary mb-1 uppercase tracking-wider">
                        Godzina
                      </label>
                      <input
                        type="time"
                        value={
                          newHistory.date ? newHistory.date.split("T")[1] : ""
                        }
                        onChange={(e) => {
                          const date = newHistory.date
                            ? newHistory.date.split("T")[0]
                            : new Date().toISOString().split("T")[0];
                          setNewHistory({
                            ...newHistory,
                            date: `${date}T${e.target.value}`,
                          });
                        }}
                        className="w-full px-3 py-2 bg-ui-bg border border-brand/20 rounded-lg focus:border-brand outline-none text-marble-text text-sm"
                      />
                    </div>
                  </div>

                  {/* Adnotacja i Obszar - 2 kolumny */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-ui-textSecondary mb-1 uppercase tracking-wider">
                        Znieczulenie
                      </label>
                      <input
                        type="text"
                        value={newHistory.znieczulenie || ""}
                        onChange={(e) =>
                          setNewHistory({
                            ...newHistory,
                            znieczulenie: e.target.value,
                          })
                        }
                        placeholder="np. Maść znieczulająca"
                        className="w-full px-3 py-2 bg-ui-bg border border-brand/20 rounded-lg focus:border-brand outline-none text-marble-text text-sm"
                      />
                    </div>
                  </div>

                  {/* Adnotacja i Obszar - 2 kolumny */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-ui-textSecondary mb-1 uppercase tracking-wider">
                        Adnotacja (np. 2. zabieg)
                      </label>
                      <input
                        type="text"
                        value={newHistory.description.split(" | ")[0] || ""}
                        onChange={(e) => {
                          const parts = newHistory.description.split(" | ");
                          let area = "";
                          let details = "";

                          if (parts.length === 3) {
                            area = parts[1];
                            details = parts[2];
                          } else if (parts.length === 2) {
                            area = parts[0];
                            details = parts[1];
                          } else {
                            details = parts[0];
                          }

                          setNewHistory({
                            ...newHistory,
                            description: `${e.target.value} | ${area} | ${details}`,
                          });
                        }}
                        placeholder="np. Zabieg przypominający"
                        className="w-full px-3 py-2 bg-ui-bg border border-brand/20 rounded-lg focus:border-brand outline-none text-marble-text text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-ui-textSecondary mb-1 uppercase tracking-wider">
                        Obszar / Zabieg
                      </label>
                      <input
                        type="text"
                        value={
                          newHistory.description.includes(" | ")
                            ? newHistory.description.split(" | ").length === 3
                              ? newHistory.description.split(" | ")[1]
                              : newHistory.description.split(" | ")[0]
                            : ""
                        }
                        onChange={(e) => {
                          const parts = newHistory.description.split(" | ");
                          let annotation = "";
                          let details = "";

                          if (parts.length === 3) {
                            annotation = parts[0];
                            details = parts[2];
                          } else if (parts.length === 2) {
                            details = parts[1];
                          } else {
                            details = parts[0];
                          }

                          setNewHistory({
                            ...newHistory,
                            description: `${annotation} | ${e.target.value} | ${details}`,
                          });
                        }}
                        placeholder="np. Usta"
                        className="w-full px-3 py-2 bg-ui-bg border border-brand/20 rounded-lg focus:border-brand outline-none text-marble-text text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-ui-textSecondary mb-1 uppercase tracking-wider">
                      Szczegóły (Preparat, Efekt, Uwagi)
                    </label>
                    <textarea
                      value={
                        newHistory.description.includes(" | ")
                          ? newHistory.description.split(" | ").length === 3
                            ? newHistory.description.split(" | ")[2]
                            : newHistory.description.split(" | ")[1]
                          : newHistory.description
                      }
                      onChange={(e) => {
                        const parts = newHistory.description.split(" | ");
                        let annotation = "";
                        let area = "";

                        if (parts.length === 3) {
                          annotation = parts[0];
                          area = parts[1];
                        } else if (parts.length === 2) {
                          area = parts[0];
                        }

                        setNewHistory({
                          ...newHistory,
                          description: `${annotation} | ${area} | ${e.target.value}`,
                        });
                      }}
                      className="w-full px-3 py-2 bg-ui-bg border border-brand/20 rounded-lg focus:border-brand outline-none text-marble-text text-sm h-20 resize-none"
                      placeholder="np. Stylage M 1ml, efekt naturalny..."
                    />
                  </div>

                  <button
                    onClick={async () => {
                      const success = await handleAddHistory();
                      if (success) {
                        setShowAddHistoryForm(false);
                      }
                    }}
                    disabled={
                      isAddingHistory ||
                      !newHistory.date ||
                      !newHistory.description
                    }
                    className="mt-2 bg-brand text-white py-2 px-6 rounded-lg text-sm font-medium hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors self-start shadow-lg gold-glow-sm"
                  >
                    {isAddingHistory ? "Zapisywanie..." : "+ Zapisz wizytę"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Unified Timeline - Historia i Formularze */}
          <div className="bg-gradient-emerald backdrop-blur-sm rounded-2xl shadow-lg overflow-hidden border border-brand/15">
            <div className="p-4 md:p-6 border-b border-brand/20 flex justify-between items-center">
              <h2 className="text-xl font-serif text-marble-text">
                Historia klientki
              </h2>
              <button
                onClick={() => setShowAddHistoryForm(!showAddHistoryForm)}
                className="bg-brand text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-brand-dark transition-colors flex items-center gap-1 shadow-md gold-glow-sm"
              >
                <Plus className="w-3 h-3" />
                Dodaj wizytę
              </button>
            </div>

            <div className="max-h-[600px] overflow-y-auto p-4 space-y-3">
              {(() => {
                // Merge forms and history into unified timeline
                const timelineItems = [
                  ...history.map((h) => ({
                    id: h.id,
                    type: "visit" as const,
                    date: new Date(h.date),
                    description: h.description,
                    znieczulenie: h.znieczulenie,
                  })),
                  ...client.forms.map((f) => ({
                    id: f.id,
                    type: "form" as const,
                    date: new Date(f.createdAt),
                    formType: f.type,
                    obszarZabiegu: f.obszarZabiegu,
                    nazwaProduktu: f.nazwaProduktu,
                    osoba: f.osobaPrzeprowadzajacaZabieg,
                    znieczulenie: f.znieczulenie,
                  })),
                ].sort((a, b) => b.date.getTime() - a.date.getTime());

                if (timelineItems.length === 0) {
                  return (
                    <p className="text-center text-[#8b8580] py-8 italic">
                      Brak historii dla tej klientki.
                    </p>
                  );
                }

                return timelineItems.map((item) => (
                  <div
                    key={`${item.type}-${item.id}`}
                    className="group bg-marble-border/30 rounded-xl p-4 border border-brand/10 shadow-sm hover:border-brand/20 transition-all backdrop-blur-sm"
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-md whitespace-nowrap mt-0.5 ${item.type === "visit" ? "bg-brand/80 text-white" : "bg-emerald/50 border border-brand/20 text-marble-text"}`}
                      >
                        {item.type === "visit" ? "Wizyta" : "Formularz"}
                      </span>

                      <div className="flex-1 min-w-0">
                        {item.type === "visit" &&
                        editingHistoryId === item.id ? (
                          <div className="space-y-3">
                            {/* EDYCJA WIZYTY */}
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="date"
                                value={editFormData.date.split("T")[0]}
                                onChange={(e) => {
                                  const time =
                                    editFormData.date.split("T")[1] || "12:00";
                                  setEditFormData({
                                    ...editFormData,
                                    date: `${e.target.value}T${time}`,
                                  });
                                }}
                                className="px-2 py-1 border rounded text-xs"
                              />
                              <input
                                type="time"
                                value={editFormData.date.split("T")[1] || ""}
                                onChange={(e) => {
                                  const date = editFormData.date.split("T")[0];
                                  setEditFormData({
                                    ...editFormData,
                                    date: `${date}T${e.target.value}`,
                                  });
                                }}
                                className="px-2 py-1 border rounded text-xs"
                              />
                              <input
                                type="text"
                                value={editFormData.znieczulenie}
                                onChange={(e) =>
                                  setEditFormData({
                                    ...editFormData,
                                    znieczulenie: e.target.value,
                                  })
                                }
                                placeholder="Znieczulenie"
                                className="w-full px-2 py-1 border rounded text-xs mb-2"
                              />
                            </div>
                            <textarea
                              value={editFormData.description}
                              onChange={(e) =>
                                setEditFormData({
                                  ...editFormData,
                                  description: e.target.value,
                                })
                              }
                              className="w-full px-2 py-1 border rounded text-sm min-h-[60px]"
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={cancelEditing}
                                className="p-1 text-gray-500 hover:bg-gray-100 rounded"
                              >
                                <X className="w-4 h-4" />
                              </button>
                              <button
                                onClick={handleUpdateHistory}
                                disabled={isSavingEdit}
                                className="p-1 text-green-600 hover:bg-green-50 rounded"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {/* WIDOK STANDARDOWY */}
                            <div className="flex justify-between items-start mb-2">
                              <span className="text-marble-text font-semibold text-base">
                                {item.type === "visit"
                                  ? item.description.split(" | ")[0] ||
                                    "Brak adnotacji"
                                  : formTypeLabels[item.formType] ||
                                    item.formType}
                              </span>

                              <div className="flex items-center gap-3">
                                <span className="text-xs text-ui-textSecondary flex items-center gap-1 font-medium bg-marble-border/40 px-2 py-1 rounded-md border border-brand/10">
                                  <Calendar className="w-3 h-3 text-brand" />
                                  {formatDate(item.date.toISOString())}
                                </span>
                                {item.type === "visit" && (
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() =>
                                        startEditingHistory({
                                          id: item.id,
                                          date: item.date.toISOString(),
                                          description: item.description,
                                          znieczulenie: (item as any)
                                            .znieczulenie,
                                        })
                                      }
                                      className="p-1.5 text-brand hover:text-brand-dark transition-colors"
                                      title="Edytuj"
                                    >
                                      <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() =>
                                        handleDeleteHistory(item.id)
                                      }
                                      className="p-1.5 text-red-400 hover:text-red-600 transition-colors"
                                      title="Usuń"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>

                            {item.type === "visit" ? (
                              <>
                                <p className="text-marble-text text-base leading-relaxed whitespace-pre-wrap font-medium">
                                  {item.description}
                                </p>
                                {(item as any).znieczulenie && (
                                  <div className="mt-3 flex flex-col gap-1 bg-brand/5 p-2 rounded-lg border border-brand/20">
                                    <span className="text-xs font-bold text-brand uppercase tracking-wider">
                                      Znieczulenie
                                    </span>
                                    <span className="text-sm font-medium text-marble-text">
                                      {(item as any).znieczulenie}
                                    </span>
                                  </div>
                                )}
                              </>
                            ) : (
                              <Link
                                href={`/admin/formularz/${item.id}`}
                                className="block hover:text-brand transition-colors"
                              >
                                <p className="text-sm text-ui-textSecondary font-medium">
                                  {translateZones(item.obszarZabiegu)}
                                </p>
                                {(item as any).nazwaProduktu && (
                                  <p className="text-sm text-ui-textSecondary mt-1 italic">
                                    {((item as any).nazwaProduktu || "")
                                      .replace(/\| Email:.*$/, "")
                                      .trim()}
                                  </p>
                                )}
                                {(item as any).znieczulenie && (
                                  <div className="mt-3 flex flex-col gap-1 bg-brand/5 p-2 rounded-lg border border-brand/20">
                                    <span className="text-xs font-bold text-brand uppercase tracking-wider">
                                      Znieczulenie
                                    </span>
                                    <span className="text-sm font-medium text-marble-text">
                                      {(item as any).znieczulenie}
                                    </span>
                                  </div>
                                )}
                              </Link>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
