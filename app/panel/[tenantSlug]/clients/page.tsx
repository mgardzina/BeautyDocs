import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import {
  BeautyDocsAdminInlineForbidden,
  BeautyDocsAdminInlineUnavailable,
  BeautyDocsAdminShell,
  BeautyDocsAdminUnavailable,
  BeautyDocsClientsInvalidQuery,
  BeautyDocsClientsList,
} from "../../../../components/beautydocs/admin";
import {
  fetchBeautyDocsAdminClients,
  fetchBeautyDocsAdminSession,
  fetchBeautyDocsTenantOverview,
} from "../../../../lib/beautydocs-admin-api";
import {
  BeautyDocsAdminContractError,
  parseBeautyDocsClientListQuery,
} from "../../../../lib/beautydocs-admin-contract";
import { isValidTenantSlug } from "../../../../lib/tenant-host";
import type { BeautyDocsAdminClientListQuery } from "../../../../types/beautydocs-admin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Klientki | BeautyDocs",
  robots: { index: false, follow: false },
};

interface BeautyDocsClientsPageProps {
  readonly params: Promise<{ tenantSlug: string }>;
  readonly searchParams: Promise<{
    search?: string | readonly string[];
    page?: string | readonly string[];
    pageSize?: string | readonly string[];
  }>;
}

export default async function BeautyDocsClientsPage({
  params,
  searchParams,
}: BeautyDocsClientsPageProps) {
  const { tenantSlug } = await params;
  if (!isValidTenantSlug(tenantSlug)) {
    notFound();
  }

  const rawSearchParams = await searchParams;
  const query = safeClientListQuery(rawSearchParams);
  const requestHeaders = await headers();
  const cookie = requestHeaders.get("cookie");
  const [session, overview, clients] = await Promise.all([
    fetchBeautyDocsAdminSession(cookie),
    fetchBeautyDocsTenantOverview(tenantSlug, cookie),
    query === null
      ? Promise.resolve(null)
      : fetchBeautyDocsAdminClients(tenantSlug, query, cookie),
  ]);

  if (
    session.status === "unauthorized" ||
    overview.status === "unauthorized" ||
    clients?.status === "unauthorized"
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
  if (clients?.status === "forbidden") {
    content = <BeautyDocsAdminInlineForbidden />;
  } else if (query === null || clients?.status === "invalid-request") {
    content = <BeautyDocsClientsInvalidQuery tenantSlug={tenantSlug} />;
  } else if (clients?.status === "ok") {
    content = (
      <BeautyDocsClientsList
        clients={clients.data}
        query={query}
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

function safeClientListQuery(
  searchParams: Awaited<BeautyDocsClientsPageProps["searchParams"]>,
): BeautyDocsAdminClientListQuery | null {
  try {
    return parseBeautyDocsClientListQuery({
      search: singleSearchParam(searchParams.search),
      page: singleSearchParam(searchParams.page),
      pageSize: singleSearchParam(searchParams.pageSize),
    });
  } catch (error) {
    if (error instanceof BeautyDocsAdminContractError) {
      return null;
    }
    throw error;
  }
}

function singleSearchParam(value: string | readonly string[] | undefined): string | null {
  if (value === undefined) {
    return null;
  }
  if (typeof value !== "string") {
    throw new BeautyDocsAdminContractError("query parameter must occur once");
  }
  return value;
}
