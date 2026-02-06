import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Polityka Prywatności",
  description:
    "Polityka prywatności Royal Lips. Dowiedz się jak przetwarzamy Twoje dane osobowe, jakie masz prawa i jak chronimy Twoją prywatność.",
  alternates: {
    canonical: "https://powderbrowsacademy.com.pl/polityka-prywatnosci",
  },
  openGraph: {
    title: "Polityka Prywatności | Royal Lips Krosno",
    description:
      "Polityka prywatności Royal Lips - salon makijażu permanentnego w Krośnie.",
    url: "https://powderbrowsacademy.com.pl/polityka-prywatnosci",
  },
};

export default function PolitykaPrywatnosciLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
