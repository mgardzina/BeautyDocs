import {
  AlertCircle,
  SearchX,
  ShieldX,
  UserRoundX,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

export function BeautyDocsAdminInlineUnavailable() {
  return (
    <AdminInlineStatus
      description="Nie udało się pobrać danych. Odśwież stronę lub spróbuj ponownie za kilka minut."
      icon={AlertCircle}
      title="Dane są chwilowo niedostępne"
    />
  );
}

export function BeautyDocsAdminInlineForbidden() {
  return (
    <AdminInlineStatus
      description="Twoje konto nie posiada dostępu do tego obszaru salonu."
      icon={ShieldX}
      title="Brak dostępu"
    />
  );
}

export function BeautyDocsClientsInvalidQuery({
  tenantSlug,
}: {
  readonly tenantSlug: string;
}) {
  return (
    <AdminInlineStatus
      actionHref={`/panel/${encodeURIComponent(tenantSlug)}/clients`}
      actionLabel="Wyczyść filtry"
      description="Wyszukiwanie powinno mieć od 2 do 80 znaków, a numer strony musi być prawidłowy."
      icon={SearchX}
      title="Nieprawidłowe wyszukiwanie"
    />
  );
}

export function BeautyDocsClientNotFound({
  tenantSlug,
}: {
  readonly tenantSlug: string;
}) {
  return (
    <AdminInlineStatus
      actionHref={`/panel/${encodeURIComponent(tenantSlug)}/clients`}
      actionLabel="Wróć do klientek"
      description="Kartoteka nie istnieje, została usunięta albo należy do innego salonu."
      icon={UserRoundX}
      title="Nie znaleziono klientki"
    />
  );
}

function AdminInlineStatus({
  title,
  description,
  actionHref,
  actionLabel,
  icon: Icon,
}: {
  readonly title: string;
  readonly description: string;
  readonly actionHref?: string;
  readonly actionLabel?: string;
  readonly icon: LucideIcon;
}) {
  return (
    <section className="rounded-2xl border border-stone-200 bg-white px-5 py-14 text-center shadow-sm">
      <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[#f7f8f4] text-stone-600">
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <h1 className="mt-4 text-2xl font-bold tracking-tight">{title}</h1>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-stone-500">
        {description}
      </p>
      {actionHref && actionLabel ? (
        <Link
          className="mt-6 inline-flex rounded-xl bg-[#245c4d] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#173d35]"
          href={actionHref}
        >
          {actionLabel}
        </Link>
      ) : null}
    </section>
  );
}
