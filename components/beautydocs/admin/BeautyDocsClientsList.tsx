"use client";
import { activeIntlLocale } from "../../../lib/i18n/active";

import { useT } from "../i18n";
import { Archive, ArrowLeft, ArrowRight, Search, UserRound } from "lucide-react";
import Link from "next/link";
import type {
  BeautyDocsAdminClientList,
  BeautyDocsAdminClientListItem,
  BeautyDocsAdminClientListQuery,
} from "../../../types/beautydocs-admin";

interface BeautyDocsClientsListProps {
  readonly clients: BeautyDocsAdminClientList;
  readonly query: BeautyDocsAdminClientListQuery;
  readonly tenantSlug: string;
}

export function BeautyDocsClientsList({
  clients,
  query,
  tenantSlug,
}: BeautyDocsClientsListProps) {
  const t = useT();
  const basePath = `/panel/${encodeURIComponent(tenantSlug)}/clients`;
  const unfilteredPath = `${basePath}?${new URLSearchParams({
    pageSize: String(query.pageSize),
  }).toString()}`;

  return (
    <section aria-labelledby="clients-heading">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#5a6b5a]">{t("Kartoteki salonu")}</p>
        <h1 className="mt-3 text-3xl font-black tracking-[-0.045em] text-[#173d35] sm:text-4xl" id="clients-heading">
          {t("Klientki")}
        </h1>
        <p className="mt-2 text-sm leading-6 text-[#5a6b5a] sm:text-base">
          {t("Wyszukuj dane kontaktowe i otwieraj pełną historię klientki.")}
        </p>
      </div>

      <form action={basePath} className="mt-7 rounded-[1.4rem] border border-black/5 bg-[#fcfaf8] p-3" method="get" role="search">
        <input name="pageSize" type="hidden" value={query.pageSize} />
        <label className="sr-only" htmlFor="client-search">
          {t("Szukaj klientki")}
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-4 top-1/2 size-4.5 -translate-y-1/2 text-[#5a6b5a]"
            />
            <input
              className="h-12 w-full rounded-xl border border-[#d4decc] bg-white pl-11 pr-4 text-sm outline-none placeholder:text-[#9faba1] focus:border-[#8fb5ab] focus:ring-4 focus:ring-[#245c4d]/10"
              defaultValue={query.search}
              id="client-search"
              maxLength={80}
              minLength={2}
              name="search"
              placeholder={t("Imię, nazwisko, telefon lub e-mail")}
              type="search"
            />
          </div>
          <button
            className="h-12 rounded-xl bg-[#245c4d] px-6 text-sm font-black text-white transition hover:bg-[#173d35] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#245c4d] focus-visible:ring-offset-2"
            type="submit"
          >
            {t("Szukaj")}
          </button>
          {query.search ? (
            <Link
              className="flex h-12 items-center justify-center rounded-xl border border-[#d4decc] bg-white px-5 text-sm font-bold text-[#6a8a6e] hover:bg-[#f5f8f2]"
              href={unfilteredPath}
            >
              {t("Wyczyść")}
            </Link>
          ) : null}
        </div>
      </form>

      <div className="mt-5 flex items-center justify-between gap-4">
        <p aria-live="polite" className="text-sm text-[#5a6b5a]">
          {query.search ? (
            <>
              {t("Wyniki dla")}{" "}<span className="font-bold text-[#245c4d]">„{query.search}”</span>:{" "}
            </>
          ) : null}
          <span className="font-bold text-[#245c4d]">
            {clients.total.toLocaleString(activeIntlLocale())}
          </span>
        </p>
        {clients.totalPages > 0 ? (
          <p className="text-xs font-medium text-[#5a6b5a]">
            {t("Strona")}{" "}{clients.page}{" "}{t("z")}{" "}{clients.totalPages}
          </p>
        ) : null}
      </div>

      {clients.items.length > 0 ? (
        <>
          <div className="mt-4 hidden overflow-hidden rounded-[1.5rem] border border-black/5 bg-[#fcfaf8] md:block">
            <table className="w-full border-collapse text-left">
              <thead className="border-b border-black/5 bg-[#f6f9f3] text-xs font-semibold uppercase tracking-[0.12em] text-[#5a6b5a]">
                <tr>
                  <th className="px-5 py-3.5" scope="col">{t("Klientka")}</th>
                  <th className="px-5 py-3.5" scope="col">{t("Kontakt")}</th>
                  <th className="px-5 py-3.5" scope="col">{t("Dodano")}</th>
                  <th className="px-5 py-3.5 text-right" scope="col">
                    <span className="sr-only">{t("Akcje")}</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {clients.items.map((client) => (
                  <ClientTableRow client={client} key={client.id} tenantSlug={tenantSlug} />
                ))}
              </tbody>
            </table>
          </div>

          <ul className="mt-4 space-y-3 md:hidden">
            {clients.items.map((client) => (
              <ClientMobileCard client={client} key={client.id} tenantSlug={tenantSlug} />
            ))}
          </ul>
        </>
      ) : (
        <ClientsEmptyState
          clearPath={unfilteredPath}
          hasSearch={query.search !== ""}
        />
      )}

      <ClientPagination
        basePath={basePath}
        currentPage={clients.page}
        pageSize={clients.pageSize}
        search={query.search}
        totalPages={clients.totalPages}
      />
    </section>
  );
}

function ClientTableRow({
  client,
  tenantSlug,
}: {
  readonly client: BeautyDocsAdminClientListItem;
  readonly tenantSlug: string;
}) {
  const t = useT();
  const href = clientProfilePath(tenantSlug, client.id);
  return (
    <tr className="group hover:bg-[#f6f9f3]">
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <ClientAvatar client={client} />
          <div>
            <Link className="font-black text-[#173d35] hover:underline" href={href}>
              {client.firstName} {client.lastName}
            </Link>
            {client.archivedAt ? (
              <span className="mt-1 flex items-center gap-1 text-xs font-semibold text-amber-700">
                <Archive aria-hidden="true" className="size-3" />{" "}{t("Archiwalna")}
              </span>
            ) : null}
          </div>
        </div>
      </td>
      <td className="px-5 py-4 text-sm text-[#5a6b5a]">
        <span className="block">{client.phone ?? t("Brak telefonu")}</span>
        <span className="mt-0.5 block text-xs text-[#5a6b5a]">
          {client.email ?? t("Brak adresu e-mail")}
        </span>
      </td>
      <td className="px-5 py-4 text-sm text-[#5a6b5a]">
        {formatDate(client.createdAt)}
      </td>
      <td className="px-5 py-4 text-right">
        <Link
          aria-label={t("Otwórz profil: {firstName} {lastName}", { firstName: client.firstName, lastName: client.lastName })}
          className="inline-flex size-9 items-center justify-center rounded-xl text-[#929e94] transition group-hover:bg-white group-hover:text-[#245c4d]"
          href={href}
        >
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </td>
    </tr>
  );
}

function ClientMobileCard({
  client,
  tenantSlug,
}: {
  readonly client: BeautyDocsAdminClientListItem;
  readonly tenantSlug: string;
}) {
  const t = useT();
  return (
    <li>
      <Link
        className="block rounded-[1.4rem] border border-black/5 bg-[#fcfaf8] p-4 transition hover:border-[#b8cbaa]"
        href={clientProfilePath(tenantSlug, client.id)}
      >
        <div className="flex items-start gap-3">
          <ClientAvatar client={client} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-black text-[#173d35]">
              {client.firstName} {client.lastName}
            </p>
            <p className="mt-1 truncate text-sm text-[#5a6b5a]">
              {client.phone ?? client.email ?? t("Brak danych kontaktowych")}
            </p>
            <p className="mt-3 text-xs text-[#5a6b5a]">
              {t("Dodano")}{" "}{formatDate(client.createdAt)}
            </p>
          </div>
          <ArrowRight aria-hidden="true" className="mt-2 size-4 shrink-0 text-[#929e94]" />
        </div>
      </Link>
    </li>
  );
}

function ClientAvatar({ client }: { readonly client: BeautyDocsAdminClientListItem }) {
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#eef4e6] text-xs font-black text-[#173d35]">
      {initials(client.firstName, client.lastName)}
    </span>
  );
}

function ClientsEmptyState({
  clearPath,
  hasSearch,
}: {
  readonly clearPath: string;
  readonly hasSearch: boolean;
}) {
  const t = useT();
  return (
    <div className="mt-4 rounded-[1.5rem] border border-dashed border-[#b8cbaa] bg-[#fcfaf8] px-5 py-14 text-center">
      <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[#eef4e6] text-[#6a8a6e]">
        {hasSearch ? <Search aria-hidden="true" className="size-5" /> : <UserRound aria-hidden="true" className="size-5" />}
      </span>
      <h2 className="mt-4 text-lg font-bold">
        {hasSearch ? t("Brak pasujących klientek") : t("Brak klientek")}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#5a6b5a]">
        {hasSearch
          ? t("Spróbuj użyć innego imienia, nazwiska, numeru telefonu lub adresu e-mail.")
          : t("Kartoteki klientek pojawią się tutaj po dodaniu lub migracji danych salonu.")}
      </p>
      {hasSearch ? (
        <Link className="mt-5 inline-flex text-sm font-black text-[#245c4d] underline underline-offset-4" href={clearPath}>
          {t("Wyczyść wyszukiwanie")}
        </Link>
      ) : null}
    </div>
  );
}

function ClientPagination({
  basePath,
  currentPage,
  pageSize,
  totalPages,
  search,
}: {
  readonly basePath: string;
  readonly currentPage: number;
  readonly pageSize: number;
  readonly totalPages: number;
  readonly search: string;
}) {
  const t = useT();
  if (totalPages <= 1) {
    return null;
  }

  return (
    <nav aria-label={t("Paginacja klientek")} className="mt-6 flex items-center justify-between gap-4">
      {currentPage > 1 ? (
        <Link
          className="inline-flex items-center gap-2 rounded-xl border border-[#d4decc] bg-white px-4 py-2.5 text-sm font-black text-[#6a8a6e] hover:bg-[#f5f8f2]"
          href={listPagePath(basePath, search, currentPage - 1, pageSize)}
        >
          <ArrowLeft aria-hidden="true" className="size-4" />{" "}{t("Poprzednia")}
        </Link>
      ) : (
        <span />
      )}
      <span className="text-sm font-medium text-[#5a6b5a]">
        {currentPage} / {totalPages}
      </span>
      {currentPage < totalPages ? (
        <Link
          className="inline-flex items-center gap-2 rounded-xl border border-[#d4decc] bg-white px-4 py-2.5 text-sm font-black text-[#6a8a6e] hover:bg-[#f5f8f2]"
          href={listPagePath(basePath, search, currentPage + 1, pageSize)}
        >
          {t("Następna")}{" "}<ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

function listPagePath(
  basePath: string,
  search: string,
  page: number,
  pageSize: number,
): string {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  if (search) {
    params.set("search", search);
  }
  return `${basePath}?${params.toString()}`;
}

function clientProfilePath(tenantSlug: string, clientId: string): string {
  return `/panel/${encodeURIComponent(tenantSlug)}/clients/${encodeURIComponent(clientId)}`;
}

function initials(firstName: string, lastName: string): string {
  return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toLocaleUpperCase("pl-PL");
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(activeIntlLocale(), {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Warsaw",
  }).format(new Date(value));
}
