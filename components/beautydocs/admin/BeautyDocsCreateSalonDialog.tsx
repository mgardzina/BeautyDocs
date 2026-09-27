"use client";

import { useT } from "../i18n";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Store } from "lucide-react";
import { BeautyDocsDialog } from "../BeautyDocsDialog";
import {
  BeautyDocsCompanyFields,
  EMPTY_COMPANY_CONFIGURATION,
  type CompanyConfigurationForm,
} from "../auth/BeautyDocsCompanyFields";
import {
  formatPolishNipInput,
  isValidPolishNip,
  normalizePolishNip,
} from "../../../lib/polish-nip";

/**
 * Lets an already-signed-in owner add a second salon without leaving the
 * personal panel — same salon-name + company/NIP fields (and the same GUS
 * lookup) as the registration finalize step, just without name/password
 * since the owner already has those.
 */
export function BeautyDocsCreateSalonDialog({
  open,
  onClose,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
}) {
  const t = useT();
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [salonName, setSalonName] = useState("");
  const [company, setCompany] = useState<CompanyConfigurationForm>(
    EMPTY_COMPANY_CONFIGURATION,
  );
  const [lookupPending, setLookupPending] = useState(false);
  const [lookupNote, setLookupNote] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateCompany = (field: keyof CompanyConfigurationForm, value: string) => {
    setCompany((current) => ({ ...current, [field]: value }));
    setLookupNote(null);
  };

  const handleLookup = async () => {
    if (!isValidPolishNip(company.nip)) {
      setError(t("NIP musi zawierać 10 cyfr i mieć poprawną sumę kontrolną."));
      return;
    }
    setLookupPending(true);
    setError(null);
    setLookupNote(null);
    const response = await fetch("/api/beautydocs-preview/auth/company-lookup", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nip: normalizePolishNip(company.nip) }),
    });
    setLookupPending(false);
    if (!response.ok) {
      setError(
        response.status === 404
          ? t("GUS nie znalazł podmiotu o podanym numerze NIP.")
          : t("Nie udało się teraz pobrać danych z GUS. Możesz uzupełnić je ręcznie."),
      );
      return;
    }
    const data = (await response.json()) as Record<string, unknown>;
    const textValue = (key: string) =>
      typeof data[key] === "string" ? String(data[key]) : "";
    setCompany({
      nip: formatPolishNipInput(textValue("nip")),
      regon: textValue("regon"),
      krs: textValue("krs"),
      companyName: textValue("companyName"),
      street: textValue("street"),
      postalCode: textValue("postalCode"),
      city: textValue("city"),
    });
    setLookupNote(t("Dane potwierdzone w GUS."));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!salonName.trim()) {
      setError(t("Podaj nazwę salonu."));
      return;
    }
    if (!isValidPolishNip(company.nip)) {
      setError(t("NIP musi zawierać 10 cyfr i mieć poprawną sumę kontrolną."));
      return;
    }
    setPending(true);
    setError(null);
    const response = await fetch("/api/beautydocs-preview/auth/salons", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        salonName: salonName.trim(),
        nip: normalizePolishNip(company.nip),
        regon: company.regon.trim() || null,
        krs: company.krs.trim() || null,
        companyName: company.companyName.trim(),
        street: company.street.trim(),
        postalCode: company.postalCode.trim(),
        city: company.city.trim(),
      }),
    });
    if (!response.ok) {
      setPending(false);
      setError(
        response.status === 422
          ? t("Sprawdź dane firmy — część pól ma nieprawidłowy format.")
          : t("Nie udało się utworzyć salonu. Spróbuj ponownie."),
      );
      return;
    }
    const data = (await response.json()) as { tenantSlug?: string };
    if (typeof data.tenantSlug === "string") {
      router.push(`/panel/${encodeURIComponent(data.tenantSlug)}`);
      return;
    }
    setPending(false);
    router.refresh();
    onClose();
  };

  return (
    <BeautyDocsDialog className="max-w-xl" onClose={onClose} open={open} title={t("Dodaj nowy salon")}>
      <div className="bd-auth-page overflow-hidden rounded-[28px] bg-white shadow-2xl">
        <div className="flex items-start gap-4 p-6 sm:p-8 sm:pb-0">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#eef3e6] text-[#245c4d]">
            <Store className="size-6" />
          </span>
          <div>
            <h2 className="text-xl font-black tracking-tight text-[#173d35] sm:text-2xl">
              {t("Dodaj nowy salon")}
            </h2>
            <p className="mt-1 text-sm leading-6 text-stone-500">
              {t("Nowy salon pojawi się obok Twoich pozostałych przestrzeni — dane osobowe i podpis zostają wspólne.")}
            </p>
          </div>
        </div>

        <form className="space-y-5 p-6 sm:p-8" onSubmit={handleSubmit}>
          <label className="block text-xs font-black uppercase tracking-[0.12em] text-stone-500">
            {t("Nazwa salonu")}
            <input
              autoFocus
              className="mt-2 w-full rounded-2xl border border-[#d4decc] bg-white px-4 py-3.5 text-sm font-semibold text-[#173d35] outline-none transition placeholder:text-[#b3a7aa] focus:border-[#245c4d] focus:ring-4 focus:ring-[#245c4d]/10"
              disabled={pending}
              onChange={(event) => setSalonName(event.target.value)}
              placeholder={t("np. Studio Lumière — Mokotów")}
              value={salonName}
            />
          </label>

          <BeautyDocsCompanyFields
            company={company}
            disabled={pending}
            lookupNote={t(lookupNote)}
            lookupPending={lookupPending}
            onChange={updateCompany}
            onLookup={() => void handleLookup()}
          />

          {error ? (
            <p
              className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-3 border-t border-[#eaeee4] pt-6">
            <button
              className="rounded-2xl border border-[#d4decc] bg-white px-5 py-3 text-sm font-black text-[#173d35] transition hover:bg-[#f7f8f4]"
              onClick={onClose}
              type="button"
            >
              {t("Anuluj")}
            </button>
            <motion.button
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#245c4d] px-5 py-3 text-sm font-black text-white shadow-[0_12px_30px_rgba(36,92,77,0.18)] transition hover:bg-[#173d35] disabled:cursor-wait disabled:opacity-70"
              disabled={pending || lookupPending}
              transition={{ type: "spring", bounce: 0, duration: 0.2 }}
              type="submit"
              whileTap={reduceMotion || pending ? undefined : { scale: 0.97 }}
            >
              {pending ? t("Tworzenie salonu…") : t("Utwórz salon")}
              {pending ? null : <ArrowRight aria-hidden="true" className="size-4" />}
            </motion.button>
          </div>
        </form>
      </div>
    </BeautyDocsDialog>
  );
}
