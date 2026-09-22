import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import {
  BeautyDocsAdminInlineForbidden,
  BeautyDocsAdminShell,
  BeautyDocsAdminUnavailable,
  BeautyDocsVisitsCalendar,
} from "@/components/beautydocs/admin";
import {
  fetchBeautyDocsAdminSession,
  fetchBeautyDocsTenantOverview,
} from "@/lib/beautydocs-admin-api";
import { isValidTenantSlug } from "@/lib/tenant-host";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Kalendarz | BeautyDocs",
  robots: { index: false, follow: false },
};

export default async function BeautyDocsVisitsPage({
  params,
}: {
  readonly params: Promise<{ readonly tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  if (!isValidTenantSlug(tenantSlug)) notFound();
  const cookie = (await headers()).get("cookie");
  const [session, overview] = await Promise.all([
    fetchBeautyDocsAdminSession(cookie),
    fetchBeautyDocsTenantOverview(tenantSlug, cookie),
  ]);
  if (session.status === "unauthorized" || overview.status === "unauthorized") {
    redirect("/konto");
  }
  if (session.status !== "ok") return <BeautyDocsAdminUnavailable />;
  if (overview.status === "not-found") notFound();
  if (overview.status === "forbidden") {
    return (
      <BeautyDocsAdminShell user={session.data.user}>
        <BeautyDocsAdminInlineForbidden />
      </BeautyDocsAdminShell>
    );
  }
  if (overview.status !== "ok") return <BeautyDocsAdminUnavailable />;

  return (
    <BeautyDocsAdminShell
      activeSection="visits"
      role={overview.data.membership.role}
      tenantName={overview.data.tenant.displayName}
      tenantSlug={overview.data.tenant.slug}
      user={session.data.user}
    >
      <BeautyDocsVisitsCalendar tenantSlug={overview.data.tenant.slug} />
    </BeautyDocsAdminShell>
  );
}
