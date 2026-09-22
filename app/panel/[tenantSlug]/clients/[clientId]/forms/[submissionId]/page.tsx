import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import {
  BeautyDocsAdminInlineForbidden,
  BeautyDocsAdminInlineUnavailable,
  BeautyDocsAdminShell,
  BeautyDocsAdminUnavailable,
  BeautyDocsClientFormDetail,
} from "../../../../../../../components/beautydocs/admin";
import {
  fetchBeautyDocsAdminClientFormDetail,
  fetchBeautyDocsAdminSession,
  fetchBeautyDocsTenantOverview,
} from "../../../../../../../lib/beautydocs-admin-api";
import {
  isBeautyDocsClientId,
  isBeautyDocsSubmissionId,
} from "../../../../../../../lib/beautydocs-admin-contract";
import { isValidTenantSlug } from "../../../../../../../lib/tenant-host";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Wypełniony formularz | BeautyDocs",
  robots: { index: false, follow: false },
};

interface BeautyDocsClientFormPageProps {
  readonly params: Promise<{
    tenantSlug: string;
    clientId: string;
    submissionId: string;
  }>;
}

export default async function BeautyDocsClientFormPage({
  params,
}: BeautyDocsClientFormPageProps) {
  const { tenantSlug, clientId, submissionId } = await params;
  if (
    !isValidTenantSlug(tenantSlug) ||
    !isBeautyDocsClientId(clientId) ||
    !isBeautyDocsSubmissionId(submissionId)
  ) {
    notFound();
  }

  const requestHeaders = await headers();
  const cookie = requestHeaders.get("cookie");
  const [session, overview, form] = await Promise.all([
    fetchBeautyDocsAdminSession(cookie),
    fetchBeautyDocsTenantOverview(tenantSlug, cookie),
    fetchBeautyDocsAdminClientFormDetail(
      tenantSlug,
      clientId,
      submissionId,
      cookie,
    ),
  ]);

  if (
    session.status === "unauthorized" ||
    overview.status === "unauthorized" ||
    form.status === "unauthorized"
  ) {
    redirect("/panel");
  }
  if (session.status !== "ok") {
    return <BeautyDocsAdminUnavailable />;
  }
  if (overview.status === "not-found" || form.status === "not-found") {
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
  if (form.status === "forbidden") {
    content = <BeautyDocsAdminInlineForbidden />;
  } else if (form.status === "ok") {
    content = (
      <BeautyDocsClientFormDetail
        detail={form.data}
        tenantSlug={tenantSlug}
      />
    );
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
