import type { LucideIcon } from "lucide-react";

export function BeautyDocsAdminComingSoon({
  eyebrow,
  title,
  description,
  icon: Icon,
}: {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly icon: LucideIcon;
}) {
  return (
    <section aria-labelledby="coming-soon-heading">
      <p className="text-sm font-semibold text-stone-500">{eyebrow}</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl" id="coming-soon-heading">
        {title}
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600 sm:text-base">
        {description}
      </p>

      <div className="mt-8 rounded-2xl border border-stone-200 bg-white px-5 py-14 text-center shadow-sm sm:px-8">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[#f7f8f4] text-[#173d35]">
          <Icon aria-hidden="true" className="size-6" />
        </span>
        <h2 className="mt-5 text-xl font-bold">Moduł w przygotowaniu</h2>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-stone-500">
          Ten obszar korzysta już ze wspólnej nawigacji BeautyDocs. Funkcje zostaną podłączone do FastAPI w kolejnym etapie migracji.
        </p>
      </div>
    </section>
  );
}
