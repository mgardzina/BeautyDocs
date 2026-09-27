"use client";
import { activeIntlLocale } from "../../../lib/i18n/active";

import { useT } from "../i18n";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Archive,
  CheckCircle2,
  ClipboardSignature,
  Inbox,
  LoaderCircle,
  Mail,
  MailOpen,
  RefreshCw,
  Search,
} from "lucide-react";
import type {
  BeautyDocsAdminNotification,
  BeautyDocsAdminNotificationList,
} from "../../../types/beautydocs-admin";

type InboxFilter = "all" | "unread" | "signature" | "resolved";

export function BeautyDocsInbox({
  initialInbox,
  tenantSlug,
}: {
  readonly initialInbox: BeautyDocsAdminNotificationList;
  readonly tenantSlug: string;
}) {
  const t = useT();
  const [notifications, setNotifications] = useState(initialInbox.items);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialInbox.items[0]?.id ?? null,
  );
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [query, setQuery] = useState("");
  const [pendingIds, setPendingIds] = useState<Record<string, boolean>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeNotifications = notifications.filter(
    (notification) => notification.archivedAt === null,
  );
  const unreadCount = activeNotifications.filter(
    (notification) =>
      notification.readAt === null && notification.resolvedAt === null,
  ).length;
  const visibleNotifications = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("pl-PL");
    return activeNotifications.filter((notification) => {
      if (filter === "unread" && notification.readAt !== null) return false;
      if (
        filter === "signature" &&
        (notification.kind !== "PRACTITIONER_SIGNATURE_REQUIRED" ||
          notification.resolvedAt !== null)
      ) {
        return false;
      }
      if (filter === "resolved" && notification.resolvedAt === null) return false;
      if (!normalizedQuery) return true;
      return [
        notification.title,
        notification.body,
        notification.clientName,
        notification.formName,
        notification.practitionerName,
      ].some((value) =>
        value?.toLocaleLowerCase("pl-PL").includes(normalizedQuery),
      );
    });
  }, [activeNotifications, filter, query]);
  const selectedNotification =
    visibleNotifications.find((item) => item.id === selectedId) ??
    visibleNotifications[0] ??
    null;

  function publishUnreadCount(items: readonly BeautyDocsAdminNotification[]) {
    const count = items.filter(
      (item) =>
        item.archivedAt === null &&
        item.resolvedAt === null &&
        item.readAt === null,
    ).length;
    window.dispatchEvent(
      new CustomEvent("beautydocs:notifications-updated", {
        detail: { unreadCount: count },
      }),
    );
  }

  async function updateNotification(
    notification: BeautyDocsAdminNotification,
    update: { readonly read?: boolean; readonly archived?: boolean },
  ) {
    if (pendingIds[notification.id]) return;
    const previous = notifications;
    const now = new Date().toISOString();
    const optimistic = notifications.map((item) =>
      item.id === notification.id
        ? {
            ...item,
            ...(update.read === undefined
              ? {}
              : { readAt: update.read ? now : null }),
            ...(update.archived === undefined
              ? {}
              : { archivedAt: update.archived ? now : null }),
          }
        : item,
    );
    setNotifications(optimistic);
    publishUnreadCount(optimistic);
    setPendingIds((current) => ({ ...current, [notification.id]: true }));
    setError(null);
    try {
      const response = await fetch(
        `/api/beautydocs-preview/admin/tenants/${encodeURIComponent(tenantSlug)}` +
          `/notifications/${encodeURIComponent(notification.id)}`,
        {
          method: "PATCH",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(update),
        },
      );
      if (!response.ok) throw new Error("notification-update-failed");
      const saved = (await response.json()) as BeautyDocsAdminNotification;
      setNotifications((current) => {
        const next = current.map((item) =>
          item.id === saved.id ? saved : item,
        );
        publishUnreadCount(next);
        return next;
      });
    } catch {
      setNotifications(previous);
      publishUnreadCount(previous);
      setError(t("Nie udało się zapisać zmiany w skrzynce."));
    } finally {
      setPendingIds((current) => ({ ...current, [notification.id]: false }));
    }
  }

  function selectNotification(notification: BeautyDocsAdminNotification) {
    setSelectedId(notification.id);
    if (notification.readAt === null) {
      void updateNotification(notification, { read: true });
    }
  }

  async function refreshInbox() {
    setRefreshing(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/beautydocs-preview/admin/tenants/${encodeURIComponent(tenantSlug)}/notifications`,
        { cache: "no-store", credentials: "same-origin" },
      );
      if (!response.ok) throw new Error("notification-refresh-failed");
      const inbox = (await response.json()) as BeautyDocsAdminNotificationList;
      setNotifications(inbox.items);
      publishUnreadCount(inbox.items);
    } catch {
      setError(t("Nie udało się odświeżyć skrzynki."));
    } finally {
      setRefreshing(false);
    }
  }

  const folders: readonly {
    readonly id: InboxFilter;
    readonly label: string;
    readonly icon: typeof Inbox;
    readonly count?: number;
  }[] = [
    { id: "all", label: t("Odebrane"), icon: Inbox, count: activeNotifications.length },
    { id: "unread", label: t("Nieprzeczytane"), icon: Mail, count: unreadCount },
    {
      id: "signature",
      label: t("Do podpisu"),
      icon: ClipboardSignature,
      count: activeNotifications.filter(
        (item) =>
          item.kind === "PRACTITIONER_SIGNATURE_REQUIRED" &&
          item.resolvedAt === null,
      ).length,
    },
    {
      id: "resolved",
      label: t("Zakończone"),
      icon: CheckCircle2,
      count: activeNotifications.filter((item) => item.resolvedAt !== null).length,
    },
  ];

  return (
    <section aria-labelledby="inbox-heading">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#245c4d]">
            {t("Centrum powiadomień")}
          </p>
          <h1
            className="mt-3 text-3xl font-black tracking-[-0.045em] text-[#173d35] sm:text-4xl"
            id="inbox-heading"
          >
            {t("Skrzynka")}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5a6b5a] sm:text-base">
            {t("Zadania i ważne wiadomości dotyczące formularzy oraz pracy salonu.")}
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-[#eef3e7] px-3.5 py-2 text-xs font-black text-[#245c4d]">
          <Mail className="size-3.5" /> {unreadCount}{" "}{t("nieprzeczytanych")}
        </span>
      </div>

      {error ? (
        <p className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </p>
      ) : null}

      <div className="mt-6 overflow-hidden rounded-[28px] border border-[#e3e8dc] bg-white shadow-[0_18px_60px_-42px_rgba(42,66,60,0.45)] lg:grid lg:min-h-[650px] lg:grid-cols-[210px_minmax(320px,0.85fr)_minmax(420px,1.35fr)]">
        <aside className="border-b border-[#eaeee4] bg-[#f9fbf6] p-4 lg:border-b-0 lg:border-r">
          <button
            className="mb-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#245c4d] px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-[#467c6e] disabled:opacity-60"
            disabled={refreshing}
            onClick={() => void refreshInbox()}
            type="button"
          >
            {refreshing ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            {t("Odśwież")}
          </button>
          <nav aria-label={t("Foldery skrzynki")} className="flex gap-2 overflow-x-auto lg:block lg:space-y-1">
            {folders.map((folder) => {
              const Icon = folder.icon;
              return (
                <button
                  aria-current={filter === folder.id ? "page" : undefined}
                  className={`flex min-w-fit items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-xs font-black transition lg:w-full ${
                    filter === folder.id
                      ? "bg-[#e9f0df] text-[#447569]"
                      : "text-stone-500 hover:bg-white hover:text-[#447569]"
                  }`}
                  key={folder.id}
                  onClick={() => setFilter(folder.id)}
                  type="button"
                >
                  <Icon className="size-4" />
                  <span className="flex-1">{t(folder.label)}</span>
                  {folder.count ? (
                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] text-[#245c4d]">
                      {folder.count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="border-b border-[#eaeee4] lg:border-b-0 lg:border-r">
          <div className="border-b border-[#eaeee4] p-4">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
              <span className="sr-only">{t("Szukaj w skrzynce")}</span>
              <input
                className="w-full rounded-2xl border border-[#e1e6da] bg-[#f9fbf7] py-3 pl-10 pr-4 text-sm outline-none transition focus:border-[#87b9ac] focus:bg-white focus:ring-2 focus:ring-[#e2ead6]"
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("Szukaj klientki lub formularza")}
                type="search"
                value={query}
              />
            </label>
          </div>
          <div className="max-h-[520px] overflow-y-auto lg:max-h-[590px]">
            {visibleNotifications.length ? (
              visibleNotifications.map((notification) => (
                <button
                  className={`flex w-full gap-3 border-b border-[#edf0e8] px-4 py-4 text-left transition last:border-b-0 ${
                    selectedNotification?.id === notification.id
                      ? "bg-[#f3f8ec]"
                      : notification.readAt === null
                        ? "bg-white hover:bg-[#fafcf8]"
                        : "bg-[#fcfaf8] hover:bg-[#f8faf5]"
                  }`}
                  key={notification.id}
                  onClick={() => selectNotification(notification)}
                  type="button"
                >
                  <span
                    className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl ${
                      notification.resolvedAt
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-[#eef3e7] text-[#245c4d]"
                    }`}
                  >
                    {notification.resolvedAt ? (
                      <CheckCircle2 className="size-4" />
                    ) : (
                      <ClipboardSignature className="size-4" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-2">
                      <span
                        className={`truncate text-sm ${
                          notification.readAt === null ? "font-black" : "font-bold"
                        } text-[#173d35]`}
                      >
                        {notification.clientName ?? notification.title}
                      </span>
                      <span className="shrink-0 text-[10px] font-bold text-stone-400">
                        {formatInboxDate(notification.createdAt)}
                      </span>
                    </span>
                    <span className="mt-1 block truncate text-xs font-bold text-[#537658]">
                      {notification.formName ?? notification.title}
                    </span>
                    <span className="mt-1 line-clamp-2 block text-[11px] leading-4 text-stone-500">
                      {t(notification.body)}
                    </span>
                  </span>
                  {notification.readAt === null ? (
                    <span className="mt-2 size-2 shrink-0 rounded-full bg-[#245c4d]" />
                  ) : null}
                </button>
              ))
            ) : (
              <InboxEmptyState />
            )}
          </div>
        </div>

        <div className="min-h-[420px] bg-white">
          {selectedNotification ? (
            <NotificationDetail
              notification={selectedNotification}
              onArchive={() =>
                void updateNotification(selectedNotification, { archived: true })
              }
              onToggleRead={() =>
                void updateNotification(selectedNotification, {
                  read: selectedNotification.readAt === null,
                })
              }
              pending={pendingIds[selectedNotification.id] ?? false}
              tenantSlug={tenantSlug}
            />
          ) : (
            <InboxEmptyState detail />
          )}
        </div>
      </div>
    </section>
  );
}

function NotificationDetail({
  notification,
  onArchive,
  onToggleRead,
  pending,
  tenantSlug,
}: {
  readonly notification: BeautyDocsAdminNotification;
  readonly onArchive: () => void;
  readonly onToggleRead: () => void;
  readonly pending: boolean;
  readonly tenantSlug: string;
}) {
  const t = useT();
  const formHref =
    notification.clientId && notification.submissionId
      ? `/panel/${encodeURIComponent(tenantSlug)}` +
        `/clients/${encodeURIComponent(notification.clientId)}` +
        `/forms/${encodeURIComponent(notification.submissionId)}`
      : null;
  return (
    <article className="flex h-full flex-col p-5 sm:p-7">
      <div className="flex items-center justify-between gap-3 border-b border-[#eaeee4] pb-4">
        <span
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-black ${
            notification.resolvedAt
              ? "bg-emerald-50 text-emerald-700"
              : "bg-amber-50 text-amber-800"
          }`}
        >
          {notification.resolvedAt ? (
            <CheckCircle2 className="size-3.5" />
          ) : (
            <ClipboardSignature className="size-3.5" />
          )}
          {notification.resolvedAt ? t("Zakończone") : t("Wymaga działania")}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            aria-label={
              notification.readAt ? t("Oznacz jako nieprzeczytane") : t("Oznacz jako przeczytane")
            }
            className="grid size-9 place-items-center rounded-xl text-stone-500 transition hover:bg-[#f0f5e9] hover:text-[#245c4d] disabled:opacity-50"
            disabled={pending}
            onClick={onToggleRead}
            title={notification.readAt ? t("Oznacz jako nieprzeczytane") : t("Oznacz jako przeczytane")}
            type="button"
          >
            {notification.readAt ? <Mail className="size-4" /> : <MailOpen className="size-4" />}
          </button>
          <button
            aria-label={t("Archiwizuj")}
            className="grid size-9 place-items-center rounded-xl text-stone-500 transition hover:bg-[#f0f5e9] hover:text-[#245c4d] disabled:opacity-50"
            disabled={pending}
            onClick={onArchive}
            title={t("Archiwizuj")}
            type="button"
          >
            <Archive className="size-4" />
          </button>
        </div>
      </div>

      <div className="pt-6">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#7e9a82]">
          {formatInboxFullDate(notification.createdAt)}
        </p>
        <h2 className="mt-3 text-2xl font-black tracking-[-0.035em] text-[#173d35]">
          {t(notification.title)}
        </h2>
        <p className="mt-4 text-sm leading-7 text-stone-600">{t(notification.body)}</p>

        <dl className="mt-6 divide-y divide-[#eaeee5] rounded-2xl border border-[#e5eadd] bg-[#fcfdfa] px-4">
          <DetailRow label={t("Klientka")} value={notification.clientName} />
          <DetailRow label={t("Formularz")} value={notification.formName} />
          <DetailRow
            label={t("Osoba wykonująca zabieg")}
            value={notification.practitionerName}
          />
        </dl>

        {formHref ? (
          <Link
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-2xl bg-[#245c4d] px-5 py-3 text-sm font-black text-white transition hover:bg-[#467c6e]"
            href={formHref}
          >
            <ClipboardSignature className="size-4" />
            {notification.resolvedAt
              ? t("Zobacz formularz")
              : (notification.actionLabel ?? t("Otwórz formularz"))}
          </Link>
        ) : null}
      </div>
    </article>
  );
}

function DetailRow({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string | null;
}) {
  const t = useT();
  return (
    <div className="grid gap-1 py-3.5 sm:grid-cols-[170px_1fr]">
      <dt className="text-[11px] font-black uppercase tracking-[0.08em] text-stone-400">
        {t(label)}
      </dt>
      <dd className="text-sm font-bold text-[#344937]">{value ?? "—"}</dd>
    </div>
  );
}

function InboxEmptyState({ detail = false }: { readonly detail?: boolean }) {
  const t = useT();
  return (
    <div className="grid min-h-72 place-items-center px-6 py-14 text-center">
      <div>
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#eef3e8] text-[#245c4d]">
          {detail ? <MailOpen className="size-5" /> : <Inbox className="size-5" />}
        </span>
        <p className="mt-4 text-sm font-black text-[#344937]">
          {detail ? t("Wybierz wiadomość") : t("W tym folderze jest pusto")}
        </p>
        <p className="mt-1 text-xs leading-5 text-stone-500">
          {detail
            ? t("Treść powiadomienia pojawi się tutaj.")
            : t("Nowe zadania pojawią się automatycznie.")}
        </p>
      </div>
    </div>
  );
}

function formatInboxDate(value: string): string {
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return new Intl.DateTimeFormat(activeIntlLocale(), {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }
  return new Intl.DateTimeFormat(activeIntlLocale(), {
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

function formatInboxFullDate(value: string): string {
  return new Intl.DateTimeFormat(activeIntlLocale(), {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
