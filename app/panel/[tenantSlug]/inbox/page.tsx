import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import {
  BeautyDocsAdminInlineForbidden,
  BeautyDocsAdminInlineUnavailable,
  BeautyDocsAdminShell,
  BeautyDocsAdminUnavailable,
  BeautyDocsInbox,
} from "../../../../components/beautydocs/admin";
import {
  fetchBeautyDocsAdminNotifications,
  fetchBeautyDocsAdminSession,
  fetchBeautyDocsTenantOverview,
} from "../../../../lib/beautydocs-admin-api";
import { isValidTenantSlug } from "../../../../lib/tenant-host";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Skrzynka | BeautyDocs",
  robots: { index: false, follow: false },
};

interface BeautyDocsInboxPageProps {
  readonly params: Promise<{ tenantSlug: string }>;
}

export default async function BeautyDocsInboxPage({
  params,
}: BeautyDocsInboxPageProps) {
  const { tenantSlug } = await params;
  if (!isValidTenantSlug(tenantSlug)) notFound();

  const requestHeaders = await headers();
  const cookie = requestHeaders.get("cookie");
  const [session, overview, inbox] = await Promise.all([
    fetchBeautyDocsAdminSession(cookie),
    fetchBeautyDocsTenantOverview(tenantSlug, cookie),
    fetchBeautyDocsAdminNotifications(tenantSlug, cookie),
  ]);

  if (
    session.status === "unauthorized" ||
    overview.status === "unauthorized" ||
    inbox.status === "unauthorized"
  ) {
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

  let content;
  if (inbox.status === "forbidden") {
    content = <BeautyDocsAdminInlineForbidden />;
  } else if (inbox.status === "ok") {
    content = (
      <BeautyDocsInbox
        initialInbox={inbox.data}
        tenantSlug={overview.data.tenant.slug}
      />
    );
  } else {
    content = <BeautyDocsAdminInlineUnavailable />;
  }

  return (
    <BeautyDocsAdminShell
      activeSection="inbox"
      role={overview.data.membership.role}
      tenantName={overview.data.tenant.displayName}
      tenantSlug={overview.data.tenant.slug}
      user={session.data.user}
    >
      {content}
    </BeautyDocsAdminShell>
  );
}
