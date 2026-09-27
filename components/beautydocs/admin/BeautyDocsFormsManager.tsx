"use client";

import { useT } from "../i18n";
import { useState } from "react";
import { Clock3, Info } from "lucide-react";
import type {
  BeautyDocsAdminForm,
  BeautyDocsAdminFormList,
} from "../../../types/beautydocs-admin";
import { BeautyDocsFormPreviewDialog } from "./BeautyDocsFormPreviewDialog";
import { BeautyDocsFormQrDialog } from "./BeautyDocsFormQrDialog";

interface BeautyDocsFormsManagerProps {
  readonly tenantSlug: string;
  readonly initialForms: BeautyDocsAdminFormList;
}

const SAVE_ERROR_MESSAGE = "Nie udało się zapisać zmiany. Spróbuj ponownie.";
const DURATION_ERROR_MESSAGE =
  "Serwer nie zapisał czasu zabiegu. Uruchom aktualizację bazy i API, a następnie spróbuj ponownie.";
const DURATION_OPTIONS = Array.from(
  { length: 32 },
  (_, index) => (index + 1) * 15,
);

export function BeautyDocsFormsManager({
  tenantSlug,
  initialForms,
}: BeautyDocsFormsManagerProps) {
  const t = useT();
  const { canManage } = initialForms;
  const [forms, setForms] = useState<readonly BeautyDocsAdminForm[]>(
    initialForms.forms,
  );
  const [pendingCodes, setPendingCodes] = useState<Record<string, boolean>>(
    {},
  );
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  const enabledCount = forms.filter((form) => form.enabled).length;

  async function updateForm(
    form: BeautyDocsAdminForm,
    update: Pick<BeautyDocsAdminForm, "enabled" | "durationMinutes">,
  ) {
    if (!canManage || pendingCodes[form.code]) {
      return;
    }

    const previousForm = form;

    setErrors((prev) => ({ ...prev, [form.code]: null }));
    setPendingCodes((prev) => ({ ...prev, [form.code]: true }));
    setForms((prev) =>
      prev.map((item) =>
        item.code === form.code ? { ...item, ...update } : item,
      ),
    );

    try {
      const response = await fetch(
        `/api/beautydocs-preview/admin/tenants/${encodeURIComponent(tenantSlug)}/forms/${encodeURIComponent(form.code)}`,
        {
          method: "PUT",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(update),
        },
      );

      if (!response.ok) {
        throw new Error("request-failed");
      }

      const updated = (await response.json()) as BeautyDocsAdminForm;
      if (updated.durationMinutes !== update.durationMinutes) {
        throw new Error("duration-not-persisted");
      }
      setForms((prev) =>
        prev.map((item) => (item.code === form.code ? updated : item)),
      );
    } catch (saveError) {
      setForms((prev) =>
        prev.map((item) =>
          item.code === form.code ? previousForm : item,
        ),
      );
      setErrors((prev) => ({
        ...prev,
        [form.code]:
          saveError instanceof Error && saveError.message === "duration-not-persisted"
            ? DURATION_ERROR_MESSAGE
            : SAVE_ERROR_MESSAGE,
      }));
    } finally {
      setPendingCodes((prev) => ({ ...prev, [form.code]: false }));
    }
  }

  return (
    <section aria-labelledby="forms-heading">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#245c4d]">
            {t("Katalog formularzy")}
          </p>
          <h1
            className="mt-3 text-3xl font-black tracking-[-0.045em] text-[#173d35] sm:text-4xl"
            id="forms-heading"
          >
            {t("Formularze")}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5a6b5a] sm:text-base">
            {t("Wybierz, które formularze są dostępne dla klientek Twojego salonu, i ustaw średni czas potrzebny na każdy zabieg. Kalendarz wykorzysta ten czas automatycznie.")}
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-1.5 self-start rounded-full bg-[#eef3e7] px-3.5 py-2 text-xs font-black text-[#245c4d] sm:self-auto">
          {t("Włączone:")}{" "}{enabledCount}{" "}{t("z")}{" "}{forms.length}
        </span>
      </div>

      {!canManage ? (
        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-[#e4ecd9] bg-[#f6f9f3] px-4 py-3.5 text-sm text-[#5a6b5a]">
          <Info
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 text-[#245c4d]"
          />
          <p>
            {t("Tylko właściciel lub administrator może zmieniać dostępne formularze.")}
          </p>
        </div>
      ) : null}

      {forms.length > 0 ? (
        <ul className="mt-6 space-y-3">
          {forms.map((form) => (
            <FormCard
              canManage={canManage}
              error={errors[form.code] ?? null}
              form={form}
              key={form.code}
              tenantSlug={tenantSlug}
              onDurationChange={(durationMinutes) =>
                updateForm(form, { enabled: form.enabled, durationMinutes })
              }
              onToggle={() =>
                updateForm(form, {
                  enabled: !form.enabled,
                  durationMinutes: form.durationMinutes,
                })
              }
              pending={pendingCodes[form.code] ?? false}
            />
          ))}
        </ul>
      ) : (
        <div className="mt-6 rounded-2xl border border-dashed border-[#b8cbaa] bg-[#fcfaf8] px-5 py-14 text-center">
          <p className="text-sm text-[#808f82]">
            {t("Brak formularzy w katalogu platformy.")}
          </p>
        </div>
      )}
    </section>
  );
}

function FormCard({
  form,
  canManage,
  pending,
  error,
  onToggle,
  onDurationChange,
  tenantSlug,
}: {
  readonly form: BeautyDocsAdminForm;
  readonly canManage: boolean;
  readonly pending: boolean;
  readonly error: string | null;
  readonly onToggle: () => void;
  readonly onDurationChange: (durationMinutes: number) => void;
  readonly tenantSlug: string;
}) {
  const t = useT();
  return (
    <li>
      <div className="flex flex-col gap-4 rounded-2xl border border-black/5 bg-[#fcfaf8] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="min-w-0 flex-1">
          <p className="font-bold text-[#173d35]">{form.name}</p>
          {form.description ? (
            <p className="mt-1 text-sm text-[#5a6b5a]">{t(form.description)}</p>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {form.version !== null ? (
              <span className="inline-flex items-center rounded-full bg-[#eef3e7] px-2.5 py-1 text-xs font-bold text-[#245c4d]">
                {t("Wersja")}{" "}{form.version}
              </span>
            ) : null}
            <span className="inline-flex items-center rounded-full bg-[#eef3e7] px-2.5 py-1 text-xs font-bold text-[#245c4d]">
              {form.questionCount}{" "}{t("pytań")}
            </span>
            <BeautyDocsFormPreviewDialog
              formCode={form.code}
              formName={form.name}
              tenantSlug={tenantSlug}
            />
            {form.enabled ? (
              <BeautyDocsFormQrDialog
                formCode={form.code}
                formName={form.name}
                tenantSlug={tenantSlug}
              />
            ) : null}
          </div>
          {error ? (
            <p className="mt-3 text-xs font-semibold text-red-700" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-4 self-start sm:self-center">
          <label className="block">
            <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-[#5a6b5a]">
              <Clock3 className="size-3.5" />{" "}{t("Czas zabiegu")}
            </span>
            <select
              aria-label={t("Czas zabiegu: {name}", { name: form.name })}
              className="mt-1.5 min-w-32 rounded-xl border border-[#d9ded2] bg-white px-3 py-2 text-sm font-bold text-[#344937] outline-none transition focus:border-[#547b59] focus:ring-2 focus:ring-[#e6eedc] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!canManage || pending}
              onChange={(event) => onDurationChange(Number(event.target.value))}
              value={form.durationMinutes}
            >
              {DURATION_OPTIONS.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {formatDuration(minutes)}
                </option>
              ))}
            </select>
          </label>
          <FormToggle
            disabled={!canManage}
            enabled={form.enabled}
            label={t("Formularz {name}: {value2}", { name: form.name, value2: form.enabled ? t("włączony") : t("wyłączony") })}
            onToggle={onToggle}
            pending={pending}
          />
        </div>
      </div>
    </li>
  );
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours === 0) return `${minutes} min`;
  if (remainder === 0) return `${hours} godz.`;
  return `${hours} godz. ${remainder} min`;
}

function FormToggle({
  enabled,
  disabled,
  pending,
  label,
  onToggle,
}: {
  readonly enabled: boolean;
  readonly disabled: boolean;
  readonly pending: boolean;
  readonly label: string;
  readonly onToggle: () => void;
}) {
  const isInteractionDisabled = disabled || pending;

  return (
    <button
      aria-checked={enabled}
      aria-label={label}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#245c4d] focus-visible:ring-offset-2 ${
        enabled ? "bg-[#245c4d]" : "bg-[#d4decc]"
      } ${isInteractionDisabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
      disabled={isInteractionDisabled}
      onClick={onToggle}
      role="switch"
      type="button"
    >
      <span
        className={`inline-block size-5 transform rounded-full bg-white shadow transition ${
          enabled ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}
