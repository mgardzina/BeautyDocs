"use client";
import { activeIntlLocale } from "../../../lib/i18n/active";

import { useT } from "../i18n";
import {
  Archive,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  ClipboardList,
  FileText,
  Mail,
  Phone,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import type {
  BeautyDocsAdminClientCollection,
  BeautyDocsAdminClientForm,
  BeautyDocsAdminClientNote,
  BeautyDocsAdminClientProfile as ClientProfile,
  BeautyDocsAdminClientVisit,
  BeautyDocsClientNoteCategory,
  BeautyDocsSubmissionStatus,
  BeautyDocsVisitStatus,
} from "../../../types/beautydocs-admin";

interface BeautyDocsClientProfileProps {
  readonly profile: ClientProfile;
  readonly tenantSlug: string;
}

export function BeautyDocsClientProfile({
  profile,
  tenantSlug,
}: BeautyDocsClientProfileProps) {
  const t = useT();
  const { client } = profile;
  const clientsPath = `/panel/${encodeURIComponent(tenantSlug)}/clients`;

  return (
    <article aria-labelledby="client-profile-heading">
      <Link
        className="inline-flex items-center gap-2 rounded-lg text-sm font-semibold text-stone-600 hover:text-[#173d35] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#245c4d] focus-visible:ring-offset-2"
        href={clientsPath}
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {t("Wróć do klientek")}
      </Link>

      <header className="mt-6 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-[#245c4d] text-lg font-bold text-white">
              {initials(client.firstName, client.lastName)}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-stone-500">{t("Profil klientki")}</p>
              <h1 className="mt-1 truncate text-2xl font-bold tracking-tight sm:text-3xl" id="client-profile-heading">
                {client.firstName} {client.lastName}
              </h1>
            </div>
          </div>
          <span
            className={`inline-flex self-start items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ${
              client.archivedAt
                ? "bg-amber-50 text-amber-800"
                : "bg-emerald-50 text-emerald-700"
            }`}
          >
            {client.archivedAt ? <Archive aria-hidden="true" className="size-3.5" /> : null}
            {client.archivedAt ? t("Archiwalna") : t("Aktywna")}
          </span>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ContactItem icon={Phone} label={t("Telefon")} value={client.phone} type="phone" />
          <ContactItem icon={Mail} label={t("E-mail")} value={client.email} type="email" />
          <ProfileValue
            icon={CalendarDays}
            label={t("Data urodzenia")}
            value={client.birthDate ? formatBirthDate(client.birthDate) : "Nie podano"}
          />
          <ProfileValue
            icon={UserRound}
            label={t("Klientka od")}
            value={formatDate(client.createdAt)}
          />
        </div>
      </header>

      <dl className="mt-5 grid grid-cols-3 gap-3">
        <ProfileCount label={t("Wizyty")} value={profile.visits.total} />
        <ProfileCount label={t("Formularze")} value={profile.forms.total} />
        <ProfileCount label={t("Notatki")} value={profile.notes.total} />
      </dl>

      <div className="mt-6 space-y-6">
        <VisitsSection collection={profile.visits} />
        <FormsSection
          clientId={client.id}
          collection={profile.forms}
          tenantSlug={tenantSlug}
        />
        <NotesSection collection={profile.notes} />
      </div>
    </article>
  );
}

function ProfileValue({
  icon: Icon,
  label,
  value,
}: {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly value: string;
}) {
  const t = useT();
  return (
    <div className="rounded-xl bg-[#f7f8f4] p-4">
      <div className="flex items-center gap-2 text-xs font-semibold text-stone-500">
        <Icon aria-hidden="true" className="size-3.5" /> {t(label)}
      </div>
      <p className="mt-2 break-words text-sm font-bold text-[#222a23]">{value}</p>
    </div>
  );
}

function ContactItem({
  icon,
  label,
  value,
  type,
}: {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly value: string | null;
  readonly type: "phone" | "email";
}) {
  const t = useT();
  if (!value) {
    return <ProfileValue icon={icon} label={t(label)} value="Nie podano" />;
  }

  const Icon = icon;
  const href = type === "phone" ? `tel:${value}` : `mailto:${value}`;
  return (
    <div className="rounded-xl bg-[#f7f8f4] p-4">
      <div className="flex items-center gap-2 text-xs font-semibold text-stone-500">
        <Icon aria-hidden="true" className="size-3.5" /> {t(label)}
      </div>
      <a className="mt-2 block break-words text-sm font-bold text-[#222a23] hover:underline" href={href}>
        {value}
      </a>
    </div>
  );
}

function ProfileCount({ label, value }: { readonly label: string; readonly value: number }) {
  const t = useT();
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 text-center shadow-sm">
      <dt className="text-xs font-semibold text-stone-500">{t(label)}</dt>
      <dd className="mt-1 text-2xl font-bold">{value.toLocaleString(activeIntlLocale())}</dd>
    </div>
  );
}

function VisitsSection({
  collection,
}: {
  readonly collection: BeautyDocsAdminClientCollection<BeautyDocsAdminClientVisit>;
}) {
  const t = useT();
  return (
    <ProfileSection
      description={t("Historia zaplanowanych i wykonanych zabiegów.")}
      icon={CalendarDays}
      title={t("Wizyty")}
      truncated={collection.truncated}
    >
      {collection.items.length > 0 ? (
        <ul className="divide-y divide-stone-100">
          {collection.items.map((visit) => (
            <li className="px-5 py-4 sm:px-6" key={visit.id}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-bold text-[#173d35]">{visit.treatmentName}</p>
                  <p className="mt-1 text-sm text-stone-500">
                    {formatDateTime(visit.startsAt)}
                    {visit.endsAt ? ` – ${formatTime(visit.endsAt)}` : ""}
                  </p>
                </div>
                <StatusBadge label={visitStatusLabel(visit.status)} tone={visitStatusTone(visit.status)} />
              </div>
              {visit.anaesthesia ? (
                <p className="mt-3 text-sm text-stone-600">
                  <span className="font-semibold">{t("Znieczulenie:")}</span> {visit.anaesthesia}
                </p>
              ) : null}
              {visit.notes ? (
                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-stone-600">
                  {visit.notes}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <SectionEmpty text={t("Brak wizyt w historii klientki.")} />
      )}
    </ProfileSection>
  );
}

function FormsSection({
  clientId,
  collection,
  tenantSlug,
}: {
  readonly clientId: string;
  readonly collection: BeautyDocsAdminClientCollection<BeautyDocsAdminClientForm>;
  readonly tenantSlug: string;
}) {
  const t = useT();
  return (
    <ProfileSection
      description={t("Dokumentacja przypisana do tej klientki.")}
      icon={ClipboardList}
      title={t("Formularze")}
      truncated={collection.truncated}
    >
      {collection.items.length > 0 ? (
        <ul className="divide-y divide-stone-100">
          {collection.items.map((form) => (
            <li key={form.id}>
              <Link
                aria-label={t("Zobacz odpowiedzi formularza {templateName}", { templateName: form.templateName })}
                className="group flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-[#f7f8f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#245c4d] sm:flex-row sm:items-center sm:justify-between sm:px-6"
                href={`/panel/${encodeURIComponent(tenantSlug)}/clients/${encodeURIComponent(clientId)}/forms/${encodeURIComponent(form.id)}`}
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#f7f8f4] text-stone-600 transition-colors group-hover:bg-[#eef3e7] group-hover:text-[#245c4d]">
                    <FileText aria-hidden="true" className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-bold text-[#173d35]">
                      {form.templateName}
                    </p>
                    <p className="mt-1 text-xs text-stone-500">
                      {form.submittedAt
                        ? t("Wysłano {value1}", { value1: formatDateTime(form.submittedAt) })
                        : t("Utworzono {value1}", { value1: formatDateTime(form.createdAt) })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  <StatusBadge
                    label={submissionStatusLabel(form.status)}
                    tone={submissionStatusTone(form.status)}
                  />
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-[#245c4d]">
                    {t("Zobacz odpowiedzi")}
                    <ArrowRight
                      aria-hidden="true"
                      className="size-3.5 transition-transform group-hover:translate-x-0.5"
                    />
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <SectionEmpty text={t("Brak formularzy przypisanych do klientki.")} />
      )}
    </ProfileSection>
  );
}

function NotesSection({
  collection,
}: {
  readonly collection: BeautyDocsAdminClientCollection<BeautyDocsAdminClientNote>;
}) {
  const t = useT();
  return (
    <ProfileSection
      description={t("Wewnętrzne informacje zapisane przez zespół salonu.")}
      icon={FileText}
      title={t("Notatki")}
      truncated={collection.truncated}
    >
      {collection.items.length > 0 ? (
        <ul className="divide-y divide-stone-100">
          {collection.items.map((note) => (
            <li className="px-5 py-4 sm:px-6" key={note.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <StatusBadge label={noteCategoryLabel(note.category)} tone={noteCategoryTone(note.category)} />
                <p className="text-xs text-stone-400">
                  {formatDateTime(note.createdAt)}{note.editedAt ? " · edytowano" : ""}
                </p>
              </div>
              <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-[#173d35]">
                {t(note.body)}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <SectionEmpty text={t("Brak notatek o klientce.")} />
      )}
    </ProfileSection>
  );
}

function ProfileSection({
  title,
  description,
  icon: Icon,
  truncated,
  children,
}: {
  readonly title: string;
  readonly description: string;
  readonly icon: LucideIcon;
  readonly truncated: boolean;
  readonly children: ReactNode;
}) {
  const t = useT();
  return (
    <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      <header className="flex items-start gap-3 border-b border-stone-200 px-5 py-4 sm:px-6">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#f7f8f4] text-stone-600">
          <Icon aria-hidden="true" className="size-4" />
        </span>
        <div>
          <h2 className="font-bold text-[#173d35]">{t(title)}</h2>
          <p className="mt-0.5 text-sm text-stone-500">{t(description)}</p>
        </div>
      </header>
      {children}
      {truncated ? (
        <p className="border-t border-stone-100 bg-[#f7f8f4] px-5 py-3 text-xs text-stone-500 sm:px-6">
          {t("Pokazano 100 najnowszych pozycji.")}
        </p>
      ) : null}
    </section>
  );
}

function SectionEmpty({ text }: { readonly text: string }) {
  const t = useT();
  return <p className="px-5 py-8 text-center text-sm text-stone-500 sm:px-6">{t(text)}</p>;
}

function StatusBadge({
  label,
  tone,
}: {
  readonly label: string;
  readonly tone: "green" | "amber" | "red" | "slate" | "blue";
}) {
  const t = useT();
  const classes = {
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-800",
    red: "bg-red-50 text-red-700",
    slate: "bg-[#f7f8f4] text-stone-600",
    blue: "bg-[#eef3e7] text-[#245c4d]",
  } as const;
  return (
    <span className={`inline-flex self-start rounded-full px-2.5 py-1 text-xs font-bold ${classes[tone]}`}>
      {t(label)}
    </span>
  );
}

function visitStatusLabel(status: BeautyDocsVisitStatus): string {
  return { PLANNED: "Zaplanowana", COMPLETED: "Zakończona", CANCELLED: "Anulowana" }[status];
}

function visitStatusTone(status: BeautyDocsVisitStatus): "blue" | "green" | "red" {
  return { PLANNED: "blue", COMPLETED: "green", CANCELLED: "red" }[status] as
    | "blue"
    | "green"
    | "red";
}

function submissionStatusLabel(status: BeautyDocsSubmissionStatus): string {
  return { DRAFT: "Szkic", SUBMITTED: "Wysłany", SIGNED: "Podpisany", VOID: "Unieważniony" }[status];
}

function submissionStatusTone(
  status: BeautyDocsSubmissionStatus,
): "slate" | "blue" | "green" | "red" {
  return { DRAFT: "slate", SUBMITTED: "blue", SIGNED: "green", VOID: "red" }[status] as
    | "slate"
    | "blue"
    | "green"
    | "red";
}

function noteCategoryLabel(category: BeautyDocsClientNoteCategory): string {
  return {
    NOTATKA: "Notatka",
    ALERGIA: "Alergia",
    UWAGA: "Uwaga",
    PREFERENCJA: "Preferencja",
  }[category];
}

function noteCategoryTone(
  category: BeautyDocsClientNoteCategory,
): "slate" | "red" | "amber" | "blue" {
  return {
    NOTATKA: "slate",
    ALERGIA: "red",
    UWAGA: "amber",
    PREFERENCJA: "blue",
  }[category] as "slate" | "red" | "amber" | "blue";
}

function initials(firstName: string, lastName: string): string {
  return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toLocaleUpperCase("pl-PL");
}

function formatBirthDate(value: string): string {
  return new Intl.DateTimeFormat(activeIntlLocale(), {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(activeIntlLocale(), {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Warsaw",
  }).format(new Date(value));
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat(activeIntlLocale(), {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Warsaw",
  }).format(new Date(value));
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat(activeIntlLocale(), {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Warsaw",
  }).format(new Date(value));
}
