"use client";

import { useT } from "../i18n";
import Link from "next/link";
import { FileSignature, FileText } from "lucide-react";

import type {
  FormConsent,
  FormContraindicationItem,
  FormContraindicationsSection,
  FormField,
  FormFieldSection,
  PublicFormContent,
  TenantPublicConfig,
} from "../../../types/tenant";

const TEXT_INPUT_TYPES = new Set(["text", "date", "tel", "email"]);

interface PublicFormRendererProps {
  readonly form: PublicFormContent;
  readonly tenant: TenantPublicConfig;
}

export function PublicFormRenderer({ form, tenant }: PublicFormRendererProps) {
  const t = useT();
  return (
    <div className="mx-auto max-w-3xl">
      <Link
        className="inline-flex rounded-lg text-sm font-semibold text-stone-600 underline decoration-slate-300 underline-offset-4 hover:text-[#173d35] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#245c4d] focus-visible:ring-offset-2"
        href={`/f/${encodeURIComponent(tenant.slug)}`}
      >
        {t("← Wróć do formularzy")}
      </Link>

      <section className="mt-6 overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
        <div className="border-b border-stone-200 bg-[#f7f8f4] px-6 py-6 sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-[#245c4d] px-3 py-1.5 text-xs font-bold text-white">
              <FileText aria-hidden="true" className="size-3.5" />
              {t("Formularz online")}
            </span>
            <span className="inline-flex items-center rounded-full bg-[#eef3e7] px-3 py-1 text-xs font-bold text-[#245c4d]">
              {t("Wersja")}{" "}{form.version}
            </span>
          </div>
          <h1 className="mt-5 text-3xl font-bold tracking-tight text-[#173d35] sm:text-4xl">
            {form.displayName}
          </h1>
          <p className="mt-3 text-base leading-7 text-stone-600">
            {t("Dokumentacja zabiegowa dla salonu")}{" "}{tenant.displayName}.
          </p>
        </div>

        <div className="divide-y divide-stone-100">
          {form.definition.sections.map((section) =>
            section.kind === "fields" ? (
              <FieldsSectionBlock
                consents={form.legal.consents}
                key={section.key}
                salonName={tenant.displayName}
                section={section}
              />
            ) : (
              <ContraindicationsSectionBlock key={section.key} section={section} />
            ),
          )}
        </div>

        <div className="border-t border-stone-200 bg-[#f7f8f4] px-6 py-7 sm:px-8 sm:py-8">
          <button
            aria-describedby="public-form-notice"
            className="w-full cursor-not-allowed rounded-xl bg-[#d4decc] px-5 py-3.5 font-bold text-stone-600"
            disabled
            type="button"
          >
            {t("Wyślij formularz")}
          </button>
          <p className="mt-3 text-center text-xs leading-5 text-stone-500" id="public-form-notice">
            {t("Podgląd treści formularza. Podpis i wysyłka zostaną uruchomione w kolejnym etapie.")}
          </p>
        </div>
      </section>
    </div>
  );
}

interface FieldsSectionBlockProps {
  readonly section: FormFieldSection;
  readonly consents: readonly FormConsent[];
  readonly salonName: string;
}

function FieldsSectionBlock({ section, consents, salonName }: FieldsSectionBlockProps) {
  const t = useT();
  if (section.fields.length === 0) {
    return null;
  }

  return (
    <div className="px-6 py-7 sm:px-8 sm:py-8">
      <h2 className="text-lg font-bold text-[#173d35]">{t(section.title)}</h2>
      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        {section.fields.map((field) => {
          if (field.type === "consent") {
            const consent = consents.find((candidate) => candidate.key === field.key);
            if (!consent) {
              return null;
            }
            return (
              <div className="sm:col-span-2" key={field.key}>
                <ConsentCard consent={consent} field={field} salonName={salonName} />
              </div>
            );
          }

          if (field.type === "signature") {
            return (
              <div className="sm:col-span-2" key={field.key}>
                <SignaturePlaceholder field={field} />
              </div>
            );
          }

          return (
            <div key={field.key}>
              <TextField field={field} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TextField({ field }: { readonly field: FormField }) {
  const t = useT();
  const inputType = TEXT_INPUT_TYPES.has(field.type) ? field.type : "text";
  const inputId = `field-${field.key}`;

  return (
    <>
      <label className="block text-[11px] font-black uppercase tracking-[0.14em] text-[#5a6b5a]" htmlFor={inputId}>
        {t(field.label)}
        {field.required ? <span className="text-[#245c4d]"> *</span> : null}
      </label>
      <input
        className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-[#173d35] outline-none transition placeholder:text-[#aeb3a7] focus:border-[#245c4d] focus:ring-2 focus:ring-[#245c4d]/15"
        id={inputId}
        name={field.key}
        required={field.required}
        type={inputType}
      />
    </>
  );
}

function ConsentCard({
  field,
  consent,
  salonName,
}: {
  readonly field: FormField;
  readonly consent: FormConsent;
  readonly salonName: string;
}) {
  const t = useT();
  const text = consent.text.split("{{salonName}}").join(salonName);
  const isRequired = field.required || consent.required;
  const inputId = `consent-${field.key}`;

  return (
    <div className="rounded-2xl border border-[#d4decc] bg-[#f7f8f4] p-5">
      {consent.title ? (
        <h3 className="text-sm font-bold text-[#173d35]">
          {t(consent.title)}
          {isRequired ? <span className="text-[#245c4d]"> *</span> : null}
        </h3>
      ) : null}
      <p className="mt-2 text-sm leading-6 text-stone-600">{t(text)}</p>
      <label className="mt-4 flex items-start gap-3 text-sm font-semibold text-[#173d35]" htmlFor={inputId}>
        <input
          className="mt-0.5 size-4 shrink-0 rounded border-stone-300 text-[#245c4d] focus:ring-2 focus:ring-[#245c4d]/30"
          id={inputId}
          name={field.key}
          required={isRequired}
          type="checkbox"
        />
        {t("Wyrażam zgodę")}
      </label>
    </div>
  );
}

function SignaturePlaceholder({ field }: { readonly field: FormField }) {
  const t = useT();
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-[#cdd7c6] bg-[#f7f8f4] px-5 py-8 text-center">
      <FileSignature aria-hidden="true" className="size-5 text-[#245c4d]" />
      <p className="text-sm font-semibold text-[#173d35]">
        {t(field.label)}
        {field.required ? <span className="text-[#245c4d]"> *</span> : null}
      </p>
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#96a298]">
        {t("Miejsce na podpis")}
      </p>
    </div>
  );
}

interface CategoryGroup {
  readonly category: string | null;
  readonly items: FormContraindicationItem[];
}

function groupByCategory(items: readonly FormContraindicationItem[]): readonly CategoryGroup[] {
  const groups: CategoryGroup[] = [];

  for (const item of items) {
    const current = groups.at(-1);
    if (current && current.category === item.category) {
      current.items.push(item);
    } else {
      groups.push({ category: item.category, items: [item] });
    }
  }

  return groups;
}

function ContraindicationsSectionBlock({
  section,
}: {
  readonly section: FormContraindicationsSection;
}) {
  const t = useT();
  if (section.items.length === 0) {
    return null;
  }

  const groups = groupByCategory(section.items);

  return (
    <div className="px-6 py-7 sm:px-8 sm:py-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold text-[#173d35]">{t(section.title)}</h2>
        <span className="text-xs font-semibold text-stone-500">
          {t("Pytań:")}{" "}{section.items.length}
        </span>
      </div>

      <div className="mt-5 space-y-8">
        {groups.map((group, index) => (
          <div key={group.category ?? `bez-kategorii-${index}`}>
            {group.category ? (
              <h3 className="text-xs font-black uppercase tracking-[0.14em] text-[#245c4d]">
                {group.category}
              </h3>
            ) : null}
            <div className="mt-3 divide-y divide-stone-100">
              {group.items.map((item) => (
                <ContraindicationRow item={item} key={item.key} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ContraindicationRow({ item }: { readonly item: FormContraindicationItem }) {
  const t = useT();
  return (
    <div className="py-4 first:pt-0 last:pb-0">
      <fieldset className="m-0 flex flex-col gap-3 border-0 p-0 sm:flex-row sm:items-center sm:justify-between">
        <legend className="w-full p-0 text-sm font-semibold leading-6 text-[#173d35] sm:w-auto sm:max-w-md">
          {t(item.question)}
        </legend>
        <div className="flex shrink-0 items-center gap-5">
          <label
            className="flex items-center gap-2 text-sm font-medium text-stone-600"
            htmlFor={`${item.key}-yes`}
          >
            <input
              className="size-4 border-stone-300 text-[#245c4d] focus:ring-2 focus:ring-[#245c4d]/30"
              id={`${item.key}-yes`}
              name={`q-${item.key}`}
              type="radio"
              value="tak"
            />
            {t("Tak")}
          </label>
          <label
            className="flex items-center gap-2 text-sm font-medium text-stone-600"
            htmlFor={`${item.key}-no`}
          >
            <input
              className="size-4 border-stone-300 text-[#245c4d] focus:ring-2 focus:ring-[#245c4d]/30"
              id={`${item.key}-no`}
              name={`q-${item.key}`}
              type="radio"
              value="nie"
            />
            {t("Nie")}
          </label>
        </div>
      </fieldset>
      {item.hasFollowUp ? (
        <input
          className="mt-3 w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-[#173d35] outline-none transition placeholder:text-[#aeb3a7] focus:border-[#245c4d] focus:ring-2 focus:ring-[#245c4d]/15"
          name={`${item.key}-followup`}
          placeholder={item.followUpPlaceholder ?? t("Jeżeli tak, opisz…")}
          type="text"
        />
      ) : null}
    </div>
  );
}
