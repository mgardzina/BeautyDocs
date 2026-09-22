import Link from "next/link";
import type { BeautyDocsAdminMembership } from "../../../types/beautydocs-admin";
import { roleLabel } from "./BeautyDocsAdminShell";

interface BeautyDocsTenantChooserProps {
  readonly memberships: readonly BeautyDocsAdminMembership[];
}

export function BeautyDocsTenantChooser({
  memberships,
}: BeautyDocsTenantChooserProps) {
  return (
    <section aria-labelledby="salons-heading">
      <h1 className="text-3xl font-bold tracking-tight" id="salons-heading">
        Twoje salony
      </h1>
      <p className="mt-3 text-stone-600">
        Wybierz salon, którego panelem chcesz zarządzać.
      </p>

      {memberships.length > 0 ? (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {memberships.map((membership) => (
            <li key={membership.tenantSlug}>
              <Link
                className="block rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#cdd7c6] hover:shadow-md"
                href={`/panel/${membership.tenantSlug}`}
              >
                <p className="font-semibold text-[#173d35]">
                  {membership.tenantDisplayName}
                </p>
                <p className="mt-2 text-sm text-stone-500">
                  {roleLabel(membership.role)}
                </p>
                <p className="mt-5 text-sm font-semibold text-[#222a23]">
                  Otwórz panel →
                </p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-8 rounded-2xl border border-stone-200 bg-white p-6">
          <p className="font-semibold">Konto pracownika jest aktywne</p>
          <p className="mt-2 text-sm text-stone-600">
            Nie należysz jeszcze do żadnego salonu. Poproś właściciela o link
            zaproszenia i otwórz go po zalogowaniu na to konto.
          </p>
          <Link
            className="mt-5 inline-flex rounded-xl border border-[#cdd7c6] px-4 py-2.5 text-sm font-bold text-[#245c4d] transition hover:bg-[#f3f7ed]"
            href="/"
          >
            Wróć na stronę główną
          </Link>
        </div>
      )}
    </section>
  );
}
