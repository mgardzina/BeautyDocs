import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Polityka Prywatności",
  description:
    "Polityka prywatności PowderBrows Academy. Dowiedz się jak przetwarzamy Twoje dane osobowe, jakie masz prawa i jak chronimy Twoją prywatność.",
  alternates: {
    canonical: "https://powderbrowsacademy.com.pl/polityka-prywatnosci",
  },
  openGraph: {
    title: "Polityka Prywatności | PowderBrows Academy Stalowa Wola",
    description:
      "Polityka prywatności PowderBrows Academy - salon makijażu permanentnego w Stalowej Woli.",
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
