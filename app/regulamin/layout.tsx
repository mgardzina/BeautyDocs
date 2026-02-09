import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Regulamin",
  description:
    "Regulamin salonu PowderBrows Academy. Zasady rezerwacji wizyt, przeciwwskazania do zabiegów makijażu permanentnego, informacje o płatnościach i reklamacjach.",
  alternates: {
    canonical: "https://powderbrowsacademy.com.pl/regulamin",
  },
  openGraph: {
    title: "Regulamin | PowderBrows Academy Stalowa Wola",
    description:
      "Regulamin salonu PowderBrows Academy - zasady korzystania z usług makijażu permanentnego.",
    url: "https://powderbrowsacademy.com.pl/regulamin",
  },
};

export default function RegulaminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
