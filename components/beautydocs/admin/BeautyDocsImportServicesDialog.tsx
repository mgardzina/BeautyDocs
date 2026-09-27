"use client";

import { useT } from "../i18n";
import { useEffect, useState } from "react";
import { Check, Download } from "lucide-react";
import { BeautyDocsDialog } from "../BeautyDocsDialog";
import type { BeautyDocsAdminForm, BeautyDocsAdminFormList } from "@/types/beautydocs-admin";
import type { SalonService } from "@/types/beautydocs-salon";

/**
 * Lets the salon owner add services to the price list by picking names from the
 * tenant's own treatment-consent forms, instead of retyping each one by hand.
 */
export function BeautyDocsImportServicesDialog({
  slug,
  disabled,
  existingNames,
  remainingSlots,
  onImport,
}: {
  readonly slug: string;
  readonly disabled: boolean;
  readonly existingNames: readonly string[];
  readonly remainingSlots: number;
  readonly onImport: (services: SalonService[]) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [forms, setForms] = useState<BeautyDocsAdminForm[] | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const loading = open && forms === null && !error;

  useEffect(() => {
    if (!open || forms !== null) return;
    const controller = new AbortController();
    fetch(`/api/beautydocs-preview/admin/tenants/${encodeURIComponent(slug)}/forms`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Nie udało się pobrać listy formularzy.");
        const data = (await response.json()) as BeautyDocsAdminFormList;
        setForms([...data.forms].sort((a, b) => a.displayOrder - b.displayOrder));
      })
      .catch((error) => {
        if (!controller.signal.aborted) setError(error instanceof Error ? error.message : t("Nie udało się pobrać listy formularzy."));
      });
    return () => controller.abort();
  }, [open, forms, slug, t]);

  const takenNames = new Set(existingNames.map((name) => name.trim().toLowerCase()));
  const toggle = (code: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(code)) next.delete(code);
      else if (next.size < remainingSlots) next.add(code);
      return next;
    });
  };
  const close = () => {
    setOpen(false);
    setSelected(new Set());
    if (error) setError("");
  };
  const addSelected = () => {
    if (!forms) return;
    const services: SalonService[] = forms
      .filter((form) => selected.has(form.code))
      .map((form) => ({
        name: form.name,
        description: "",
        price: 0,
        priceFrom: false,
        durationMinutes: form.durationMinutes ?? null,
      }));
    if (services.length > 0) onImport(services);
    close();
  };

  return (
    <>
      <button
        className="bd-button bd-button-secondary"
        disabled={disabled || remainingSlots <= 0}
        onClick={() => setOpen(true)}
        type="button"
      >
        <Download size={18} />{" "}{t("Importuj z formularzy")}
      </button>

      <BeautyDocsDialog onClose={close} open={open} title={t("Importuj nazwy usług z formularzy")}>
        <div className="w-full max-w-lg rounded-[1.75rem] border border-[#e5eadf] bg-white p-6 shadow-[0_24px_70px_rgba(38,65,58,0.25)]">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#245c4d]">
            {t("Formularze zabiegowe")}
          </p>
          <h2 className="mt-1 text-lg font-black text-[#173d35]">
            {t("Wybierz zabiegi do dodania")}
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#5a6b5a]">
            {t("Nazwy zostaną przeniesione z Twoich formularzy zabiegowych, żeby były spójne z cennikiem.")}
          </p>

          {error && <p className="mt-4 rounded-xl bg-[#fdf1ee] px-3 py-2 text-sm font-bold text-[#a1372a]" role="alert">{error}</p>}
          {loading && <p className="mt-4 text-sm text-[#5a6b5a]" role="status">{t("Wczytywanie formularzy…")}</p>}

          {!loading && !error && forms && forms.length === 0 && (
            <p className="mt-4 text-sm text-[#5a6b5a]">{t("Nie masz jeszcze żadnych formularzy zabiegowych.")}</p>
          )}

          {!loading && !error && forms && forms.length > 0 && (
            <ul className="mt-4 max-h-80 space-y-1.5 overflow-y-auto">
              {forms.map((form) => {
                const already = takenNames.has(form.name.trim().toLowerCase());
                const checked = selected.has(form.code);
                return (
                  <li key={form.code}>
                    <label
                      className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-bold transition ${
                        already
                          ? "cursor-not-allowed border-[#e7ecdf] bg-[#f8faf5] text-[#a3ac9c]"
                          : checked
                            ? "cursor-pointer border-[#245c4d] bg-[#f1f6e9] text-[#173d35]"
                            : "cursor-pointer border-[#e7ecdf] bg-white text-[#173d35] hover:border-[#cdd7c6]"
                      }`}
                    >
                      <input
                        checked={already || checked}
                        className="size-4 shrink-0 accent-[#245c4d]"
                        disabled={already || (!checked && selected.size >= remainingSlots)}
                        onChange={() => toggle(form.code)}
                        type="checkbox"
                      />
                      <span className="min-w-0 flex-1 truncate">{form.name}</span>
                      {already && (
                        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-black text-[#8a9a86]">
                          <Check aria-hidden="true" className="size-3.5" />{" "}{t("na liście")}
                        </span>
                      )}
                    </label>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="mt-5 flex items-center justify-between gap-3">
            <span className="text-xs font-bold text-[#8a9a86]">
              {remainingSlots <= 0 ? t("Osiągnięto limit 40 usług") : t("Zaznaczono {size} z {remainingSlots} wolnych miejsc", { size: selected.size, remainingSlots: remainingSlots })}
            </span>
            <div className="flex gap-2">
              <button className="bd-button bd-button-secondary" onClick={close} type="button">
                {t("Anuluj")}
              </button>
              <button
                className="bd-button bd-button-primary"
                disabled={selected.size === 0}
                onClick={addSelected}
                type="button"
              >
                {t("Dodaj zaznaczone")}
              </button>
            </div>
          </div>
        </div>
      </BeautyDocsDialog>
    </>
  );
}
