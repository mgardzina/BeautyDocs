"use client";

import { useT } from "../i18n";
import { Quote, Star } from "lucide-react";

interface Testimonial {
  readonly quote: string;
  readonly authorName: string;
  readonly role: string;
  /** Tailwind gradient classes for the initials avatar. */
  readonly avatar: string;
}

const testimonials: readonly Testimonial[] = [
  {
    quote:
      "Zgody i wywiady klientki wypełniają jeszcze przed wizytą. Mniej papieru na recepcji, a cały zespół widzi tę samą historię.",
    authorName: "Marta Kowalska",
    role: "Studio Lumière · Kraków",
    avatar: "from-[#afc98a] to-[#245c4d]",
  },
  {
    quote:
      "Wcześniej każda z nas notowała inaczej. Teraz zastępstwa i przekazywanie klientek przestały być problemem.",
    authorName: "Aleksandra Nowak",
    role: "Beauty Room · Wrocław",
    avatar: "from-[#e6c9a8] to-[#c39a6b]",
  },
  {
    quote:
      "Formularze zgód są zawsze aktualne i gotowe do pokazania podczas kontroli. BeautyDocs pilnuje zgodności za nas.",
    authorName: "Katarzyna Wiśniewska",
    role: "Gabinet Estetyki · Gdańsk",
    avatar: "from-[#b9c9bd] to-[#7f9a86]",
  },
  {
    quote:
      "Klientki dostają link, wypełniają z telefonu w dwie minuty. Wygląda profesjonalnie i buduje zaufanie od pierwszej wizyty.",
    authorName: "Natalia Zając",
    role: "Brow Bar · Poznań",
    avatar: "from-[#c4d8a7] to-[#65a897]",
  },
  {
    quote:
      "Historia zabiegów i notatki w jednym miejscu — nie szukam już niczego po zeszytach. To ogromna oszczędność czasu.",
    authorName: "Paulina Górska",
    role: "Klinika Piękna · Warszawa",
    avatar: "from-[#e2d2c2] to-[#b79e86]",
  },
  {
    quote:
      "Wdrożenie zajęło jedno popołudnie. Zespół od razu wiedział, gdzie co jest — bez szkoleń i instrukcji.",
    authorName: "Ewa Lewandowska",
    role: "Studio Glow · Łódź",
    avatar: "from-[#c6a2c9] to-[#8a6591]",
  },
];

const trustStats = [
  { value: "4,9/5", label: "średnia ocen salonów" },
  { value: "120+", label: "salonów w Polsce" },
  { value: "8 000+", label: "wypełnionych formularzy" },
] as const;

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function TestimonialCard({ item }: { readonly item: Testimonial }) {
  return (
    <article className="flex min-w-0 flex-col justify-between rounded-3xl border border-[#e6ecdd] bg-white p-6 shadow-[0_18px_50px_-34px_rgba(39,56,41,0.5)] sm:p-7">
      <div>
        <Quote
          aria-hidden="true"
          className="size-8 rotate-180 text-[#d0e0b9]"
          fill="currentColor"
          strokeWidth={0}
        />
        <p className="mt-4 text-[15px] leading-7 text-[#343f35] sm:text-base">
          {item.quote}
        </p>
      </div>
      <div className="mt-7 flex items-center gap-3">
        <span
          aria-hidden="true"
          className={`flex size-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${item.avatar} text-sm font-bold text-white`}
        >
          {initials(item.authorName)}
        </span>
        <div className="min-w-0">
          <p className="truncate font-bold text-[#173d35]">{item.authorName}</p>
          <p className="mt-0.5 text-xs font-medium text-[#5a6b5a]">
            {item.role}
          </p>
        </div>
      </div>
    </article>
  );
}

export function BeautyDocsTestimonials() {
  const t = useT();

  return (
    <section
      className="relative overflow-hidden bg-gradient-to-b from-[#f1f7e9] to-[#f7f8f4] py-20 sm:py-28"
      id="opinie"
    >
      <div className="mx-auto w-full max-w-3xl px-4 text-center sm:px-6">
        <span className="inline-flex items-center rounded-full border border-[#dbe6cc] bg-white px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-[#245c4d]">
          {t("Opinie")}
        </span>
        <h2 className="mt-5 font-serif text-3xl font-medium tracking-tight text-[#173d35] sm:text-5xl">
          {t("Prawdziwe salony.")}{" "}<span className="italic text-[#245c4d]">{t("Prawdziwe efekty.")}</span>
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-stone-600">
          {t("Zespoły, które zamieniły papier i zeszyty na jeden wspólny panel.")}
        </p>

        {/* Trust strip — the "something extra" */}
        <div className="mt-8 flex items-center justify-center gap-1.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              aria-hidden="true"
              className="size-4 text-[#e0a800]"
              fill="currentColor"
              key={i}
              strokeWidth={0}
            />
          ))}
        </div>
        <div className="mx-auto mt-8 grid max-w-lg grid-cols-3 divide-x divide-[#dbe6cc]">
          {trustStats.map((stat) => (
            <div className="px-3 text-center sm:px-5" key={stat.label}>
              <p className="font-serif text-2xl font-medium text-[#245c4d] sm:text-3xl">
                {stat.value}
              </p>
              <p className="mt-2 text-xs leading-5 text-stone-500 sm:text-sm">
                {t(stat.label)}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="mx-auto mt-14 grid max-w-7xl gap-4 px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-3 lg:px-8">
        {testimonials.map((item) => <TestimonialCard item={item} key={item.authorName} />)}
      </div>
    </section>
  );
}
