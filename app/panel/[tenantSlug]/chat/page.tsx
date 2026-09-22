import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { BeautyDocsChat } from "../../../../components/beautydocs/BeautyDocsChat";
import {
  BeautyDocsAdminInlineForbidden,
  BeautyDocsAdminShell,
  BeautyDocsAdminUnavailable,
} from "../../../../components/beautydocs/admin";
import {
  fetchBeautyDocsAdminSession,
  fetchBeautyDocsTenantOverview,
} from "../../../../lib/beautydocs-admin-api";
import { isValidTenantSlug } from "../../../../lib/tenant-host";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Czat | BeautyDocs",
  robots: { index: false, follow: false },
};

interface BeautyDocsChatPageProps {
  readonly params: Promise<{ tenantSlug: string }>;
}

export default async function BeautyDocsChatPage({ params }: BeautyDocsChatPageProps) {
  const { tenantSlug } = await params;
  if (!isValidTenantSlug(tenantSlug)) notFound();

  const requestHeaders = await headers();
  const cookie = requestHeaders.get("cookie");
  const [session, overview] = await Promise.all([
    fetchBeautyDocsAdminSession(cookie),
    fetchBeautyDocsTenantOverview(tenantSlug, cookie),
  ]);

  if (session.status === "unauthorized" || overview.status === "unauthorized") {
    redirect("/panel");
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
      activeSection="chat"
      role={overview.data.membership.role}
      tenantName={overview.data.tenant.displayName}
      tenantSlug={overview.data.tenant.slug}
      user={session.data.user}
    >
      <BeautyDocsChat
        canAssignPractitioner={overview.data.membership.role === "OWNER" || overview.data.membership.role === "ADMIN"}
        canWrite={overview.data.membership.role !== "READ_ONLY"}
        mode="admin"
        tenantSlug={overview.data.tenant.slug}
      />
    </BeautyDocsAdminShell>
  );
}
