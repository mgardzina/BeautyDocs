import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import {
  BeautyDocsAdminInlineForbidden,
  BeautyDocsAdminInlineUnavailable,
  BeautyDocsAdminShell,
  BeautyDocsAdminUnavailable,
  BeautyDocsCatalogManager,
} from "../../../../components/beautydocs/admin";
import {
  fetchBeautyDocsAdminForms,
  fetchBeautyDocsAdminSession,
  fetchBeautyDocsTenantOverview,
} from "../../../../lib/beautydocs-admin-api";
import { fetchBeautyDocsSalonCatalog } from "../../../../lib/beautydocs-catalog-api";
import { isValidTenantSlug } from "../../../../lib/tenant-host";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Produkty i urządzenia | BeautyDocs",
  robots: { index: false, follow: false },
};

export default async function BeautyDocsCatalogPage({
  params,
}: {
  readonly params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  if (!isValidTenantSlug(tenantSlug)) notFound();

  const cookie = (await headers()).get("cookie");
  const [session, overview, forms, catalog] = await Promise.all([
    fetchBeautyDocsAdminSession(cookie),
    fetchBeautyDocsTenantOverview(tenantSlug, cookie),
    fetchBeautyDocsAdminForms(tenantSlug, cookie),
    fetchBeautyDocsSalonCatalog(tenantSlug, cookie),
  ]);

  if (
    session.status === "unauthorized" ||
    overview.status === "unauthorized" ||
    forms.status === "unauthorized" ||
    catalog.status === "unauthorized"
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
  if (forms.status === "forbidden" || catalog.status === "forbidden") {
    content = <BeautyDocsAdminInlineForbidden />;
  } else if (forms.status === "ok" && catalog.status === "ok") {
    content = (
      <BeautyDocsCatalogManager
        forms={forms.data}
        initialCatalog={catalog.data}
        tenantSlug={overview.data.tenant.slug}
      />
    );
  } else {
    content = <BeautyDocsAdminInlineUnavailable />;
  }

  return (
    <BeautyDocsAdminShell
      activeSection="catalog"
      role={overview.data.membership.role}
      tenantName={overview.data.tenant.displayName}
      tenantSlug={overview.data.tenant.slug}
      user={session.data.user}
    >
      {content}
    </BeautyDocsAdminShell>
  );
}
