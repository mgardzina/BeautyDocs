import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import {
  BeautyDocsAdminInlineForbidden,
  BeautyDocsAdminInlineUnavailable,
  BeautyDocsAdminShell,
  BeautyDocsAdminUnavailable,
  BeautyDocsClientProfile,
} from "../../../../../components/beautydocs/admin";
import {
  fetchBeautyDocsAdminClientProfile,
  fetchBeautyDocsAdminSession,
  fetchBeautyDocsTenantOverview,
} from "../../../../../lib/beautydocs-admin-api";
import { isBeautyDocsClientId } from "../../../../../lib/beautydocs-admin-contract";
import { isValidTenantSlug } from "../../../../../lib/tenant-host";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Profil klientki | BeautyDocs",
  robots: { index: false, follow: false },
};

interface BeautyDocsClientProfilePageProps {
  readonly params: Promise<{ tenantSlug: string; clientId: string }>;
}

export default async function BeautyDocsClientProfilePage({
  params,
}: BeautyDocsClientProfilePageProps) {
  const { tenantSlug, clientId } = await params;
  if (!isValidTenantSlug(tenantSlug) || !isBeautyDocsClientId(clientId)) {
    notFound();
  }

  const requestHeaders = await headers();
  const cookie = requestHeaders.get("cookie");
  const [session, overview, profile] = await Promise.all([
    fetchBeautyDocsAdminSession(cookie),
    fetchBeautyDocsTenantOverview(tenantSlug, cookie),
    fetchBeautyDocsAdminClientProfile(tenantSlug, clientId, cookie),
  ]);

  if (
    session.status === "unauthorized" ||
    overview.status === "unauthorized" ||
    profile.status === "unauthorized"
  ) {
    redirect("/panel");
  }
  if (session.status !== "ok") {
    return <BeautyDocsAdminUnavailable />;
  }
  if (overview.status === "not-found" || profile.status === "not-found") {
    notFound();
  }
  if (overview.status === "forbidden") {
    return (
      <BeautyDocsAdminShell user={session.data.user}>
        <BeautyDocsAdminInlineForbidden />
      </BeautyDocsAdminShell>
    );
  }
  if (overview.status !== "ok") {
    return <BeautyDocsAdminUnavailable />;
  }

  let content;
  if (profile.status === "forbidden") {
    content = <BeautyDocsAdminInlineForbidden />;
  } else if (profile.status === "ok") {
    content = <BeautyDocsClientProfile profile={profile.data} tenantSlug={tenantSlug} />;
  } else {
    content = <BeautyDocsAdminInlineUnavailable />;
  }

  return (
    <BeautyDocsAdminShell
      activeSection="clients"
      role={overview.data.membership.role}
      tenantName={overview.data.tenant.displayName}
      tenantSlug={overview.data.tenant.slug}
      user={session.data.user}
    >
      {content}
    </BeautyDocsAdminShell>
  );
}
