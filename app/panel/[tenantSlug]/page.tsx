import { getServerTranslator } from "../../../lib/i18n/server";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import {
  BeautyDocsAdminShell,
  BeautyDocsAdminUnavailable,
  BeautyDocsTenantOverview,
} from "../../../components/beautydocs/admin";
import {
  fetchBeautyDocsAdminSession,
  fetchBeautyDocsTenantAnalytics,
  fetchBeautyDocsTenantVisits,
  fetchBeautyDocsTenantOverview,
} from "../../../lib/beautydocs-admin-api";
import { isValidTenantSlug } from "../../../lib/tenant-host";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Przegląd salonu | BeautyDocs",
  robots: { index: false, follow: false },
};

interface BeautyDocsTenantAdminPageProps {
  readonly params: Promise<{ tenantSlug: string }>;
}

export default async function BeautyDocsTenantAdminPage({
  params,
}: BeautyDocsTenantAdminPageProps) {
  const { t } = await getServerTranslator();
  const { tenantSlug } = await params;
  if (!isValidTenantSlug(tenantSlug)) {
    notFound();
  }

  const requestHeaders = await headers();
  const cookie = requestHeaders.get("cookie");
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Warsaw", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const [session, overview, analytics, visits] = await Promise.all([
    fetchBeautyDocsAdminSession(cookie),
    fetchBeautyDocsTenantOverview(tenantSlug, cookie),
    fetchBeautyDocsTenantAnalytics(tenantSlug, cookie),
    fetchBeautyDocsTenantVisits(tenantSlug, today, today, cookie),
  ]);

  if (session.status === "unauthorized" || overview.status === "unauthorized") {
    redirect("/panel");
  }
  if (session.status !== "ok") {
    return <BeautyDocsAdminUnavailable />;
  }
  if (overview.status === "not-found") {
    notFound();
  }
  if (overview.status === "forbidden") {
    return (
      <BeautyDocsAdminShell user={session.data.user}>
        <div className="rounded-2xl border border-stone-200 bg-white p-6">
          <h1 className="text-2xl font-bold">{t("Brak dostępu do salonu")}</h1>
          <p className="mt-3 text-stone-600">
            {t("Twoje konto nie posiada aktywnego członkostwa w tym salonie.")}
          </p>
        </div>
      </BeautyDocsAdminShell>
    );
  }
  if (overview.status !== "ok") {
    return <BeautyDocsAdminUnavailable />;
  }

  return (
    <BeautyDocsAdminShell
      activeSection="overview"
      role={overview.data.membership.role}
      tenantName={overview.data.tenant.displayName}
      tenantSlug={overview.data.tenant.slug}
      user={session.data.user}
    >
      <BeautyDocsTenantOverview
        analytics={analytics.status === "ok" ? analytics.data : null}
        todayVisits={visits.status === "ok" ? visits.data.items : null}
        overview={overview.data}
        tenantSlug={overview.data.tenant.slug}
      />
    </BeautyDocsAdminShell>
  );
}
