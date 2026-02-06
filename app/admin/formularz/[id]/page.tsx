"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  User,
  Phone,
  MapPin,
  Calendar,
  Trash2,
  Check,
  X,
  Mail,
  Pencil,
  Save,
  XCircle,
} from "lucide-react";
import { contraindicationsByFormType, FormType } from "@/types/booking";
import AnatomyFaceSelector from "@/app/components/AnatomyFaceSelector";
import { ZONES } from "@/types/face-zones";

// Helper do tłumaczenia stref
const translateZones = (zonesString: string | null): string => {
  if (!zonesString) return "Nie podano";

  const selectedIds = zonesString.split(",").map((s) => s.trim());

  return selectedIds
    .map((id) => {
      const zone = ZONES.find((z) => z.id === id);
      return zone ? zone.name : id; // Fallback to ID if name not found
    })
    .join(", ");
};

// Funkcja do czyszczenia starego formatu nazwaProduktu (usuwanie emaila)
const cleanNazwaProduktu = (nazwa: string | null): string | null => {
  if (!nazwa) return null;
  // Usuń " | Email: xxx" lub "Email: xxx" ze starego formatu
  const cleaned = nazwa
    .replace(/\s*\|\s*Email:\s*[^\s|]+/gi, "")
    .replace(/^Email:\s*[^\s|]+\s*\|?\s*/gi, "")
    .trim();
  return cleaned || null;
};

interface TreatmentHistory {
  id: string;
  date: string;
  description: string;
}

interface ConsentFormFull {
  id: string;
  type: string;
  createdAt: string;
  imieNazwisko: string;
  email: string | null;
  ulica: string | null;
  kodPocztowy: string | null;
  miasto: string | null;
  dataUrodzenia: string | null;
  telefon: string;
  miejscowoscData: string;
  nazwaProduktu: string | null;
  obszarZabiegu: string | null;
  celEfektu: string | null;
  przeciwwskazania: Record<string, boolean | string | null>;
  zgodaPrzetwarzanieDanych: boolean;
  zgodaMarketing: boolean;
  zgodaFotografie: boolean;
  zgodaPomocPrawna: boolean;
  miejscaPublikacjiFotografii: string | null;
  podpisDane: string | null;
  podpisMarketing: string | null;
  podpisFotografie: string | null;
  podpisRodo: string | null;
  podpisRodo2: string | null;
  informacjaDodatkowa: string | null;
  osobaPrzeprowadzajacaZabieg: string | null;
  clientId: string | null;
}

const formTypeLabels: Record<string, string> = {
  LIP_AUGMENTATION: "Modelowanie ust",
  FACIAL_VOLUMETRY: "Wolumetria twarzy",
  WRINKLE_REDUCTION: "Niwelowanie zmarszczek",
  NEEDLE_MESOTHERAPY: "Mezoterapia igłowa",
  INJECTION_LIPOLYSIS: "Lipoliza iniekcyjna",
  PERMANENT_MAKEUP: "Makijaż permanentny (Legacy)",
  LASER_HAIR_REMOVAL: "Depilacja laserowa",
};

export default function FormDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const [form, setForm] = useState<ConsentFormFull | null>(null);
  const [history, setHistory] = useState<TreatmentHistory[]>([]);
  const [newHistory, setNewHistory] = useState({ date: "", description: "" });
  const [isAddingHistory, setIsAddingHistory] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editedForm, setEditedForm] = useState<Partial<ConsentFormFull>>({});
  const [activeTab, setActiveTab] = useState<
    "details" | "contraindications" | "consents"
  >("details");

  useEffect(() => {
    fetchForm();
    fetchHistory();
  }, [params.id]);

  const fetchForm = async () => {
    try {
      const response = await fetch(`/api/consent-forms/${params.id}`);
      const data = await response.json();
      if (data.success) {
        setForm(data.form);
        // Oczyść nazwaProduktu ze starego formatu z emailem
        setEditedForm({
          ...data.form,
          nazwaProduktu: cleanNazwaProduktu(data.form.nazwaProduktu) || "",
        });
      }
    } catch (error) {
      console.error("Błąd pobierania formularza:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const response = await fetch(`/api/consent-forms/${params.id}/history`);
      if (response.ok) {
        const data = await response.json();
        setHistory(data);
      }
    } catch (error) {
      console.error("Błąd pobierania historii:", error);
    }
  };

  const handleAddHistory = async () => {
    if (!newHistory.date || !newHistory.description) return;

    setIsAddingHistory(true);
    try {
      const response = await fetch(`/api/consent-forms/${params.id}/history`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newHistory),
      });

      if (response.ok) {
        await fetchHistory();
        setNewHistory({ date: "", description: "" });
      }
    } catch (error) {
      console.error("Błąd dodawania historii:", error);
    } finally {
      setIsAddingHistory(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Czy na pewno chcesz usunąć ten formularz?")) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/consent-forms/${params.id}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (data.success) {
        router.push("/admin");
      }
    } catch (error) {
      console.error("Błąd usuwania:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/consent-forms/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editedForm),
      });
      const data = await response.json();
      if (data.success) {
        setForm(data.form);
        setIsEditing(false);
      }
    } catch (error) {
      console.error("Błąd zapisywania:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedForm({
      ...(form || {}),
      nazwaProduktu: cleanNazwaProduktu(form?.nazwaProduktu || null) || "",
    });
    setIsEditing(false);
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

  // Assuming 'status' and 'error' are defined elsewhere, e.g., from useSession or a global state
  // For this diff, we'll assume 'status' is not available and only use 'isLoading'
  // and 'error' is not explicitly defined in the original snippet, so we'll use '!form' for error state.
  // If 'status' and 'error' are meant to be new variables, they would need to be declared.
  // For now, I'll adapt the provided diff to the existing context as closely as possible.

  if (isLoading) {
    // Original: if (isLoading)
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-brand text-lg">Ładowanie...</div>
      </div>
    );
  }

  if (!form) {
    // Original: if (!form)
    return (
      <div className="min-h-screen bg-black p-8 text-center">
        <div className="max-w-md mx-auto bg-gradient-emerald backdrop-blur-sm p-8 rounded-2xl shadow-lg border border-red-500/20">
          <p className="text-red-400 mb-6">
            {"Nie udało się załadować danych"}
          </p>{" "}
          {/* Assuming 'error' is not available, using a default message */}
          <Link
            href="/admin/klientki"
            className="text-brand hover:text-brand-dark transition-colors flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" /> Wróć do listy
          </Link>
        </div>
      </div>
    );
  }

  // Renaming 'form' to 'formData' to match the diff's new structure, if that's the intent.
  // However, the rest of the code uses 'form', so I'll keep 'form' and adjust the diff's class names.
  const formData = form; // Alias for consistency with the diff's new structure

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="bg-gradient-emerald backdrop-blur-sm sticky top-0 z-50 shadow-lg border-b border-emerald/30">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link
            href="/admin"
            className="flex items-center gap-2 text-white/80 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Powrót</span>
          </Link>
          <div className="flex items-center gap-3">
            {isEditing ? (
              <>
                <button
                  onClick={handleCancel}
                  className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
                >
                  <XCircle className="w-5 h-5" />
                  <span className="hidden md:inline">Anuluj</span>
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-2 text-green-300 hover:text-green-200 transition-colors"
                >
                  <Save className="w-5 h-5" />
                  <span className="hidden md:inline">
                    {isSaving ? "Zapisywanie..." : "Zapisz"}
                  </span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-2 text-white/80 hover:text-white transition-colors"
                >
                  <Pencil className="w-5 h-5" />
                  <span className="hidden md:inline">Edytuj</span>
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="flex items-center gap-2 text-red-300 hover:text-red-200 transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                  <span className="hidden md:inline">
                    {isDeleting ? "Usuwanie..." : "Usuń"}
                  </span>
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Header Info - Always Visible */}
        <div className="bg-gradient-emerald backdrop-blur-sm rounded-2xl shadow-lg p-4 md:p-8 border border-emerald/20">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-4 flex-wrap">
                <h1 className="text-2xl md:text-3xl font-serif text-white">
                  {form.imieNazwisko}
                </h1>
                {isEditing ? (
                  <select
                    value={editedForm.type || form.type}
                    onChange={(e) =>
                      setEditedForm({ ...editedForm, type: e.target.value })
                    }
                    className="px-3 py-1.5 bg-black/40 border border-emerald/30 rounded-lg text-sm focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none text-white"
                  >
                    <option value="HYALURONIC">Kwas hialuronowy</option>
                    <option value="PMU">Makijaż permanentny</option>
                    <option value="LASER">Laser</option>
                  </select>
                ) : (
                  <span className="px-3 py-1 bg-brand/10 text-brand rounded-lg text-sm font-medium">
                    {formTypeLabels[form.type] || form.type}
                  </span>
                )}
                {form.clientId && (
                  <Link
                    href={`/admin/klientki/${form.clientId}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-brand/10 text-brand hover:bg-brand/20 rounded-lg text-sm font-medium transition-colors"
                  >
                    <User className="w-4 h-4" />
                    Profil klientki
                  </Link>
                )}
              </div>
              <p className="text-ui-textSecondary mt-1">
                Formularz wypełniony: {formatDate(form.createdAt)}
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3 text-white">
              <Phone className="w-5 h-5 text-brand flex-shrink-0" />
              {isEditing ? (
                <input
                  type="text"
                  value={editedForm.telefon || ""}
                  onChange={(e) =>
                    setEditedForm({ ...editedForm, telefon: e.target.value })
                  }
                  className="flex-1 px-3 py-1.5 bg-black/40 border border-emerald/30 rounded-lg text-sm focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none text-white"
                  placeholder="Telefon"
                />
              ) : (
                <span>+48 {form.telefon}</span>
              )}
            </div>
            <div className="flex items-center gap-3 text-white">
              <Mail className="w-5 h-5 text-brand flex-shrink-0" />
              {isEditing ? (
                <input
                  type="email"
                  value={editedForm.email || ""}
                  onChange={(e) =>
                    setEditedForm({ ...editedForm, email: e.target.value })
                  }
                  className="flex-1 px-3 py-1.5 bg-black/40 border border-emerald/30 rounded-lg text-sm focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none text-white"
                  placeholder="Email"
                />
              ) : (
                <span>{form.email || "Brak email"}</span>
              )}
            </div>
            <div className="flex items-start gap-3 text-white">
              <MapPin className="w-5 h-5 text-brand flex-shrink-0 mt-1" />
              {isEditing ? (
                <div className="flex-1 space-y-2">
                  <input
                    type="text"
                    value={editedForm.ulica || ""}
                    onChange={(e) =>
                      setEditedForm({ ...editedForm, ulica: e.target.value })
                    }
                    className="w-full px-3 py-1.5 bg-black/40 border border-emerald/30 rounded-lg text-sm focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none text-white"
                    placeholder="Ulica"
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editedForm.kodPocztowy || ""}
                      onChange={(e) =>
                        setEditedForm({
                          ...editedForm,
                          kodPocztowy: e.target.value,
                        })
                      }
                      className="w-24 px-3 py-1.5 bg-black/40 border border-emerald/30 rounded-lg text-sm focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none text-white"
                      placeholder="Kod"
                    />
                    <input
                      type="text"
                      value={editedForm.miasto || ""}
                      onChange={(e) =>
                        setEditedForm({ ...editedForm, miasto: e.target.value })
                      }
                      className="flex-1 px-3 py-1.5 bg-black/40 border border-emerald/30 rounded-lg text-sm focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none text-white"
                      placeholder="Miasto"
                    />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col">
                  {form.ulica || form.miasto ? (
                    <>
                      <span className="text-white">{form.ulica}</span>
                      <span className="text-ui-textSecondary">
                        {form.kodPocztowy} {form.miasto}
                      </span>
                    </>
                  ) : (
                    <span className="text-ui-textSecondary italic">
                      Brak adresu
                    </span>
                  )}
                </div>
              )}
            </div>
            {form.dataUrodzenia && (
              <div className="flex items-center gap-3 text-white">
                <Calendar className="w-5 h-5 text-brand" />
                <span>{form.dataUrodzenia}</span>
              </div>
            )}
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="flex gap-2 border-b border-emerald/30 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveTab("details")}
            className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === "details"
                ? "text-brand border-b-2 border-brand"
                : "text-ui-textSecondary hover:text-white"
            }`}
          >
            Szczegóły zabiegu
          </button>
          <button
            onClick={() => setActiveTab("contraindications")}
            className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === "contraindications"
                ? "text-brand border-b-2 border-brand"
                : "text-ui-textSecondary hover:text-white"
            }`}
          >
            Przeciwwskazania
          </button>
          <button
            onClick={() => setActiveTab("consents")}
            className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === "consents"
                ? "text-brand border-b-2 border-brand"
                : "text-ui-textSecondary hover:text-white"
            }`}
          >
            Zgody i Podpisy
          </button>
        </div>

        {/* Tab Content: Details */}
        {activeTab === "details" && (
          <div className="bg-gradient-emerald backdrop-blur-sm rounded-2xl shadow-lg p-4 md:p-8 animate-in fade-in slide-in-from-bottom-2 duration-300 border border-emerald/20">
            <h2 className="text-xl font-serif text-white mb-4 pb-3 border-b border-emerald/30">
              Szczegóły zabiegu
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ui-textSecondary mb-1">
                  Preparat
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedForm.nazwaProduktu || ""}
                    onChange={(e) =>
                      setEditedForm({
                        ...editedForm,
                        nazwaProduktu: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 bg-black/40 border border-emerald/30 rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none text-white"
                    placeholder="Nazwa preparatu"
                  />
                ) : (
                  <p className="text-white">
                    {cleanNazwaProduktu(form.nazwaProduktu) || "Nie podano"}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-ui-textSecondary mb-1">
                  Obszar zabiegu
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedForm.obszarZabiegu || ""}
                    onChange={(e) =>
                      setEditedForm({
                        ...editedForm,
                        obszarZabiegu: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 bg-black/40 border border-emerald/30 rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none text-white"
                    placeholder="Obszar zabiegu"
                  />
                ) : (
                  <p className="text-white">
                    {translateZones(form.obszarZabiegu)}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-ui-textSecondary mb-1">
                  Osoba przeprowadzająca zabieg
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedForm.osobaPrzeprowadzajacaZabieg || ""}
                    onChange={(e) =>
                      setEditedForm({
                        ...editedForm,
                        osobaPrzeprowadzajacaZabieg: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 bg-black/40 border border-emerald/30 rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none text-white"
                    placeholder="Imię i Nazwisko Specjalisty"
                  />
                ) : (
                  <p className="text-white">
                    {form.osobaPrzeprowadzajacaZabieg || "Nie przypisano"}
                  </p>
                )}
              </div>

              {/* Visual Face Selector for Admin - Improved Visibility */}
              <div className="mt-4 border-t border-emerald/30 pt-4">
                <label className="block text-sm font-medium text-ui-textSecondary mb-4">
                  Wizualizacja obszaru zabiegu
                </label>
                <div className="bg-black/20 rounded-xl border border-emerald/20 p-6 flex justify-center pointer-events-none">
                  <div className="w-full max-w-lg aspect-square relative">
                    <AnatomyFaceSelector
                      initialSelected={
                        form.obszarZabiegu
                          ? form.obszarZabiegu.split(",").map((s) => s.trim())
                          : []
                      }
                    />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-ui-textSecondary mb-1">
                  Cel / efekt
                </label>
                {isEditing ? (
                  <textarea
                    value={editedForm.celEfektu || ""}
                    onChange={(e) =>
                      setEditedForm({
                        ...editedForm,
                        celEfektu: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 bg-black/40 border border-emerald/30 rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none text-white resize-none h-20"
                    placeholder="Cel zabiegu"
                  />
                ) : (
                  <p className="text-white">{form.celEfektu || "Nie podano"}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-ui-textSecondary mb-1">
                  Uwagi Dodatkowe
                </label>

                {/* Logic to separate history/meds from notes */}
                {(() => {
                  const rawNotes = form.informacjaDodatkowa || "";
                  const lines = rawNotes.split("\n");
                  const historyInfo: string[] = [];
                  const medications: string[] = [];
                  const otherNotes: string[] = [];

                  lines.forEach((line) => {
                    const trimmed = line.trim();
                    if (!trimmed) return;

                    if (
                      trimmed.startsWith("Usta modelowane") ||
                      trimmed.startsWith("Zabieg wykonywany")
                    ) {
                      historyInfo.push(trimmed);
                    } else if (trimmed.startsWith("Leki (6 m-cy):")) {
                      medications.push(trimmed);
                    } else {
                      otherNotes.push(trimmed);
                    }
                  });

                  return (
                    <div className="space-y-4">
                      {/* 1. History Section */}
                      {historyInfo.length > 0 && (
                        <div className="bg-blue-500/10 p-4 rounded-lg border border-blue-500/20">
                          <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wide mb-2 flex items-center gap-2">
                            <Calendar className="w-3 h-3" />
                            Historia Zabiegów (z wywiadu)
                          </h4>
                          <ul className="list-disc list-inside space-y-1">
                            {historyInfo.map((info, i) => (
                              <li
                                key={i}
                                className="text-sm text-blue-100 font-medium"
                              >
                                {info}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* 2. Medications Section */}
                      {medications.length > 0 && (
                        <div className="bg-red-500/10 p-4 rounded-lg border border-red-500/20">
                          <h4 className="text-xs font-bold text-red-400 uppercase tracking-wide mb-2 flex items-center gap-2">
                            <User className="w-3 h-3" />
                            Przyjmowane Leki (ostatnie 6 m-cy)
                          </h4>
                          <ul className="list-disc list-inside space-y-1">
                            {medications.map((med, i) => (
                              <li
                                key={i}
                                className="text-sm text-red-100 font-medium"
                              >
                                {med.replace("Leki (6 m-cy):", "").trim() ||
                                  "BRAK"}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* 3. General Notes */}
                      <div className="bg-black/20 p-3 rounded-lg border border-emerald/20 min-h-[60px]">
                        {otherNotes.length > 0 ? (
                          <div className="text-white text-sm whitespace-pre-line">
                            {otherNotes.join("\n")}
                          </div>
                        ) : (
                          <p className="text-ui-textSecondary text-sm italic">
                            Brak dodatkowych uwag.
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Tab Content: Contraindications */}
        {activeTab === "contraindications" && (
          <div className="bg-gradient-emerald backdrop-blur-sm rounded-2xl shadow-lg p-4 md:p-8 animate-in fade-in slide-in-from-bottom-2 duration-300 border border-emerald/20">
            <h2 className="text-xl font-serif text-white mb-4 pb-3 border-b border-emerald/30">
              Przeciwwskazania
            </h2>
            <div className="space-y-2">
              {Object.entries(form.przeciwwskazania).map(([key, value]) => {
                const labels =
                  contraindicationsByFormType[form.type as FormType] ||
                  contraindicationsByFormType["LIP_AUGMENTATION"];
                const label = labels[key] || key;
                const currentValue =
                  editedForm.przeciwwskazania?.[key] ?? value;

                return (
                  <div
                    key={key}
                    className="flex items-center gap-3 py-2 border-b border-emerald/10 last:border-0"
                  >
                    {isEditing ? (
                      <div className="flex gap-1 flex-shrink-0">
                        {/* Edycja jest uproszczona - tylko bool, dla tekstowych trzeba by dodać input */}
                        <button
                          type="button"
                          onClick={() =>
                            setEditedForm({
                              ...editedForm,
                              przeciwwskazania: {
                                ...editedForm.przeciwwskazania,
                                [key]: true,
                              },
                            })
                          }
                          className={`min-w-[40px] text-center px-2 py-1 text-xs rounded font-medium transition-colors ${
                            currentValue === true ||
                            typeof currentValue === "string"
                              ? "bg-red-500 text-white"
                              : "bg-red-100 text-red-600 hover:bg-red-200"
                          }`}
                        >
                          TAK
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setEditedForm({
                              ...editedForm,
                              przeciwwskazania: {
                                ...editedForm.przeciwwskazania,
                                [key]: false,
                              },
                            })
                          }
                          className={`min-w-[40px] text-center px-2 py-1 text-xs rounded font-medium transition-colors ${
                            currentValue === false
                              ? "bg-green-500 text-white"
                              : "bg-green-100 text-green-600 hover:bg-green-200"
                          }`}
                        >
                          NIE
                        </button>
                      </div>
                    ) : (
                      <>
                        {typeof value === "string" ? (
                          <div className="flex flex-col items-start gap-1">
                            <span className="min-w-[44px] text-center px-2 py-1 bg-red-100 text-red-600 text-xs rounded font-medium flex-shrink-0">
                              TAK
                            </span>
                            <span className="text-xs text-brand font-medium italic">
                              "{value}"
                            </span>
                          </div>
                        ) : value === true ? (
                          <span className="min-w-[44px] text-center px-2 py-1 bg-red-100 text-red-600 text-xs rounded font-medium flex-shrink-0">
                            TAK
                          </span>
                        ) : value === false ? (
                          <span className="min-w-[44px] text-center px-2 py-1 bg-green-100 text-green-600 text-xs rounded font-medium flex-shrink-0">
                            NIE
                          </span>
                        ) : (
                          <span className="min-w-[44px] text-center px-2 py-1 bg-gray-100 text-gray-500 text-xs rounded font-medium flex-shrink-0">
                            -
                          </span>
                        )}
                      </>
                    )}
                    <span className="text-sm text-white">
                      {typeof label === "string" ? label : label.text}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab Content: Consents & Signatures (New Card Style) */}
        {activeTab === "consents" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* RODO / Główne */}
            <div className="bg-gradient-emerald backdrop-blur-sm rounded-2xl shadow-lg border border-emerald/20 p-6">
              <div className="flex justify-between items-center mb-4 border-b border-emerald/30 pb-2 text-white font-serif">
                Zgoda RODO
                <span
                  className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-wider ${form.podpisRodo ? "bg-green-500/20 text-green-400 border border-green-500/30" : "bg-red-500/20 text-red-400 border border-red-500/30"}`}
                >
                  {form.podpisRodo ? "PODPISANO" : "BRAK ZGODY/PODPISU"}
                </span>
              </div>
              <div className="flex items-start gap-4 mb-4">
                {form.zgodaPrzetwarzanieDanych ? (
                  <Check className="w-5 h-5 text-green-400 mt-0.5" />
                ) : (
                  <X className="w-5 h-5 text-red-400 mt-0.5" />
                )}
                <p className="text-sm text-ui-textSecondary">
                  Potwierdzenie: Świadoma zgoda na zabieb oraz przetwarzanie
                  danych w celach realizacji usługi.
                </p>
              </div>

              {form.podpisRodo ? (
                <div className="p-4 rounded-xl bg-black/30 border border-emerald/10">
                  <p className="text-xs text-ui-textSecondary uppercase tracking-wider mb-2 font-medium">
                    Podpis RODO
                  </p>
                  <img
                    src={form.podpisRodo}
                    alt="Podpis RODO"
                    className="h-40 object-contain mx-auto md:mx-0 invert brightness-200"
                  />
                </div>
              ) : (
                <div className="bg-red-500/10 p-4 rounded-xl border border-red-500/20 text-red-400 text-sm italic">
                  Brak podpisu głównego.
                </div>
              )}
            </div>

            {/* RODO Clause (Section 2) */}
            <div className="bg-gradient-emerald backdrop-blur-sm rounded-2xl shadow-lg border border-emerald/20 p-6">
              <div className="flex justify-between items-center mb-4 border-b border-emerald/30 pb-2 text-white font-serif">
                Klauzula Informacyjna RODO
                <span
                  className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-wider ${
                    (form as any).podpisRodo2
                      ? "bg-green-500/20 text-green-400 border border-green-500/30"
                      : "bg-red-500/20 text-red-400 border border-red-500/30"
                  }`}
                >
                  {(form as any).podpisRodo2 ? "PODPISANO" : "BRAK PODPISU"}
                </span>
              </div>
              <p className="text-sm text-ui-textSecondary mb-4">
                Potwierdzenie: Zapoznanie się z klauzulą informacyjną RODO.
              </p>
              {(form as any).podpisRodo2 ? (
                <div className="p-4 rounded-xl bg-black/30 border border-emerald/10">
                  <p className="text-xs text-ui-textSecondary uppercase tracking-wider mb-2 font-medium">
                    Podpis RODO (Klauzula)
                  </p>
                  <img
                    src={(form as any).podpisRodo2}
                    alt="Podpis RODO 2"
                    className="h-40 object-contain mx-auto md:mx-0 invert brightness-200"
                  />
                </div>
              ) : (
                <div className="bg-red-500/10 p-4 rounded-xl border border-red-500/20 text-red-400 text-sm italic">
                  Brak podpisu klauzuli.
                </div>
              )}
            </div>

            {/* Marketing */}
            <div className="bg-gradient-emerald backdrop-blur-sm rounded-2xl shadow-lg border border-emerald/20 p-6">
              <div className="flex justify-between items-center mb-4 border-b border-emerald/30 pb-2">
                <h3 className="text-lg font-serif text-white">
                  Zgoda Marketingowa
                </h3>
                <span
                  className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-wider ${form.zgodaMarketing ? "bg-green-500/20 text-green-400 border border-green-500/30" : "bg-ui-appBg text-ui-textSecondary border border-emerald/30"}`}
                >
                  {form.zgodaMarketing ? "WYRAŻONO ZGODĘ" : "BRAK ZGODY"}
                </span>
              </div>
              <p className="text-sm text-ui-textSecondary mb-4">
                Zgoda na otrzymywanie informacji o nowościach i promocjach
                (SMS/Email).
              </p>
              {form.zgodaMarketing && form.podpisMarketing ? (
                <div className="p-4 rounded-xl bg-black/30 border border-emerald/10">
                  <p className="text-xs text-ui-textSecondary uppercase tracking-wider mb-2 font-medium">
                    Podpis Marketingowy
                  </p>
                  <img
                    src={form.podpisMarketing}
                    alt="Podpis Marketing"
                    className="h-40 object-contain mx-auto md:mx-0 invert brightness-200"
                  />
                </div>
              ) : (
                <p className="text-sm text-ui-textSecondary italic">
                  Klient nie wyraził zgody.
                </p>
              )}
            </div>

            {/* Wizerunek */}
            <div className="bg-gradient-emerald backdrop-blur-sm rounded-2xl shadow-lg border border-emerald/20 p-6">
              <div className="flex justify-between items-center mb-4 border-b border-emerald/30 pb-2">
                <h3 className="text-lg font-serif text-white">
                  Zgoda na Wizerunek
                </h3>
                <span
                  className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-wider ${form.zgodaFotografie ? "bg-green-500/20 text-green-400 border border-green-500/30" : "bg-ui-appBg text-ui-textSecondary border border-emerald/30"}`}
                >
                  {form.zgodaFotografie ? "WYRAŻONO ZGODĘ" : "BRAK ZGODY"}
                </span>
              </div>
              <p className="text-sm text-ui-textSecondary mb-2">
                Zgoda na publikację zdjęć/wideo z zabiegu.
              </p>
              {form.miejscaPublikacjiFotografii && (
                <p className="text-sm text-white mb-4 font-medium">
                  Ograniczenia publikacji:{" "}
                  <span className="text-brand">
                    {form.miejscaPublikacjiFotografii}
                  </span>
                </p>
              )}
              {form.zgodaFotografie && form.podpisFotografie ? (
                <div className="p-4 rounded-xl bg-black/30 border border-emerald/10">
                  <p className="text-xs text-ui-textSecondary uppercase tracking-wider mb-2 font-medium">
                    Podpis Wizerunek
                  </p>
                  <img
                    src={form.podpisFotografie}
                    alt="Podpis Foto"
                    className="h-40 object-contain mx-auto md:mx-0 invert brightness-200"
                  />
                </div>
              ) : (
                <p className="text-sm text-ui-textSecondary italic">
                  Klient nie wyraził zgody.
                </p>
              )}
            </div>

            {/* Zgoda na Zabieg (dawniej Pomoc Prawna) */}
            <div className="bg-gradient-emerald backdrop-blur-sm rounded-2xl shadow-lg border border-emerald/20 p-6">
              <div className="flex justify-between items-center mb-4 border-b border-emerald/30 pb-2">
                <h3 className="text-lg font-serif text-white">
                  Zgoda na Zabieg
                </h3>
                <span
                  className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-wider ${form.zgodaPomocPrawna ? "bg-green-500/20 text-green-400 border border-green-500/30" : "bg-ui-appBg text-ui-textSecondary border border-emerald/30"}`}
                >
                  {form.zgodaPomocPrawna ? "WYRAŻONO ZGODĘ" : "BRAK ZGODY"}
                </span>
              </div>
              <p className="text-sm text-ui-textSecondary mb-4">
                Potwierdzenie: Świadoma zgoda na przeprowadzenie zabiegu po
                zapoznaniu się z informacjami i ryzykiem.
              </p>
              {form.zgodaPomocPrawna && form.podpisDane ? (
                <div className="p-4 rounded-xl bg-black/30 border border-emerald/10">
                  <p className="text-xs text-ui-textSecondary uppercase tracking-wider mb-2 font-medium">
                    Podpis Klienta
                  </p>
                  <img
                    src={form.podpisDane}
                    alt="Podpis Zabieg"
                    className="h-40 object-contain mx-auto md:mx-0 invert brightness-200"
                  />
                </div>
              ) : (
                <p className="text-sm text-ui-textSecondary italic">
                  Klient nie wyraził zgody.
                </p>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
