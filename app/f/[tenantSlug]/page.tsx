import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicTenantShell, PublicTenantUnavailable, TenantActiveForms } from "../../../components/beautydocs";
import { fetchPublicTenantConfig } from "../../../lib/beautydocs-api";
import { isValidTenantSlug } from "../../../lib/tenant-host";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Formularze salonu | BeautyDocs",
  robots: { index: false, follow: false },
};

interface PublicFormsCataloguePageProps {
  readonly params: Promise<{ tenantSlug: string }>;
  readonly searchParams: Promise<{ readonly from?: string }>;
}

export default async function PublicFormsCataloguePage({
  params,
  searchParams,
}: PublicFormsCataloguePageProps) {
  const { tenantSlug } = await params;
  if (!isValidTenantSlug(tenantSlug)) {
    notFound();
  }

  const { from } = await searchParams;

  const result = await fetchPublicTenantConfig(tenantSlug);
  if (result.status === "not-found") {
    notFound();
  }
  if (result.status === "unavailable") {
    return <PublicTenantUnavailable />;
  }

  return (
    <PublicTenantShell tenant={result.config}>
      <TenantActiveForms
        forms={result.config.activeForms}
        tenantSlug={result.config.slug}
        fromAdmin={from === "admin"}
        fromConsumer={from === "consumer"}
      />
    </PublicTenantShell>
  );
}
