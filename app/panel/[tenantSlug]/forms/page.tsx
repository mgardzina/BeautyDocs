import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import {
  BeautyDocsAdminInlineForbidden,
  BeautyDocsAdminInlineUnavailable,
  BeautyDocsAdminShell,
  BeautyDocsAdminUnavailable,
  BeautyDocsFormsManager,
} from "../../../../components/beautydocs/admin";
import {
  fetchBeautyDocsAdminForms,
  fetchBeautyDocsAdminSession,
  fetchBeautyDocsTenantOverview,
} from "../../../../lib/beautydocs-admin-api";
import { isValidTenantSlug } from "../../../../lib/tenant-host";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Formularze | BeautyDocs",
  robots: { index: false, follow: false },
};

interface BeautyDocsFormsPageProps {
  readonly params: Promise<{ tenantSlug: string }>;
}

export default async function BeautyDocsFormsPage({
  params,
}: BeautyDocsFormsPageProps) {
  const { tenantSlug } = await params;
  if (!isValidTenantSlug(tenantSlug)) {
    notFound();
  }

  const requestHeaders = await headers();
  const cookie = requestHeaders.get("cookie");
  const [session, overview, forms] = await Promise.all([
    fetchBeautyDocsAdminSession(cookie),
    fetchBeautyDocsTenantOverview(tenantSlug, cookie),
    fetchBeautyDocsAdminForms(tenantSlug, cookie),
  ]);

  if (
    session.status === "unauthorized" ||
    overview.status === "unauthorized" ||
    forms.status === "unauthorized"
  ) {
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
        <BeautyDocsAdminInlineForbidden />
      </BeautyDocsAdminShell>
    );
  }
  if (overview.status !== "ok") {
    return <BeautyDocsAdminUnavailable />;
  }

  let content;
  if (forms.status === "forbidden") {
    content = <BeautyDocsAdminInlineForbidden />;
  } else if (forms.status === "ok") {
    content = (
      <BeautyDocsFormsManager
        initialForms={forms.data}
        tenantSlug={overview.data.tenant.slug}
      />
    );
  } else {
    content = <BeautyDocsAdminInlineUnavailable />;
  }

  return (
    <BeautyDocsAdminShell
      activeSection="forms"
      role={overview.data.membership.role}
      tenantName={overview.data.tenant.displayName}
      tenantSlug={overview.data.tenant.slug}
      user={session.data.user}
    >
      {content}
    </BeautyDocsAdminShell>
  );
}
