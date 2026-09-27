"use client";
import { activeIntlLocale } from "../../../lib/i18n/active";

import { useT } from "../i18n";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  MessageCircle,
  CalendarDays,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import type {
  BeautyDocsTenantAnalytics,
  BeautyDocsAdminVisit,
  BeautyDocsTenantOverview as TenantOverview,
} from "../../../types/beautydocs-admin";
import { BeautyDocsSalonCharts } from "./BeautyDocsSalonCharts";

interface BeautyDocsTenantOverviewProps {
  readonly overview: TenantOverview;
  readonly tenantSlug: string;
  readonly todayVisits: readonly BeautyDocsAdminVisit[] | null;
  readonly analytics: BeautyDocsTenantAnalytics | null;
}

export function BeautyDocsTenantOverview({
  overview,
  tenantSlug,
  analytics,
  todayVisits,
}: BeautyDocsTenantOverviewProps) {
  const t = useT();
  const basePath = `/panel/${encodeURIComponent(tenantSlug)}`;
  const stats = [
    {
      label: t("Podpisane formularze"),
      value: overview.stats.signedFormSubmissionsCount,
      description: "kompletne dokumenty",
      icon: CheckCircle2,
    },
    {
      label: t("Klientki"),
      value: overview.stats.clientsCount,
      description: "kartoteki w salonie",
      icon: Users,
    },
    {
      label: t("Aktywne formularze"),
      value: overview.stats.activeFormsCount,
      description: t("dostępne dla klientek"),
      icon: FileText,
    },
    {
      label: t("Wypełnione formularze"),
      value: overview.stats.formSubmissionsCount,
      description: "zapisane odpowiedzi",
      icon: ClipboardCheck,
    },
  ] as const;
  const visits = todayVisits?.filter((visit) => visit.status !== "CANCELLED")
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const needsForm = visits?.filter((visit) => visit.formCode && !visit.formSubmitted);


  return (
    <section aria-labelledby="overview-heading">
      <div className="flex flex-col gap-5 rounded-[1.75rem] border border-black/5 bg-[#fcfaf8] p-6 sm:flex-row sm:items-end sm:justify-between sm:p-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#5a6b5a]">{t("Przegląd salonu")}</p>
          <h1 className="mt-3 text-3xl font-black tracking-[-0.045em] text-[#173d35] sm:text-4xl" id="overview-heading">
            {t("Dzień dobry!")}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5a6b5a] sm:text-base">
            {t("Najważniejsze informacje o")}{" "}{overview.tenant.displayName}{" "}{t("w jednym miejscu.")}
          </p>
        </div>
        <Link
          className="inline-flex items-center justify-center gap-2 self-start rounded-full bg-[#245c4d] px-5 py-3 text-sm font-black text-white shadow-[0_12px_28px_rgba(36,92,77,0.18)] transition hover:-translate-y-0.5 hover:bg-[#173d35] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#245c4d] focus-visible:ring-offset-2 sm:self-auto"
          href={`${basePath}/visits`}
        >
          {t("Otwórz kalendarz")}
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </div>

      <section className="mt-5 rounded-3xl border border-black/5 bg-[#fcfaf8] p-5 sm:p-6" aria-labelledby="today-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="today-heading" className="text-xl font-semibold tracking-tight">{t("Dzisiaj w salonie")}</h2>
          <Link href={`${basePath}/visits`} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-[#245c4d] hover:bg-[#f1f6e9]">
            <CalendarDays aria-hidden="true" className="size-4" />{" "}{t("Wszystkie wizyty")}
          </Link>
        </div>
        {visits ? (
          <>
            <p className="mt-2 text-sm text-[#5a6b5a]">{t("Liczba wizyt:")}{" "}{visits.length}{t(". Wizyty bez wypełnionego formularza:")}{" "}{needsForm?.length ?? 0}.</p>
            {visits.length ? (
              <ul className="mt-4 divide-y divide-[#e7ecdf]">
                {visits.slice(0, 6).map((visit) => (
                  <li key={visit.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-4">
                    <time dateTime={visit.startsAt} className="font-semibold tabular-nums text-[#173d35]">
                      {new Intl.DateTimeFormat(activeIntlLocale(), { timeZone: "Europe/Warsaw", hour: "2-digit", minute: "2-digit" }).format(new Date(visit.startsAt))}
                    </time>
                    <div className="min-w-0 flex-1 basis-40">
                      <Link href={`${basePath}/clients/${encodeURIComponent(visit.clientId)}`} className="font-semibold text-[#173d35] underline-offset-4 hover:underline">{visit.clientName}</Link>
                      <p className="mt-1 text-sm text-[#5a6b5a]">{visit.treatmentName}</p>
                    </div>
                    {visit.formCode && !visit.formSubmitted ? <span className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">{t("Brak formularza")}</span> : null}
                  </li>
                ))}
              </ul>
            ) : <p className="mt-4 rounded-xl bg-[#f7f8f4] p-4 text-sm text-[#5a6b5a]">{t("Brak wizyt na dzisiaj. Otwórz kalendarz, aby zaplanować kolejną.")}</p>}
          </>
        ) : <p className="mt-4 text-sm text-[#5a6b5a]">{t("Nie udało się pobrać dzisiejszych wizyt. Spróbuj ponownie w kalendarzu.")}</p>}
      </section>

      <dl className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div
              className={`rounded-[1.5rem] border p-5 ${
                index === 0
                  ? "border-[#245c4d] bg-[#245c4d] text-white shadow-[0_16px_34px_rgba(36,92,77,0.16)]"
                  : "border-black/5 bg-[#fcfaf8] text-[#173d35]"
              }`}
              key={stat.label}
            >
              <div className="flex items-center justify-between gap-4">
                <dt className={`text-sm font-bold ${index === 0 ? "text-white" : "text-[#5a6b5a]"}`}>{t(stat.label)}</dt>
                <span className={`flex size-9 items-center justify-center rounded-xl ${index === 0 ? "bg-white/12 text-white" : "bg-[#f1f6e9] text-[#245c4d]"}`}>
                  <Icon aria-hidden="true" className="size-4.5" />
                </span>
              </div>
              <dd className={`mt-5 text-4xl font-black tracking-[-0.04em] ${index === 0 ? "text-white" : "text-[#173d35]"}`}>
                {stat.value.toLocaleString(activeIntlLocale())}
              </dd>
              <p className={`mt-1 text-xs ${index === 0 ? "text-white" : "text-[#5a6b5a]"}`}>{t(stat.description)}</p>
            </div>
          );
        })}
      </dl>

      <div className="mt-6 grid gap-6 ">
        <section className="rounded-[1.5rem] border border-black/5 bg-[#fcfaf8] p-5 sm:p-6">
          <h2 className="text-lg font-black tracking-[-0.02em]">{t("Szybki dostęp")}</h2>
          <p className="mt-1 text-sm text-[#5a6b5a]">
            {t("Najczęściej używane obszary panelu.")}
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <QuickLink
              description={t("Wyszukaj kartotekę i sprawdź historię.")}
              href={`${basePath}/clients`}
              icon={Users}
              label={t("Klientki")}
            />
            <QuickLink
              description={t("Zarządzaj dokumentacją zabiegową.")}
              href={`${basePath}/forms`}
              icon={FileText}
              label={t("Formularze")}
            />
            <QuickLink
              description={t("Odpowiadaj klientkom przed i po zabiegu.")}
              href={`${basePath}/chat`}
              icon={MessageCircle}
              label={t("Czat")}
            />
          </div>
        </section>


      </div>

      <BeautyDocsSalonCharts analytics={analytics} />

      <p className="mt-6 text-xs text-[#5a6b5a]">{overview.tenant.legalName}</p>
    </section>
  );
}

function QuickLink({
  href,
  label,
  description,
  icon: Icon,
}: {
  readonly href: string;
  readonly label: string;
  readonly description: string;
  readonly icon: LucideIcon;
}) {
  const t = useT();
  return (
    <Link
      className="group flex items-start gap-4 rounded-2xl border border-[#e6ecdd] p-4 transition hover:border-[#b8cbaa] hover:bg-[#f6f9f3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#245c4d]"
      href={href}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#f1f6e9] text-[#245c4d] group-hover:bg-white">
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-2 font-bold">
          {t(label)}
          <ArrowRight aria-hidden="true" className="size-3.5" />
        </span>
        <span className="mt-1 block text-sm leading-5 text-[#5a6b5a]">
          {t(description)}
        </span>
      </span>
    </Link>
  );
}
