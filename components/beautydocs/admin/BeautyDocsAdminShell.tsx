"use client";

import { BeautyDocsLanguageMenu, useT } from "../i18n";
import {
  ArrowLeft,
  Bell,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  MessageCircle,
  MessageSquareHeart,
  PackageSearch,
  Settings,
  Sparkles,
  Users,
  UserRound,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { Popover } from "radix-ui";
import { useEffect, useState, type ReactNode } from "react";
import type { BeautyDocsAdminNotificationList } from "../../../types/beautydocs-admin";
import type { BeautyDocsMembershipRole } from "../../../types/beautydocs-admin";
import type { BeautyDocsChatConversationList } from "../../../types/beautydocs-chat";
import {
  BeautyDocsSidebar,
  BeautyDocsSidebarNav,
  type BeautyDocsSidebarGroup,
} from "../BeautyDocsSidebar";
import { BeautyDocsLogo } from "../BeautyDocsLogo";
import { BeautyDocsChatBubble } from "../BeautyDocsChatBubble";
import { BeautyDocsLogoutButton } from "./BeautyDocsLogoutButton";

export type BeautyDocsAdminSection =
  | "overview"
  | "clients"
  | "forms"
  | "catalog"
  | "inbox"
  | "chat"
  | "visits"
  | "team"
  | "settings";

interface BeautyDocsAdminShellProps {
  readonly user: {
    readonly displayName: string;
    readonly email: string;
  };
  readonly tenantSlug?: string;
  readonly tenantName?: string;
  readonly role?: BeautyDocsMembershipRole;
  readonly activeSection?: BeautyDocsAdminSection;
  readonly children: ReactNode;
}

interface NavigationItem {
  readonly section: BeautyDocsAdminSection;
  readonly label: string;
  readonly suffix: string;
  readonly icon: LucideIcon;
  readonly group: string;
}

const NAV_GROUP_ORDER = ["Menu", "Komunikacja", "Zarządzanie"] as const;

const navigationItems: readonly NavigationItem[] = [
  { section: "overview", label: "Przegląd", suffix: "", icon: LayoutDashboard, group: "Menu" },
  { section: "clients", label: "Klientki", suffix: "/clients", icon: Users, group: "Menu" },
  { section: "visits", label: "Kalendarz", suffix: "/visits", icon: CalendarDays, group: "Menu" },
  { section: "inbox", label: "Skrzynka", suffix: "/inbox", icon: Mail, group: "Komunikacja" },
  { section: "chat", label: "Czat", suffix: "/chat", icon: MessageCircle, group: "Komunikacja" },
  { section: "forms", label: "Formularze", suffix: "/forms", icon: ClipboardList, group: "Zarządzanie" },
  { section: "catalog", label: "Produkty i urządzenia", suffix: "/catalog", icon: PackageSearch, group: "Zarządzanie" },
  { section: "team", label: "Zespół", suffix: "/team", icon: UsersRound, group: "Zarządzanie" },
] as const;

function buildAdminGroups(
  basePath: string,
  activeSection: BeautyDocsAdminSection,
  unreadCount: number,
  unreadChatCount: number,
): BeautyDocsSidebarGroup[] {
  return NAV_GROUP_ORDER.map((label) => ({
    label,
    items: navigationItems
      .filter((item) => item.group === label)
      .map((item) => ({
        icon: item.icon,
        label: item.label,
        badge:
          item.section === "inbox"
            ? unreadCount
            : item.section === "chat"
              ? unreadChatCount
              : undefined,
        active: activeSection === item.section,
        href: `${basePath}${item.suffix}`,
      })),
  }));
}

export function BeautyDocsAdminShell({
  user,
  tenantSlug,
  tenantName,
  role,
  activeSection = "overview",
  children,
}: BeautyDocsAdminShellProps) {
  const t = useT();
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  useEffect(() => {
    if (!tenantSlug || !tenantName || !role) return;
    let cancelled = false;
    const loadUnreadCount = async () => {
      try {
        const basePath = `/api/beautydocs-preview/admin/tenants/${encodeURIComponent(tenantSlug)}`;
        const [notificationResponse, chatResponse] = await Promise.all([
          fetch(`${basePath}/notifications`, { cache: "no-store", credentials: "same-origin" }),
          fetch(`${basePath}/chats`, { cache: "no-store", credentials: "same-origin" }),
        ]);
        if (notificationResponse.ok) {
          const inbox = (await notificationResponse.json()) as BeautyDocsAdminNotificationList;
          if (!cancelled && Number.isInteger(inbox.unreadCount)) {
            setUnreadCount(Math.max(0, inbox.unreadCount));
          }
        }
        if (chatResponse.ok) {
          const chats = (await chatResponse.json()) as BeautyDocsChatConversationList;
          if (!cancelled && Number.isInteger(chats.unreadCount)) {
            setUnreadChatCount(Math.max(0, chats.unreadCount));
          }
        }
      } catch {
        // The inbox badge is supplementary; the rest of the panel stays available.
      }
    };
    const handleUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ unreadCount?: unknown }>).detail;
      if (typeof detail?.unreadCount === "number") {
        setUnreadCount(Math.max(0, Math.trunc(detail.unreadCount)));
      }
    };
    const handleChatUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ unreadCount?: unknown }>).detail;
      if (typeof detail?.unreadCount === "number") {
        setUnreadChatCount(Math.max(0, Math.trunc(detail.unreadCount)));
      }
    };
    void loadUnreadCount();
    const timer = window.setInterval(loadUnreadCount, 15_000);
    window.addEventListener("focus", loadUnreadCount);
    window.addEventListener("beautydocs:notifications-updated", handleUpdate);
    window.addEventListener("beautydocs:chat-updated", handleChatUpdate);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", loadUnreadCount);
      window.removeEventListener("beautydocs:notifications-updated", handleUpdate);
      window.removeEventListener("beautydocs:chat-updated", handleChatUpdate);
    };
  }, [role, tenantName, tenantSlug]);

  if (!tenantSlug || !tenantName || !role) {
    return <AccountShell>{children}</AccountShell>;
  }

  const catalogFocus = activeSection === "catalog";
  const basePath = `/panel/${encodeURIComponent(tenantSlug)}`;
  const groups = buildAdminGroups(
    basePath,
    activeSection,
    unreadCount,
    unreadChatCount,
  );

  return (
    <div className="min-h-screen bg-[#f7f8f4] font-sans text-[#173d35]">
      <div className={catalogFocus ? "min-h-screen" : "lg:grid lg:min-h-screen lg:grid-cols-[16rem_minmax(0,1fr)]"}>
        {!catalogFocus && <aside className="hidden border-r border-[#e7ecdf] bg-[#f8fbf5] lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
          <BeautyDocsSidebar
            context={
              <Link
                className="block rounded-2xl border border-[#e4ecd9] bg-[#f1f6eb] px-3.5 py-2.5 transition hover:border-[#cdd7c6] hover:bg-[#eef4e6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#245c4d]"
                href="/panel"
              >
                <span className="block truncate text-[13px] font-black text-[#173d35]">
                  {tenantName}
                </span>
                <span className="mt-0.5 block text-xs text-[#5a6b5a]">
                  {t(roleLabel(role))} {t("· zmień salon")}
                </span>
              </Link>
            }
            footer={
              <AdminSidebarBottom basePath={basePath} role={role} settingsActive={activeSection === "settings"} />
            }
            footerLabel={null}
            groups={groups}
            logoHref={basePath}
            subtitle={t("Panel salonu")}
          />
        </aside>}

        <div className="min-w-0">
          <header className="sticky top-0 z-20 border-b border-black/5 bg-[#fcfaf8]/95 backdrop-blur lg:hidden">
            <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
              <Link className="flex min-w-0 items-center" href={basePath}>
                <span className="min-w-0">
                  <BeautyDocsLogo className="block text-base text-[#173d35]" />
                  <span className="block truncate text-sm font-bold">{tenantName}</span>
                  <span className="block text-xs text-[#5a6b5a]">{roleLabel(role)}</span>
                </span>
              </Link>
              <div className="flex items-center gap-2">
                <BeautyDocsLanguageMenu account="owner" />
                <AdminProfileMenu basePath={basePath} compact user={user} />
              </div>
            </div>
            <MobileAdminNavigation groups={groups} basePath={basePath} activeSection={activeSection} />
          </header>

          <header className="hidden h-[74px] items-center justify-between gap-4 border-b border-black/5 bg-[#fcfaf8]/80 px-8 backdrop-blur lg:flex">
            <div className="flex min-w-0 items-center gap-4">
              {catalogFocus && <Link href={basePath} aria-label="BeautyDocs — panel salonu" className="shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#245c4d]"><BeautyDocsLogo className="text-base text-[#173d35]" /></Link>}
              {catalogFocus && <Link href={basePath} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-[#173d35] hover:bg-[#e8eedf] active:bg-[#dce5d1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#245c4d]"><ArrowLeft size={18} aria-hidden="true" /> {t("Wróć do panelu")}</Link>}
              <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#5a6b5a]">{t("Panel salonu")}</p>
              <p className="mt-1 truncate text-sm font-bold text-[#173d35]">{tenantName}</p>
            </div>
            </div>
            <div className="flex shrink-0 items-center gap-2.5">
              <Link
                className="rounded-full border border-[#cdd7c6] bg-white px-4 py-2 text-xs font-black text-[#245c4d] transition hover:border-[#b4c69a] hover:bg-[#f8faf4]"
                href={`/f/${encodeURIComponent(tenantSlug)}?from=admin`}
              >
                {t("Otwórz formularze publiczne")}
              </Link>
              <Link
                aria-label={unreadCount > 0 ? t("Skrzynka — {count} nieprzeczytanych", { count: unreadCount }) : t("Skrzynka")}
                className="relative grid size-10 place-items-center rounded-full border border-[#dce1d4] bg-white text-[#5a6b5a] transition hover:border-[#b8cbaa] hover:bg-[#f5f8f1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#245c4d]"
                href={`${basePath}/inbox`}
              >
                <Bell className="size-[18px]" />
                {unreadCount > 0 ? (
                  <span className="absolute -right-0.5 -top-0.5 grid min-w-[18px] place-items-center rounded-full bg-[#245c4d] px-1 text-xs font-black leading-4 text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                ) : null}
              </Link>
              <BeautyDocsLanguageMenu account="owner" />
              <AdminProfileMenu basePath={basePath} user={user} />
            </div>
          </header>

          <main className={`mx-auto w-full ${catalogFocus ? "" : "max-w-[1500px]"} px-4 py-7 sm:px-6 sm:py-9 lg:px-8 lg:py-8 xl:px-10`}>
            {children}
          </main>
        </div>
      </div>
      {activeSection !== "chat" ? (
        <BeautyDocsChatBubble
          canAssignPractitioner={role === "OWNER" || role === "ADMIN"}
          canWrite={role !== "READ_ONLY"}
          mode="admin"
          tenantSlug={tenantSlug}
          unreadCount={unreadChatCount}
        />
      ) : null}
    </div>
  );
}

function MobileAdminNavigation({ groups, basePath, activeSection }: {
  readonly groups: BeautyDocsSidebarGroup[];
  readonly basePath: string;
  readonly activeSection: BeautyDocsAdminSection;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const primaryItems = groups[0].items;
  const moreActive = !["overview", "clients", "visits"].includes(activeSection);
  const currentLabel = t(navigationItems.find((item) => item.section === activeSection)?.label ?? "Ustawienia salonu");
  const unread = groups.slice(1).flatMap((group) => group.items).reduce((sum, item) => sum + (item.badge ?? 0), 0);

  return (
    <nav aria-label={t("Nawigacja salonu")} className="px-3 pb-3">
      <div className="grid grid-cols-4 gap-1">
        {primaryItems.map((item) => (
          <Link key={item.href} href={item.href!} aria-current={item.active ? "page" : undefined}
            className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-xs font-semibold ${item.active ? "bg-[#245c4d] text-white" : "text-[#5a6b5a] hover:bg-[#eff4e7] active:bg-[#eff4e7]"}`}>
            <item.icon aria-hidden="true" className="size-5" />{t(item.label)}
          </Link>
        ))}
        <Popover.Root open={open} onOpenChange={setOpen}>
          <Popover.Trigger asChild>
            <button type="button" aria-label={unread ? t("Więcej sekcji, {count} nieprzeczytanych wiadomości", { count: unread }) : t("Więcej sekcji")}
              className={`relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-xs font-semibold ${moreActive ? "bg-[#245c4d] text-white" : "text-[#5a6b5a] hover:bg-[#eff4e7]"}`}>
              <Menu aria-hidden="true" className="size-5" />{t("Więcej")}
              {unread > 0 ? <span aria-hidden="true" className="absolute right-2 top-1 size-2 rounded-full bg-red-600 ring-2 ring-white" /> : null}
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content align="end" sideOffset={8} collisionPadding={12}
              aria-label={t("Pozostałe sekcje salonu")}
              className="z-[80] max-h-[min(70dvh,var(--radix-popover-content-available-height))] w-[min(22rem,calc(100vw-1.5rem))] overflow-y-auto rounded-2xl border border-[#cdd7c6] bg-[#fcfaf8] p-4 shadow-xl"
              onClick={(event) => { if ((event.target as HTMLElement).closest("a")) setOpen(false); }}>
              <BeautyDocsSidebarNav groups={[...groups.slice(1), { label: t("Salon"), items: [
                { label: t("Ustawienia salonu"), icon: Settings, href: `${basePath}/settings`, active: activeSection === "settings" },
                { label: t("Zmień salon"), icon: UsersRound, href: "/panel" },
              ] }]} />
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </div>
      {moreActive ? <p className="mt-2 px-2 text-sm font-semibold text-[#5a6b5a]">{currentLabel}</p> : null}
    </nav>
  );
}

function AccountShell({
  children,
}: {
  readonly children: ReactNode;
}) {
  return <div className="font-sans">{children}</div>;
}

function AdminProfileMenu({
  basePath,
  compact = false,
  user,
}: {
  readonly basePath: string;
  readonly compact?: boolean;
  readonly user: BeautyDocsAdminShellProps["user"];
}) {
  const t = useT();
  return (
    <details className="group relative">
      <summary
        aria-label={t("Otwórz menu profilu")}
        className={`flex cursor-pointer list-none items-center rounded-2xl border border-[#dce1d4] bg-white transition hover:border-[#b8cbaa] hover:bg-[#f5f8f1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#245c4d] [&::-webkit-details-marker]:hidden ${
          compact
            ? "size-11 justify-center"
            : "max-w-[240px] gap-2.5 py-1.5 pl-1.5 pr-2.5"
        }`}
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#245c4d] text-xs font-black text-white">
          {userInitials(user.displayName)}
        </span>
        {!compact ? (
          <>
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate text-[13px] font-bold leading-tight text-[#173d35]">
                {user.displayName}
              </span>
              <span className="block truncate text-xs leading-tight text-[#5a6b5a]">
                {user.email}
              </span>
            </span>
            <ChevronDown className="size-4 shrink-0 text-[#5a6b5a] transition group-open:rotate-180" />
          </>
        ) : null}
      </summary>
      <div
        className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-64 overflow-hidden rounded-2xl border border-[#dce1d4] bg-white p-2 shadow-[0_18px_50px_rgba(39,57,52,0.18)]"
      >
        <div className="border-b border-stone-100 px-3 py-2.5">
          <p className="truncate text-sm font-black text-[#173d35]">{user.displayName}</p>
          <p className="mt-0.5 truncate text-xs text-stone-500">{user.email}</p>
        </div>
        <Link
          className="mt-1 flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold text-[#414f43] transition hover:bg-[#f5f8f1]"
          href="/panel"
        >
          <UserRound className="size-4" /> {t("Mój profil")}
        </Link>
        <Link
          className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold text-[#414f43] transition hover:bg-[#f5f8f1]"
          href={`${basePath}/settings`}
        >
          <Settings className="size-4" /> {t("Ustawienia salonu")}
        </Link>
        <div className="mt-1 border-t border-stone-100 pt-1">
          <BeautyDocsLogoutButton
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-black text-red-700 transition hover:bg-red-50 disabled:opacity-50"
            icon={<LogOut className="size-4" />}
            label={t("Wyloguj się")}
          />
        </div>
      </div>
    </details>
  );
}

function AdminSidebarBottom({
  basePath,
  role,
  settingsActive,
}: {
  readonly basePath: string;
  readonly role: BeautyDocsMembershipRole;
  readonly settingsActive: boolean;
}) {
  const t = useT();
  const linkClass =
    "flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-bold text-[#5a6b5a] transition hover:bg-[#eff4e7] hover:text-[#173d35] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#245c4d]/40";
  return (
    <div className="space-y-1.5">
      {role === "OWNER" ? (
        <div className="mb-1 rounded-2xl border border-[#e7f0db] bg-[#f1f6e9] p-3.5">
          <div className="flex items-center gap-2">
            <span className="grid size-7 shrink-0 place-items-center rounded-xl bg-[#245c4d] text-white">
              <Sparkles className="size-4" />
            </span>
            <p className="text-[13px] font-black text-[#173d35]">{t("Odblokuj plan Pro")}</p>
          </div>
          <p className="mt-2 text-xs leading-4 text-[#5a6b5a]">
            {t("Więcej formularzy, zespół bez limitu i priorytetowe wsparcie.")}
          </p>
          <Link
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#245c4d] px-3 py-2 text-[12px] font-black text-white shadow-[0_10px_24px_rgba(36,92,77,0.22)] transition hover:bg-[#173d35] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#245c4d] focus-visible:ring-offset-2"
            href="/cennik"
          >
            <Sparkles className="size-3.5" /> {t("Zobacz plany")}
        </Link>
        </div>
      ) : null}
      <Link aria-current={settingsActive ? "page" : undefined} className={`${linkClass} ${settingsActive ? "bg-[#eaf0e2] text-[#173d35]" : ""}`} href={`${basePath}/settings`}>
        <Settings className="size-[18px] shrink-0" /> {t("Ustawienia salonu")}
        </Link>
      <a
        className={linkClass}
        href="mailto:hello@beautydocs.pl?subject=Opinia%20o%20BeautyDocs"
      >
        <MessageSquareHeart className="size-[18px] shrink-0" /> {t("Prześlij opinię")}
        </a>
    </div>
  );
}

function userInitials(displayName: string): string {
  const parts = displayName.split(/\s+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase("pl-PL") ?? "")
    .join("");
}

export function roleLabel(role: BeautyDocsMembershipRole): string {
  switch (role) {
    case "OWNER":
      return "Konto właścicielskie";
    case "ADMIN":
      return "Administrator";
    case "STAFF":
      return "Pracownik";
    case "READ_ONLY":
      return "Tylko odczyt";
  }
}
