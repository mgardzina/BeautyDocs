import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import {
  BeautyDocsAdminInlineForbidden,
  BeautyDocsAdminShell,
  BeautyDocsAdminUnavailable,
  BeautyDocsTeamManager,
} from "../../../../components/beautydocs/admin";
import {
  fetchBeautyDocsAdminSession,
  fetchBeautyDocsAdminForms,
  fetchBeautyDocsAdminTeam,
  fetchBeautyDocsTenantOverview,
} from "../../../../lib/beautydocs-admin-api";
import { isValidTenantSlug } from "../../../../lib/tenant-host";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Zespół | BeautyDocs",
  robots: { index: false, follow: false },
};

interface TeamPageProps {
  readonly params: Promise<{ tenantSlug: string }>;
}

export default async function TeamPage({ params }: TeamPageProps) {
  const { tenantSlug } = await params;
  if (!isValidTenantSlug(tenantSlug)) notFound();

  const cookie = (await headers()).get("cookie");
  const [session, overview, team, forms] = await Promise.all([
    fetchBeautyDocsAdminSession(cookie),
    fetchBeautyDocsTenantOverview(tenantSlug, cookie),
    fetchBeautyDocsAdminTeam(tenantSlug, cookie),
    fetchBeautyDocsAdminForms(tenantSlug, cookie),
  ]);

  if (
    session.status === "unauthorized" ||
    overview.status === "unauthorized" ||
    team.status === "unauthorized" ||
    forms.status === "unauthorized"
  ) {
    redirect("/panel");
  }
  if (session.status !== "ok") return <BeautyDocsAdminUnavailable />;
  if (
    overview.status === "not-found" ||
    team.status === "not-found" ||
    forms.status === "not-found"
  ) notFound();
  if (
    overview.status === "forbidden" ||
    team.status === "forbidden" ||
    forms.status === "forbidden"
  ) {
    return (
      <BeautyDocsAdminShell user={session.data.user}>
        <BeautyDocsAdminInlineForbidden />
      </BeautyDocsAdminShell>
    );
  }
  if (
    overview.status !== "ok" ||
    team.status !== "ok" ||
    forms.status !== "ok"
  ) {
    return <BeautyDocsAdminUnavailable />;
  }

  return (
    <BeautyDocsAdminShell
      activeSection="team"
      role={overview.data.membership.role}
      tenantName={overview.data.tenant.displayName}
      tenantSlug={overview.data.tenant.slug}
      user={session.data.user}
    >
      <BeautyDocsTeamManager
        availableTreatments={forms.data.forms.filter((form) => form.enabled)}
        initialTeam={team.data}
        tenantSlug={overview.data.tenant.slug}
      />
    </BeautyDocsAdminShell>
  );
}
