import { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "Polityka prywatności — BeautyDocs" },
  description:
    "Polityka prywatności platformy BeautyDocs: role salonu i operatora, zakres danych, bezpieczeństwo oraz prawa użytkowników.",
  alternates: {
    canonical: "https://beautydocs.pl/polityka-prywatnosci",
  },
  openGraph: {
    title: "Polityka prywatności | BeautyDocs",
    description:
      "Dowiedz się, jak BeautyDocs i salony przetwarzają dane użytkowników platformy.",
    url: "https://beautydocs.pl/polityka-prywatnosci",
  },
};

export default function PolitykaPrywatnosciLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
