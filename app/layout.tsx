import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import "./marketing.css";
import GoogleAnalytics from "../components/GoogleAnalytics";
import AuthProvider from "../components/AuthProvider";
import JsonLd from "../components/JsonLd";

/* eslint-disable @next/next/no-sync-scripts -- Cookiebot automatic blocking requires its synchronous loader to be the first script. */

const sora = localFont({
  src: [
    {
      path: "./fonts/Sora-Variable.woff2",
      weight: "100 800",
      style: "normal",
    },
  ],
  variable: "--font-sora",
  display: "swap",
  fallback: [
    "system-ui",
    "-apple-system",
    "Segoe UI",
    "Roboto",
    "Helvetica",
    "Arial",
    "sans-serif",
  ],
});

const siteUrl = "https://powderbrowsacademy.com.pl";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#F2EDE7",
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "PowderBrows Academy - Malwina Zięba | Stalowa Wola",
    template: "%s | PowderBrows Academy",
  },
  description:
    "Profesjonalny makijaż permanentny brwi, ust i kresek w Stalowej Woli. Szkolenia i zabiegi na najwyższym poziomie.",
  keywords: [
    "makijaż permanentny Stalowa Wola",
    "microblading Stalowa Wola",
    "powder brows",
    "szkolenia makijaż permanentny",
    "brwi permanentne",
    "usta permanentne",
    "PowderBrows Academy",
    "Malwina Zięba",
    "makijaż permanentny Podkarpacie",
    "beauty salon Stalowa Wola",
  ],
  authors: [{ name: "PowderBrows Academy - Malwina Zięba" }],
  creator: "PowderBrows Academy",
  publisher: "PowderBrows Academy",
  formatDetection: {
    email: true,
    address: true,
    telephone: true,
  },
  alternates: {
    canonical: siteUrl,
  },
  openGraph: {
    type: "website",
    locale: "pl_PL",
    url: siteUrl,
    siteName: "PowderBrows Academy - Malwina Zięba",
    title: "PowderBrows Academy - Makijaż Permanentny Stalowa Wola",
    description:
      "Profesjonalny makijaż permanentny brwi, ust i kresek w Stalowej Woli. Szkolenia i zabiegi.",
    images: [
      {
        url: "/logo.png",
        width: 512,
        height: 512,
        alt: "PowderBrows Academy Logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "PowderBrows Academy - Makijaż Permanentny Stalowa Wola",
    description:
      "Profesjonalny makijaż permanentny brwi, ust i kresek w Stalowej Woli.",
    images: ["/logo.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.png", type: "image/png" },
    ],
    apple: [{ url: "/logo.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/manifest.json",
  category: "beauty",
  verification: {
    // Możesz dodać weryfikację Google Search Console tutaj
    // google: "twój-kod-weryfikacyjny",
  },
  other: {
    "geo.region": "PL-18",
    "geo.placename": "Stalowa Wola",
    "geo.position": "50.5826;22.0538",
    ICBM: "49.6886, 21.7703",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pl" className={sora.variable}>
      <head>
        <script
          data-blockingmode="auto"
          data-cbid="ab28b772-2770-4676-bb88-e9338fba0075"
          id="Cookiebot"
          src="https://consent.cookiebot.com/uc.js"
          suppressHydrationWarning
          type="text/javascript"
        ></script>
        <GoogleAnalytics />
        <JsonLd />
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
