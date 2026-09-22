import type { Metadata } from "next";
import { BeautyDocsConsumerPortal } from "@/components/beautydocs/consumer/BeautyDocsConsumerPortal";
import { isValidFormSlug } from "@/lib/beautydocs-form-path";

export const metadata: Metadata = {
  title: { absolute: "Moje BeautyDocs — Twoje dokumenty" },
  description:
    "Twój profil, zapisane dane i historia podpisanych formularzy BeautyDocs.",
  robots: { index: false, follow: false },
};

export default async function BeautyDocsConsumerPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly section?: string; readonly book?: string; readonly form?: string }>;
}) {
  const { section, book, form } = await searchParams;
  const initialBookSlug = book && /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(book) ? book : null;
  // A specific service on the salon's public page ("Umów wizytę") passes the
  // form its name was matched to, so the dialog opens straight past step 1
  // (choosing the treatment) into the calendar.
  const initialBookFormCode = form && isValidFormSlug(form) ? form : null;
  return (
    <BeautyDocsConsumerPortal
      initialBookFormCode={initialBookFormCode}
      initialBookSlug={initialBookSlug}
      // A booking deep link always lands on the salons section, even without
      // an explicit ?section=salons — the whole point of ?book=<slug> is to
      // skip straight to "Umów wizytę" for that salon.
      initialSection={section === "salons" || initialBookSlug ? "salons" : "home"}
    />
  );
}
