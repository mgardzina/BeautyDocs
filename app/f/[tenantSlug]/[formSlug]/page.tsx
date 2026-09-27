import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicTenantShell } from "../../../../components/beautydocs";
import {
  BeautyDocsFormFlow,
  PublicFormUnavailable,
} from "../../../../components/beautydocs/forms";
import {
  fetchPublicTenantConfig,
  fetchPublicTenantForm,
} from "../../../../lib/beautydocs-api";
import {
  findActiveFormBySlug,
  isValidFormSlug,
} from "../../../../lib/beautydocs-form-path";
import { getRequestLocale } from "../../../../lib/i18n/server";
import { isValidTenantSlug } from "../../../../lib/tenant-host";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Formularz zabiegowy | BeautyDocs",
  robots: { index: false, follow: false },
};

interface PublicFormStartPageProps {
  readonly params: Promise<{ tenantSlug: string; formSlug: string }>;
  readonly searchParams: Promise<{
    readonly appointment?: string;
    readonly bookingToken?: string;
    readonly from?: string;
  }>;
}

export default async function PublicFormStartPage({
  params,
  searchParams,
}: PublicFormStartPageProps) {
  const { tenantSlug, formSlug } = await params;
  const { appointment, bookingToken, from } = await searchParams;
  if (!isValidTenantSlug(tenantSlug) || !isValidFormSlug(formSlug)) {
    notFound();
  }

  const locale = await getRequestLocale();
  const [configResult, formResult] = await Promise.all([
    fetchPublicTenantConfig(tenantSlug, locale),
    fetchPublicTenantForm(tenantSlug, formSlug, locale),
  ]);

  if (configResult.status === "not-found") {
    notFound();
  }
  if (configResult.status === "unavailable") {
    return <PublicFormUnavailable />;
  }

  // The salon must currently have this form enabled in its active catalogue.
  if (findActiveFormBySlug(configResult.config.activeForms, formSlug) === null) {
    notFound();
  }

  if (formResult.status === "not-found") {
    notFound();
  }
  if (formResult.status !== "ok") {
    return <PublicFormUnavailable />;
  }

  return (
    <PublicTenantShell tenant={configResult.config}>
      <BeautyDocsFormFlow
        appointmentId={
          appointment && /^[0-9a-f-]{36}$/i.test(appointment)
            ? appointment
            : undefined
        }
        bookingToken={
          bookingToken && /^[A-Za-z0-9_-]{43}$/.test(bookingToken)
            ? bookingToken
            : undefined
        }
        form={formResult.content}
        fromAdmin={from === "admin"}
        fromConsumer={from === "consumer"}
        tenant={configResult.config}
      />
    </PublicTenantShell>
  );
}
