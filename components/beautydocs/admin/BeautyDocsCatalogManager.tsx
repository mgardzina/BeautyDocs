"use client";

import {
  Check,
  Cpu,
  Eye,
  FlaskConical,
  LoaderCircle,
  PackagePlus,
  PackageSearch,
  Pencil,
  Pill,
  Plus,
  Sparkles,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { BeautyDocsCatalogSafety } from "@/components/beautydocs/BeautyDocsCatalogSafety";
import { BeautyDocsPublicCatalog } from "@/components/beautydocs/catalog/BeautyDocsPublicCatalog";
import {
  BeautyDocsProductDetailsDialog,
  isProfessionalCatalogProduct,
  ProductPackVisual,
} from "@/components/beautydocs/BeautyDocsProductDetailsDialog";
import type { BeautyDocsAdminFormList } from "@/types/beautydocs-admin";
import type {
  BeautyDocsCatalogItem,
  BeautyDocsCatalogKind,
  BeautyDocsSalonCatalog,
  BeautyDocsSalonCatalogCreate,
  BeautyDocsSalonCatalogItem,
  BeautyDocsSalonCatalogUpdate,
} from "@/types/beautydocs-catalog";

const kindOptions: readonly {
  readonly value: BeautyDocsCatalogKind | "ALL";
  readonly label: string;
  readonly shortLabel: string;
  readonly icon: LucideIcon;
}[] = [
  { value: "ALL", label: "Wszystko", shortLabel: "Wszystko", icon: PackageSearch },
  { value: "MEDICINE", label: "Leki", shortLabel: "Lek", icon: Pill },
  {
    value: "TREATMENT_SUBSTANCE",
    label: "Preparaty zabiegowe",
    shortLabel: "Preparat",
    icon: FlaskConical,
  },
  { value: "DEVICE", label: "Urządzenia", shortLabel: "Urządzenie", icon: Cpu },
  { value: "COSMETIC", label: "Kosmetyki", shortLabel: "Kosmetyk", icon: Sparkles },
];

interface SelectionDraft {
  readonly sourceItem: BeautyDocsCatalogItem | BeautyDocsSalonCatalogItem;
  readonly salonItemId: string | null;
  usedInTreatments: boolean;
  recommendedAftercare: boolean;
  treatmentCodes: string[];
  recommendationNote: string;
}

function useCatalogDialogScrollLock() {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);
}

export function BeautyDocsCatalogManager({
  forms,
  initialCatalog,
  tenantSlug,
}: {
  readonly forms: BeautyDocsAdminFormList;
  readonly initialCatalog: BeautyDocsSalonCatalog;
  readonly tenantSlug: string;
}) {
  const [catalog, setCatalog] = useState(initialCatalog);
  const [products, setProducts] = useState<readonly BeautyDocsCatalogItem[] | null>(null);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [selectedSalonProduct, setSelectedSalonProduct] =
    useState<BeautyDocsSalonCatalogItem | null>(null);
  const [draft, setDraft] = useState<SelectionDraft | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/beautydocs-preview/catalog/products", {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!response.ok) throw new Error(String(response.status));
        const body = (await response.json()) as { items: BeautyDocsCatalogItem[] };
        if (!cancelled) setProducts(body.items);
      } catch {
        if (!cancelled) setProductsError("Nie udało się pobrać katalogu. Spróbuj ponownie.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedExternalIds = useMemo(
    () => new Set(catalog.items.map((item) => item.externalId).filter(Boolean)),
    [catalog.items],
  );
  const activeForms = forms.forms.filter((form) => form.enabled);

  async function saveDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;
    setSaving(true);
    setMessage(null);
    const payload: BeautyDocsSalonCatalogUpdate = {
      usedInTreatments: draft.usedInTreatments,
      recommendedAftercare: draft.recommendedAftercare,
      treatmentCodes: draft.treatmentCodes,
      recommendationNote: draft.recommendationNote.trim() || null,
    };
    const base = `/api/beautydocs-preview/admin/tenants/${encodeURIComponent(tenantSlug)}/catalog`;
    const isEdit = draft.salonItemId !== null;
    const response = await fetch(
      isEdit ? `${base}/${encodeURIComponent(draft.salonItemId ?? "")}` : base,
      {
        method: isEdit ? "PUT" : "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          isEdit ? payload : createPayload(draft.sourceItem, payload),
        ),
      },
    );
    setSaving(false);
    if (!response.ok) {
      setMessage(
        response.status === 422
          ? "Kosmetyki pozabiegowe i przypisania muszą mieć prawidłowe ustawienia."
          : "Nie udało się zapisać pozycji w katalogu salonu.",
      );
      return;
    }
    const saved = (await response.json()) as BeautyDocsSalonCatalogItem;
    setCatalog((current) => ({
      ...current,
      items: [...current.items.filter((item) => item.id !== saved.id), saved].sort(
        (left, right) => left.name.localeCompare(right.name, "pl"),
      ),
    }));
    setDraft(null);
    setMessage("Katalog salonu został zaktualizowany.");
  }

  async function removeItem(item: BeautyDocsSalonCatalogItem) {
    if (!window.confirm(`Usunąć „${item.name}” z katalogu salonu?`)) return;
    setSaving(true);
    const response = await fetch(
      `/api/beautydocs-preview/admin/tenants/${encodeURIComponent(tenantSlug)}` +
        `/catalog/${encodeURIComponent(item.id)}`,
      { method: "DELETE", credentials: "same-origin" },
    );
    setSaving(false);
    if (!response.ok) {
      setMessage("Nie udało się usunąć pozycji.");
      return;
    }
    setCatalog((current) => ({
      ...current,
      items: current.items.filter((candidate) => candidate.id !== item.id),
    }));
    setMessage("Pozycja została usunięta z katalogu salonu.");
  }

  return (
    <div className="space-y-6">
      <header className="overflow-hidden rounded-[30px] border border-[#e2e7da] bg-[#263328] px-6 py-7 text-white shadow-[0_22px_60px_rgba(39,61,56,0.16)] sm:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#d1e3b8]">
              Baza wiedzy salonu
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] sm:text-4xl">
              Produkty i urządzenia
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/65">
              Wyszukuj leki w oficjalnym RPL, zapisuj preparaty i dokładne modele
              urządzeń oraz twórz przejrzyste zalecenia pielęgnacji pozabiegowej.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <CatalogStat label="W katalogu" value={catalog.items.length} />
            <CatalogStat
              label="Do zabiegów"
              value={catalog.items.filter((item) => item.usedInTreatments).length}
            />
            <CatalogStat
              label="Po zabiegu"
              value={catalog.items.filter((item) => item.recommendedAftercare).length}
            />
          </div>
        </div>
      </header>

      {message ? (
        <p className="rounded-2xl border border-[#d7dfcc] bg-white px-4 py-3 text-sm font-bold text-[#457267]" role="status">
          {message}
        </p>
      ) : null}

      <section className="rounded-[28px] border border-[#e2e7da] bg-white p-5 shadow-[0_12px_35px_rgba(45,69,63,0.06)] sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#5b9889]">
              Wspólny katalog BeautyDocs
            </p>
            <h2 className="mt-1 text-xl font-black text-[#173d35]">Znajdź pozycję</h2>
            <p className="mt-1 text-sm leading-6 text-stone-500">
              Ten sam katalog co na publicznej stronie — przeglądaj cały
              asortyment albo wyszukaj konkretną pozycję.
            </p>
          </div>
          {catalog.canManage ? (
            <button
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#d0d9c3] bg-[#f8faf5] px-4 py-3 text-sm font-black text-[#46776b] transition hover:bg-[#edf2e5]"
              onClick={() => setCustomOpen(true)}
              type="button"
            >
              <PackagePlus className="size-4" /> Dodaj własny produkt lub urządzenie
            </button>
          ) : null}
        </div>

        {productsError ? (
          <p className="mt-5 text-sm font-bold text-red-700" role="alert">
            {productsError}
          </p>
        ) : products === null ? (
          <div className="mt-5 flex items-center justify-center gap-2 rounded-2xl border border-[#e1e6da] bg-white py-14 text-sm font-bold text-stone-600">
            <LoaderCircle className="size-5 animate-spin text-[#245c4d]" /> Wczytywanie katalogu…
          </div>
        ) : (
          <div className="-mx-5 mt-5 sm:-mx-6">
            <BeautyDocsPublicCatalog
              items={products}
              renderItemAction={
                catalog.canManage
                  ? (item) => {
                      const alreadySelected = selectedExternalIds.has(item.externalId);
                      return (
                        <button
                          className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#173d35] px-3 py-2.5 text-xs font-black text-white transition hover:bg-[#245c4d] disabled:bg-stone-200 disabled:text-stone-500"
                          disabled={alreadySelected}
                          onClick={() => setDraft(newSelectionDraft(item))}
                          type="button"
                        >
                          {alreadySelected ? (
                            <Check className="size-3.5" />
                          ) : (
                            <Plus className="size-3.5" />
                          )}
                          {alreadySelected ? "W katalogu salonu" : "Dodaj do salonu"}
                        </button>
                      );
                    }
                  : undefined
              }
              stayInPanel
            />
          </div>
        )}
      </section>

      <section className="rounded-[28px] border border-[#e2e7da] bg-white p-5 shadow-[0_12px_35px_rgba(45,69,63,0.05)] sm:p-6">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#5b9889]">
            Wybrane przez salon
          </p>
          <h2 className="mt-1 text-xl font-black text-[#173d35]">Katalog salonu</h2>
          <p className="mt-1 text-sm leading-6 text-stone-500">
            Przypisanie do zabiegów opisuje ofertę salonu. Nie oznacza, że dana
            pozycja została użyta podczas konkretnej wizyty.
          </p>
        </div>
        <div className="mt-5 grid gap-3 xl:grid-cols-2">
          {catalog.items.map((item) => (
            <SalonItemCard
              canManage={catalog.canManage}
              forms={activeForms}
              item={item}
              key={item.id}
              onEdit={() => setDraft(editSelectionDraft(item))}
              onRemove={() => void removeItem(item)}
              onView={() => setSelectedSalonProduct(item)}
            />
          ))}
        </div>
        {catalog.items.length === 0 ? (
          <p className="mt-5 rounded-2xl border border-dashed border-[#d4d9cc] p-8 text-center text-sm text-stone-500">
            Katalog salonu jest pusty. Wyszukaj pierwszą pozycję powyżej.
          </p>
        ) : null}
      </section>

      {draft ? (
        <CatalogSettingsDialog
          draft={draft}
          forms={activeForms}
          onChange={setDraft}
          onClose={() => setDraft(null)}
          onSubmit={saveDraft}
          saving={saving}
        />
      ) : null}
      {customOpen ? (
        <CustomCatalogDialog
          forms={activeForms}
          onClose={() => setCustomOpen(false)}
          onSaved={(saved) => {
            setCatalog((current) => ({ ...current, items: [...current.items, saved] }));
            setCustomOpen(false);
            setMessage("Własna pozycja została dodana do katalogu salonu.");
          }}
          tenantSlug={tenantSlug}
        />
      ) : null}
      {selectedSalonProduct ? (
        <BeautyDocsProductDetailsDialog
          item={selectedSalonProduct}
          onClose={() => setSelectedSalonProduct(null)}
          onPrimaryAction={
            catalog.canManage
              ? () => {
                  setDraft(editSelectionDraft(selectedSalonProduct));
                  setSelectedSalonProduct(null);
                }
              : undefined
          }
          primaryActionLabel="Ustawienia produktu"
        />
      ) : null}
    </div>
  );
}

function SalonItemCard({
  canManage,
  forms,
  item,
  onEdit,
  onRemove,
  onView,
}: {
  readonly canManage: boolean;
  readonly forms: BeautyDocsAdminFormList["forms"];
  readonly item: BeautyDocsSalonCatalogItem;
  readonly onEdit: () => void;
  readonly onRemove: () => void;
  readonly onView: () => void;
}) {
  const meta = kindMeta(item.kind);
  const Icon = meta.icon;
  const treatmentNames = item.treatmentCodes.map(
    (code) => forms.find((form) => form.code === code)?.name ?? code,
  );
  const professionalProduct = isProfessionalCatalogProduct(item);
  const presentation = productDetailText(item.details, "presentation") ?? "Sprawdź etykietę";
  const family = productDetailText(item.details, "productFamily") ?? meta.label;
  const imagePath = productDetailText(item.details, "imagePath");
  const imageAlt = productDetailText(item.details, "imageAlt") ?? item.name;

  if (professionalProduct) {
    return (
      <article className="font-catalog overflow-hidden rounded-[24px] border border-[#dfe5d7] bg-white p-3 shadow-[0_12px_28px_rgba(42,66,60,0.07)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(42,66,60,0.11)]">
        <div className="grid gap-4 sm:grid-cols-[142px_minmax(0,1fr)]">
          <button className="text-left" onClick={onView} type="button">
            <ProductPackVisual
              brand={item.brand ?? "BeautyDocs"}
              compact
              family={family}
              imageAlt={imageAlt}
              imagePath={imagePath}
              kind={item.kind}
              name={item.name}
              presentation={presentation}
            />
          </button>
          <div className="flex min-w-0 flex-col py-1 pr-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase ${meta.tone}`}>{meta.label}</span>
              {item.usedInTreatments ? <Tag>Przy zabiegu</Tag> : null}
              {item.recommendedAftercare ? <Tag>Po zabiegu</Tag> : null}
            </div>
            <p className="mt-3 text-[10px] font-extrabold uppercase tracking-[0.12em] text-stone-400">{item.brand}</p>
            <button className="mt-1 text-left text-base font-extrabold leading-5 text-[#173d35] hover:text-[#245c4d]" onClick={onView} type="button">{item.name}</button>
            <p className="mt-2 line-clamp-2 text-xs leading-5 text-stone-500">
              {treatmentNames.length > 0 ? `Zabiegi: ${treatmentNames.join(", ")}` : "Dotyczy wszystkich zabiegów"}
            </p>
            <div className="mt-auto flex items-center gap-2 border-t border-[#eaeee5] pt-3">
              <button className="inline-flex items-center gap-1.5 rounded-xl border border-[#d0d8c5] bg-white px-3 py-2 text-[11px] font-extrabold text-[#47776b] transition hover:bg-[#f7faf3]" onClick={onView} type="button"><Eye className="size-3.5" /> Zobacz produkt</button>
              {canManage ? (
                <div className="ml-auto flex gap-1">
                  <button aria-label={`Edytuj ${item.name}`} className="rounded-lg p-2 text-stone-400 hover:bg-[#f0f5e9] hover:text-[#245c4d]" onClick={onEdit} type="button"><Pencil className="size-4" /></button>
                  <button aria-label={`Usuń ${item.name}`} className="rounded-lg p-2 text-stone-400 hover:bg-red-50 hover:text-red-700" onClick={onRemove} type="button"><Trash2 className="size-4" /></button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
        <BeautyDocsCatalogSafety compact item={item} />
      </article>
    );
  }

  return (
    <article className="rounded-2xl border border-[#e0e5d9] p-4">
      <div className="flex items-start gap-3">
        <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${meta.tone}`}>
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-1.5">
            <span className="rounded-full bg-stone-100 px-2 py-1 text-[9px] font-black uppercase text-stone-600">{meta.label}</span>
            {item.usedInTreatments ? <Tag>Wykorzystywane przy zabiegu</Tag> : null}
            {item.recommendedAftercare ? <Tag>Po zabiegu</Tag> : null}
            {item.isSponsored ? <Tag sponsor>Materiał sponsorowany</Tag> : null}
          </div>
          <h3 className="mt-2 text-sm font-black text-[#173d35]">{item.name}</h3>
          {item.brand ? <p className="mt-0.5 text-xs text-stone-500">{item.brand}</p> : null}
          {treatmentNames.length > 0 ? (
            <p className="mt-2 text-[11px] leading-5 text-stone-500">
              Zabiegi: {treatmentNames.join(", ")}
            </p>
          ) : (
            <p className="mt-2 text-[11px] text-stone-400">Dotyczy wszystkich zabiegów</p>
          )}
          {item.recommendationNote ? (
            <p className="mt-2 rounded-xl bg-[#f8faf5] px-3 py-2 text-xs leading-5 text-[#173d35]">
              {item.recommendationNote}
            </p>
          ) : null}
        </div>
        {canManage ? (
          <div className="flex shrink-0 gap-1">
            <button aria-label={`Edytuj ${item.name}`} className="rounded-lg p-2 text-stone-400 hover:bg-[#f0f5e9] hover:text-[#245c4d]" onClick={onEdit} type="button"><Pencil className="size-4" /></button>
            <button aria-label={`Usuń ${item.name}`} className="rounded-lg p-2 text-stone-400 hover:bg-red-50 hover:text-red-700" onClick={onRemove} type="button"><Trash2 className="size-4" /></button>
          </div>
        ) : null}
      </div>
      <BeautyDocsCatalogSafety compact item={item} />
    </article>
  );
}

function CatalogSettingsDialog({
  draft,
  forms,
  onChange,
  onClose,
  onSubmit,
  saving,
}: {
  readonly draft: SelectionDraft;
  readonly forms: BeautyDocsAdminFormList["forms"];
  readonly onChange: (draft: SelectionDraft) => void;
  readonly onClose: () => void;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  readonly saving: boolean;
}) {
  const isCosmetic = draft.sourceItem.kind === "COSMETIC";
  useCatalogDialogScrollLock();
  return createPortal(
    <div
      className="fixed inset-0 z-[200] grid items-end overflow-hidden bg-[#173d35]/40 p-0 backdrop-blur-[1.5px] sm:place-items-center sm:bg-[#173d35]/50 sm:p-8"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <form
        className="flex max-h-[calc(100dvh-0.5rem)] w-full max-w-4xl flex-col overflow-hidden rounded-t-[28px] border border-white/80 bg-white shadow-[0_-18px_55px_rgba(23,61,53,0.24)] sm:max-h-[calc(100dvh-6rem)] sm:rounded-[28px] sm:shadow-2xl xl:max-h-[780px]"
        onClick={(event) => event.stopPropagation()}
        onSubmit={onSubmit}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[#eaeee5] bg-white px-4 py-4 sm:px-6 sm:py-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5b9889]">Ustawienia pozycji</p>
            <h2 className="mt-1 text-xl font-black text-[#173d35]">{draft.sourceItem.name}</h2>
          </div>
          <button aria-label="Zamknij" className="rounded-xl bg-stone-100 p-2.5 text-stone-500" onClick={onClose} type="button"><X className="size-5" /></button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain bg-[#fdfffb] px-4 py-5 sm:p-5">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex items-start gap-3 rounded-2xl border border-[#dfe4d8] p-4">
              <input checked={draft.usedInTreatments} className="mt-1 size-4 accent-[#245c4d]" onChange={(event) => onChange({ ...draft, usedInTreatments: event.target.checked })} type="checkbox" />
              <span><strong className="block text-sm text-[#173d35]">Wykorzystywane przy zabiegach</strong><span className="mt-1 block text-xs leading-5 text-stone-500">Pozycja pojawi się w katalogu wyposażenia i preparatów salonu.</span></span>
            </label>
            <label className={`flex items-start gap-3 rounded-2xl border p-4 ${isCosmetic ? "border-[#dfe4d8]" : "border-stone-200 bg-stone-50 opacity-60"}`}>
              <input checked={draft.recommendedAftercare} className="mt-1 size-4 accent-[#245c4d]" disabled={!isCosmetic} onChange={(event) => onChange({ ...draft, recommendedAftercare: event.target.checked })} type="checkbox" />
              <span><strong className="block text-sm text-[#173d35]">Polecane po zabiegu</strong><span className="mt-1 block text-xs leading-5 text-stone-500">Klientka zobaczy kosmetyk przy zakończonym formularzu. W pierwszej wersji dotyczy wyłącznie kosmetyków.</span></span>
            </label>
          </div>
          <fieldset>
            <legend className="text-xs font-black uppercase tracking-[0.1em] text-[#516d55]">Przypisz do zabiegów</legend>
            <p className="mt-1 text-[11px] text-stone-500">Brak zaznaczenia oznacza wszystkie zabiegi.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {forms.map((form) => (
                <label className="flex items-center gap-2 rounded-xl border border-[#e0e5da] px-3 py-2.5 text-xs font-bold text-stone-600" key={form.code}>
                  <input checked={draft.treatmentCodes.includes(form.code)} className="size-4 accent-[#245c4d]" onChange={() => onChange({ ...draft, treatmentCodes: toggleCode(draft.treatmentCodes, form.code) })} type="checkbox" />
                  {form.name}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="block text-xs font-black uppercase tracking-[0.1em] text-[#516d55]">
            Informacja dla klientki
            <textarea className="mt-2 min-h-20 w-full rounded-2xl border border-[#d9ded1] px-4 py-3 text-sm font-semibold normal-case tracking-normal outline-none focus:border-[#547b59] focus:ring-4 focus:ring-[#245c4d]/10" maxLength={2000} onChange={(event) => onChange({ ...draft, recommendationNote: event.target.value })} placeholder="Np. sposób stosowania przekazany przez salon…" value={draft.recommendationNote} />
          </label>
        </div>
        <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-[#eaeee5] bg-white px-4 py-3 sm:flex sm:justify-end sm:px-6 sm:py-4">
          <button className="w-full rounded-xl px-4 py-2.5 text-sm font-black text-stone-500 sm:w-auto" onClick={onClose} type="button">Anuluj</button>
          <button className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#173d35] px-5 py-2.5 text-sm font-black text-white disabled:opacity-50 sm:w-auto" disabled={saving} type="submit">{saving ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />} Zapisz</button>
        </div>
      </form>
    </div>,
    document.body,
  );
}

function CustomCatalogDialog({
  forms,
  onClose,
  onSaved,
  tenantSlug,
}: {
  readonly forms: BeautyDocsAdminFormList["forms"];
  readonly onClose: () => void;
  readonly onSaved: (item: BeautyDocsSalonCatalogItem) => void;
  readonly tenantSlug: string;
}) {
  useCatalogDialogScrollLock();
  const [kind, setKind] = useState<Exclude<BeautyDocsCatalogKind, "MEDICINE">>("DEVICE");
  const [usedInTreatments, setUsedInTreatments] = useState(true);
  const [recommendedAftercare, setRecommendedAftercare] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setSaving(true);
    setError(null);
    const treatmentCodes = forms.filter((form) => data.getAll("treatmentCodes").includes(form.code)).map((form) => form.code);
    const payload: BeautyDocsSalonCatalogCreate = {
      source: "SALON",
      externalId: null,
      kind,
      name: String(data.get("name") ?? "").trim(),
      brand: String(data.get("brand") ?? "").trim() || null,
      summary: String(data.get("summary") ?? "").trim() || null,
      details: {},
      sourceLabel: "Dane wprowadzone przez salon",
      sourceUrl: null,
      usedInTreatments,
      recommendedAftercare: kind === "COSMETIC" && recommendedAftercare,
      treatmentCodes,
      recommendationNote: String(data.get("recommendationNote") ?? "").trim() || null,
    };
    const response = await fetch(`/api/beautydocs-preview/admin/tenants/${encodeURIComponent(tenantSlug)}/catalog`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (!response.ok) {
      setError("Nie udało się dodać pozycji. Sprawdź podane dane.");
      return;
    }
    onSaved((await response.json()) as BeautyDocsSalonCatalogItem);
  }
  return createPortal(
    <div
      className="fixed inset-0 z-[200] grid items-end overflow-hidden bg-[#173d35]/40 p-0 backdrop-blur-[1.5px] sm:place-items-center sm:bg-[#173d35]/50 sm:p-8"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <form
        className="flex max-h-[calc(100dvh-0.5rem)] w-full max-w-4xl flex-col overflow-hidden rounded-t-[28px] border border-white/80 bg-white shadow-[0_-18px_55px_rgba(23,61,53,0.24)] sm:max-h-[calc(100dvh-6rem)] sm:rounded-[28px] sm:shadow-2xl xl:max-h-[780px]"
        onClick={(event) => event.stopPropagation()}
        onSubmit={submit}
      >
        <div className="flex shrink-0 items-start justify-between border-b border-[#eaeee5] bg-white px-4 py-4 sm:px-6 sm:py-4">
          <div><p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5b9889]">Własny katalog</p><h2 className="mt-1 text-xl font-black">Dodaj dokładną pozycję</h2></div>
          <button aria-label="Zamknij" className="rounded-xl bg-stone-100 p-2.5" onClick={onClose} type="button"><X className="size-5" /></button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain bg-[#fdfffb] px-4 py-5 sm:p-5">
          <label className="block text-xs font-black text-[#394d3c]">Typ<select className="mt-2 w-full rounded-xl border border-[#d9ded2] px-4 py-3 text-sm" onChange={(event) => {
            const nextKind = event.target.value as typeof kind;
            setKind(nextKind);
            setUsedInTreatments(nextKind !== "COSMETIC");
            if (nextKind !== "COSMETIC") setRecommendedAftercare(false);
          }} value={kind}><option value="DEVICE">Urządzenie</option><option value="TREATMENT_SUBSTANCE">Preparat / substancja zabiegowa</option><option value="COSMETIC">Kosmetyk</option></select></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <CatalogInput label={kind === "DEVICE" ? "Producent i model *" : "Nazwa produktu *"} name="name" placeholder={kind === "DEVICE" ? "np. producent + pełny model" : "Pełna nazwa z etykiety"} required />
            <CatalogInput label="Marka / producent" name="brand" placeholder="Opcjonalnie" />
          </div>
          <label className="block text-xs font-black text-[#394d3c]">Opis<textarea className="mt-2 min-h-20 w-full rounded-xl border border-[#d9ded2] px-4 py-3 text-sm font-semibold" maxLength={2000} name="summary" placeholder="Technologia, wariant lub przeznaczenie — bez obietnic medycznych" /></label>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex items-center gap-2 rounded-xl border border-[#e0e5da] p-3 text-xs font-bold"><input checked={usedInTreatments} onChange={(event) => setUsedInTreatments(event.target.checked)} type="checkbox" /> Używane przy zabiegach</label>
            <label className={`flex items-center gap-2 rounded-xl border p-3 text-xs font-bold ${kind === "COSMETIC" ? "border-[#e0e5da]" : "border-stone-200 bg-stone-50 opacity-50"}`}><input checked={recommendedAftercare} disabled={kind !== "COSMETIC"} onChange={(event) => setRecommendedAftercare(event.target.checked)} type="checkbox" /> Polecane po zabiegu</label>
          </div>
          <fieldset><legend className="text-xs font-black text-[#394d3c]">Zabiegi</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{forms.map((form) => <label className="flex items-center gap-2 rounded-xl border border-[#e0e5da] px-3 py-2.5 text-xs font-bold" key={form.code}><input name="treatmentCodes" type="checkbox" value={form.code} />{form.name}</label>)}</div></fieldset>
          <label className="block text-xs font-black text-[#394d3c]">Instrukcja dla klientki<textarea className="mt-2 min-h-20 w-full rounded-xl border border-[#d9ded2] px-4 py-3 text-sm font-semibold" maxLength={2000} name="recommendationNote" placeholder="Opcjonalna informacja przekazywana po zabiegu" /></label>
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-900">Pozycja dodana ręcznie będzie oznaczona jako dane salonu. W przypadku urządzenia wpisz dokładny model z tabliczki znamionowej.</p>
          {error ? <p className="text-sm font-bold text-red-700">{error}</p> : null}
        </div>
        <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-[#eaeee5] bg-white px-4 py-3 sm:flex sm:justify-end sm:px-6 sm:py-4"><button className="w-full px-4 py-2.5 text-sm font-black text-stone-500 sm:w-auto" onClick={onClose} type="button">Anuluj</button><button className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#173d35] px-5 py-2.5 text-sm font-black text-white disabled:opacity-50 sm:w-auto" disabled={saving} type="submit">{saving ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />} Dodaj</button></div>
      </form>
    </div>,
    document.body,
  );
}

function CatalogInput({ label, name, placeholder, required = false }: { readonly label: string; readonly name: string; readonly placeholder: string; readonly required?: boolean }) {
  return <label className="block text-xs font-black text-[#394d3c]">{label}<input className="mt-2 w-full rounded-xl border border-[#d9ded2] px-4 py-3 text-sm font-semibold" maxLength={250} name={name} placeholder={placeholder} required={required} /></label>;
}

function CatalogStat({ label, value }: { readonly label: string; readonly value: number }) {
  return <div className="min-w-20 rounded-2xl bg-white/8 px-3 py-3"><strong className="block text-xl font-black">{value}</strong><span className="mt-0.5 block text-[9px] font-bold uppercase tracking-[0.08em] text-white/55">{label}</span></div>;
}

function Tag({ children, sponsor = false }: { readonly children: string; readonly sponsor?: boolean }) {
  return <span className={`rounded-full px-2 py-1 text-[9px] font-black ${sponsor ? "bg-amber-100 text-amber-900" : "bg-[#eef3e6] text-[#457a6d]"}`}>{children}</span>;
}

function kindMeta(kind: BeautyDocsCatalogKind): { readonly label: string; readonly icon: LucideIcon; readonly tone: string } {
  const option = kindOptions.find((candidate) => candidate.value === kind) ?? kindOptions[0];
  const tone = kind === "MEDICINE" ? "bg-blue-50 text-blue-700" : kind === "DEVICE" ? "bg-violet-50 text-violet-700" : kind === "COSMETIC" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700";
  return { label: option.shortLabel, icon: option.icon, tone };
}

function productDetailText(
  details: Readonly<Record<string, unknown>>,
  key: string,
): string | null {
  const value = details[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function newSelectionDraft(item: BeautyDocsCatalogItem): SelectionDraft {
  return { sourceItem: item, salonItemId: null, usedInTreatments: item.kind === "DEVICE" || item.kind === "TREATMENT_SUBSTANCE", recommendedAftercare: item.kind === "COSMETIC", treatmentCodes: [], recommendationNote: "" };
}

function editSelectionDraft(item: BeautyDocsSalonCatalogItem): SelectionDraft {
  return { sourceItem: item, salonItemId: item.id, usedInTreatments: item.usedInTreatments, recommendedAftercare: item.recommendedAftercare, treatmentCodes: [...item.treatmentCodes], recommendationNote: item.recommendationNote ?? "" };
}

function createPayload(item: BeautyDocsCatalogItem | BeautyDocsSalonCatalogItem, settings: BeautyDocsSalonCatalogUpdate): BeautyDocsSalonCatalogCreate {
  return { source: item.source, externalId: item.externalId, kind: item.kind, name: item.name, brand: item.brand, summary: item.summary, details: item.details, sourceLabel: item.sourceLabel, sourceUrl: item.sourceUrl, ...settings };
}

function toggleCode(codes: readonly string[], code: string): string[] {
  return codes.includes(code) ? codes.filter((value) => value !== code) : [...codes, code];
}
