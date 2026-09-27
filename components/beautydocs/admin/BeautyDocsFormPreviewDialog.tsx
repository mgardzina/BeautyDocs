"use client";

import { useT } from "../i18n";
import { useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ChevronDown,
  Eye,
  FileText,
  LoaderCircle,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import { BeautyDocsDialog } from "../BeautyDocsDialog";
import type { BeautyDocsAdminFormPreview } from "../../../types/beautydocs-admin";

const FIELD_TYPE_LABELS: Record<string, string> = {
  text: "Pole tekstowe",
  date: "Data",
  tel: "Numer telefonu",
  email: "Adres e-mail",
  consent: "Zgoda",
  signature: "Podpis",
};

function fieldTypeLabel(type: string): string {
  return FIELD_TYPE_LABELS[type] ?? type;
}

export function BeautyDocsFormPreviewDialog({
  tenantSlug,
  formCode,
  formName,
}: {
  readonly tenantSlug: string;
  readonly formCode: string;
  readonly formName: string;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<BeautyDocsAdminFormPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openDialog = () => {
    setOpen(true);
    if (preview) return;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const response = await fetch(
          `/api/beautydocs-preview/admin/tenants/${encodeURIComponent(tenantSlug)}` +
            `/forms/${encodeURIComponent(formCode)}/preview`,
          { cache: "no-store", credentials: "same-origin" },
        );
        if (!response.ok) throw new Error("preview-failed");
        setPreview((await response.json()) as BeautyDocsAdminFormPreview);
      } catch {
        setError(t("Nie udało się wczytać podglądu formularza."));
      } finally {
        setLoading(false);
      }
    })();
  };

  return (
    <>
      <button
        className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[#dce1d4] bg-white px-3 py-1.5 text-xs font-black text-[#245c4d] transition hover:border-[#b8cbaa] hover:bg-[#f8faf4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#245c4d]"
        onClick={openDialog}
        type="button"
      >
        <Eye aria-hidden="true" className="size-4" />
        {t("Podgląd")}
      </button>

      <BeautyDocsDialog
        className="max-w-2xl"
        onClose={() => setOpen(false)}
        open={open}
        title={t("Podgląd formularza: {formName}", { formName: formName })}
      >
        <div className="max-h-[85vh] w-full overflow-y-auto rounded-[1.75rem] border border-[#e5eadf] bg-white p-6 shadow-[0_24px_70px_rgba(38,65,58,0.25)] sm:p-7">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#245c4d]">
                {t("Podgląd formularza")}
              </p>
              <h2 className="mt-1 truncate text-xl font-black text-[#173d35]">
                {preview?.name ?? formName}
              </h2>
              {preview?.description ? (
                <p className="mt-1 text-sm text-[#5a6b5a]">{t(preview.description)}</p>
              ) : null}
            </div>
            <button
              aria-label={t("Zamknij")}
              className="grid size-11 shrink-0 place-items-center rounded-full text-[#808f82] transition hover:bg-[#eff4e7] hover:text-[#173d35]"
              onClick={() => setOpen(false)}
              type="button"
            >
              <X aria-hidden="true" className="size-5" />
            </button>
          </div>

          <p className="mt-3 rounded-xl bg-[#f6f9f3] px-3.5 py-2.5 text-xs leading-5 text-[#5a6b5a]">
            {t("To jest podgląd treści formularza. Nic tutaj nie wysyła danych ani nie zapisuje odpowiedzi.")}
          </p>

          {loading ? (
            <div className="mt-8 flex items-center justify-center gap-2 py-14 text-sm font-bold text-[#5a6b5a]">
              <LoaderCircle className="size-5 animate-spin" />{" "}{t("Wczytywanie…")}
            </div>
          ) : error ? (
            <p className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              {error}
            </p>
          ) : preview ? (
            <div className="mt-6 space-y-6">
              {preview.definition.treatment ? (
                <p className="inline-flex items-center gap-1.5 rounded-full bg-[#eef3e7] px-3 py-1.5 text-xs font-black text-[#245c4d]">
                  {t("Zabieg:")}{" "}{preview.definition.treatment}
                </p>
              ) : null}

              {preview.definition.sections.map((section) => (
                <section
                  className="rounded-2xl border border-[#e5eadf] bg-[#fcfaf8] p-4 sm:p-5"
                  key={section.key}
                >
                  <h3 className="font-black text-[#173d35]">{t(section.title)}</h3>
                  {section.kind === "fields" ? (
                    <ul className="mt-3 space-y-2">
                      {section.fields.map((field) => (
                        <li
                          className="flex items-center justify-between gap-3 rounded-xl bg-white px-3.5 py-2.5 text-sm"
                          key={field.key}
                        >
                          <span className="font-bold text-[#344937]">
                            {t(field.label)}
                            {field.required ? (
                              <span className="ml-1 text-red-600">*</span>
                            ) : null}
                          </span>
                          <span className="shrink-0 rounded-full bg-[#eef3e7] px-2.5 py-1 text-[10px] font-black text-[#245c4d]">
                            {t(fieldTypeLabel(field.type))}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {section.items.map((item) => (
                        <div
                          className="rounded-xl bg-white px-3.5 py-3 text-sm"
                          key={item.key}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <p className="font-bold text-[#344937]">
                              {t(item.question)}
                            </p>
                            {item.category ? (
                              <span className="shrink-0 rounded-full bg-[#eef3e7] px-2.5 py-1 text-[10px] font-black text-[#245c4d]">
                                {item.category}
                              </span>
                            ) : null}
                          </div>
                          {item.hasFollowUp ? (
                            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-[#7e9a82]">
                              <AlertTriangle className="size-3.5" />
                              {t("Odpowiedź „tak” poprosi o dodatkowy opis")}
                              {item.followUpPlaceholder
                                ? ` (${item.followUpPlaceholder})`
                                : ""}
                              .
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              ))}

              {preview.legal.consents.length > 0 ||
              preview.legal.documents.length > 0 ? (
                <section className="rounded-2xl border border-[#e5eadf] bg-[#fcfaf8] p-4 sm:p-5">
                  <h3 className="flex items-center gap-2 font-black text-[#173d35]">
                    <ShieldCheck className="size-4 text-[#245c4d]" />{" "}{t("Zgody i dokumenty")}
                  </h3>
                  <div className="mt-3 space-y-2">
                    {preview.legal.consents.map((consent) => (
                      <LegalTextItem
                        key={consent.key}
                        required={consent.required}
                        title={consent.title ?? t("Zgoda")}
                        text={t(consent.text)}
                      />
                    ))}
                    {preview.legal.documents.map((document) => (
                      <LegalTextItem
                        key={document.key}
                        icon={<FileText className="size-3.5" />}
                        title={t(document.title)}
                        text={t(document.text)}
                      />
                    ))}
                  </div>
                </section>
              ) : null}

              <section className="rounded-2xl border border-[#e5eadf] bg-[#fcfaf8] p-4 sm:p-5">
                <h3 className="flex items-center gap-2 font-black text-[#173d35]">
                  <UserRound className="size-4 text-[#245c4d]" />{" "}{t("Kto może wykonać ten zabieg")}
                </h3>
                {preview.practitioners.length > 0 ? (
                  <ul className="mt-3 space-y-2">
                    {preview.practitioners.map((practitioner) => (
                      <li
                        className="rounded-xl bg-white px-3.5 py-2.5 text-sm"
                        key={practitioner.id}
                      >
                        <span className="font-bold text-[#344937]">
                          {practitioner.displayName}
                        </span>
                        {practitioner.jobTitle ? (
                          <span className="ml-2 text-xs text-[#7e9a82]">
                            {t(practitioner.jobTitle)}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-[#5a6b5a]">
                    {t("Nikt z zespołu nie ma jeszcze przypisanego tego zabiegu.")}
                  </p>
                )}
              </section>
            </div>
          ) : null}
        </div>
      </BeautyDocsDialog>
    </>
  );
}

function LegalTextItem({
  title,
  text,
  required,
  icon,
}: {
  readonly title: string;
  readonly text: string;
  readonly required?: boolean;
  readonly icon?: ReactNode;
}) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded-xl bg-white px-3.5 py-2.5 text-sm">
      <button
        className="flex w-full items-center justify-between gap-3 text-left"
        onClick={() => setExpanded((current) => !current)}
        type="button"
      >
        <span className="flex items-center gap-1.5 font-bold text-[#344937]">
          {icon}
          {t(title)}
          {required ? <span className="text-red-600">*</span> : null}
        </span>
        <ChevronDown
          className={`size-4 shrink-0 text-[#7e9a82] transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>
      {expanded ? (
        <p className="mt-2 whitespace-pre-line text-xs leading-6 text-[#5a6b5a]">
          {t(text)}
        </p>
      ) : null}
    </div>
  );
}
