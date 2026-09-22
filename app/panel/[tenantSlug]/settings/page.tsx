import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import {
  BeautyDocsAdminInlineForbidden,
  BeautyDocsAdminShell,
  BeautyDocsAdminUnavailable,
  BeautyDocsTenantSettingsPanel,
} from "../../../../components/beautydocs/admin";
import {
  fetchBeautyDocsAdminSession,
  fetchBeautyDocsTenantSettings,
  fetchBeautyDocsTenantOverview,
} from "../../../../lib/beautydocs-admin-api";
import { isValidTenantSlug } from "../../../../lib/tenant-host";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ustawienia salonu | BeautyDocs",
  robots: { index: false, follow: false },
};

export default async function BeautyDocsTenantSettingsPage({
  params,
}: {
  readonly params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  if (!isValidTenantSlug(tenantSlug)) notFound();
  const cookie = (await headers()).get("cookie");
  const [session, settings, overview] = await Promise.all([
    fetchBeautyDocsAdminSession(cookie),
    fetchBeautyDocsTenantSettings(tenantSlug, cookie),
    fetchBeautyDocsTenantOverview(tenantSlug, cookie),
  ]);
  if (session.status === "unauthorized" || settings.status === "unauthorized") {
    redirect("/konto");
  }
  if (session.status !== "ok") return <BeautyDocsAdminUnavailable />;
  if (settings.status === "not-found") notFound();
  if (settings.status === "forbidden") {
    return (
      <BeautyDocsAdminShell user={session.data.user}>
        <BeautyDocsAdminInlineForbidden />
      </BeautyDocsAdminShell>
    );
  }
  if (settings.status !== "ok") return <BeautyDocsAdminUnavailable />;

  return (
    <BeautyDocsAdminShell
      activeSection="settings"
      role={settings.data.role}
      tenantName={settings.data.displayName}
      tenantSlug={settings.data.slug}
      user={session.data.user}
    >
      <BeautyDocsTenantSettingsPanel
        capabilities={overview.status === "ok" ? overview.data.capabilities : null}
        initialSettings={settings.data}
      />
    </BeautyDocsAdminShell>
  );
}
