import { CalendarDays, ClipboardList, Settings, UsersRound } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import {
  BeautyDocsAdminComingSoon,
  BeautyDocsAdminInlineForbidden,
  BeautyDocsAdminShell,
  BeautyDocsAdminUnavailable,
  type BeautyDocsAdminSection,
} from "../../../../components/beautydocs/admin";
import {
  fetchBeautyDocsAdminSession,
  fetchBeautyDocsTenantOverview,
} from "../../../../lib/beautydocs-admin-api";
import { isValidTenantSlug } from "../../../../lib/tenant-host";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Panel salonu | BeautyDocs",
  robots: { index: false, follow: false },
};

const sectionConfig = {
  forms: {
    title: "Formularze",
    eyebrow: "Dokumentacja zabiegowa",
    description: "Wspólny katalog formularzy oraz przypisania dostępne w tym salonie.",
    icon: ClipboardList,
  },
  visits: {
    title: "Kalendarz",
    eyebrow: "Kalendarz salonu",
    description: "Planowane i zakończone wizyty wszystkich klientek salonu.",
    icon: CalendarDays,
  },
  team: {
    title: "Zespół",
    eyebrow: "Dostępy i role",
    description: "Członkowie zespołu, role oraz zakres dostępu do danych salonu.",
    icon: UsersRound,
  },
  settings: {
    title: "Ustawienia",
    eyebrow: "Konfiguracja salonu",
    description: "Dane firmy, informacje kontaktowe i ustawienia wspólnego panelu.",
    icon: Settings,
  },
} as const satisfies Partial<Record<BeautyDocsAdminSection, object>>;

interface BeautyDocsAdminSectionPageProps {
  readonly params: Promise<{ tenantSlug: string; section: string }>;
}

export default async function BeautyDocsAdminSectionPage({
  params,
}: BeautyDocsAdminSectionPageProps) {
  const { tenantSlug, section } = await params;
  if (!isValidTenantSlug(tenantSlug) || !isPlaceholderSection(section)) {
    notFound();
  }

  const requestHeaders = await headers();
  const cookie = requestHeaders.get("cookie");
  const [session, overview] = await Promise.all([
    fetchBeautyDocsAdminSession(cookie),
    fetchBeautyDocsTenantOverview(tenantSlug, cookie),
  ]);

  if (session.status === "unauthorized" || overview.status === "unauthorized") {
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

  const config = sectionConfig[section];
  return (
    <BeautyDocsAdminShell
      activeSection={section}
      role={overview.data.membership.role}
      tenantName={overview.data.tenant.displayName}
      tenantSlug={overview.data.tenant.slug}
      user={session.data.user}
    >
      <BeautyDocsAdminComingSoon {...config} />
    </BeautyDocsAdminShell>
  );
}

function isPlaceholderSection(
  value: string,
): value is keyof typeof sectionConfig {
  return Object.hasOwn(sectionConfig, value);
}
