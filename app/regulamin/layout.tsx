import { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "Regulamin platformy — BeautyDocs" },
  description:
    "Regulamin korzystania z platformy BeautyDocs przez salony, pracowników i klientki.",
  alternates: {
    canonical: "https://beautydocs.pl/regulamin",
  },
  openGraph: {
    title: "Regulamin platformy | BeautyDocs",
    description:
      "Zasady kont, wizyt, formularzy, podpisów i komunikacji w BeautyDocs.",
    url: "https://beautydocs.pl/regulamin",
  },
};

export default function RegulaminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
