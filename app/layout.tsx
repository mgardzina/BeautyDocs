import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import "./marketing.css";
import GoogleAnalytics from "../components/GoogleAnalytics";
import AuthProvider from "../components/AuthProvider";
import JsonLd from "../components/JsonLd";
import { BeautyDocsI18nProvider } from "../components/beautydocs/i18n";
import { LOCALE_INFO } from "../lib/i18n/config";
import { getRequestLocale } from "../lib/i18n/server";
import { messagesFor } from "../lib/i18n/translate";

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

const siteUrl = "https://beautydocs.pl";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#F2EDE7",
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "BeautyDocs - Platforma dla salonów beauty",
    template: "%s | BeautyDocs",
  },
  description:
    "BeautyDocs — cyfrowa platforma dla salonów beauty. Formularze zgody, dokumentacja klientów i zarządzanie gabinetem w jednym miejscu.",
  keywords: [
    "platforma beauty",
    "formularze zgody beauty",
    "dokumentacja salon",
    "makijaż permanentny",
    "BeautyDocs",
    "zarządzanie salonem",
    "beauty salon oprogramowanie",
  ],
  authors: [{ name: "BeautyDocs" }],
  creator: "BeautyDocs",
  publisher: "BeautyDocs",
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
    siteName: "BeautyDocs",
    title: "BeautyDocs - Platforma dla salonów beauty",
    description:
      "BeautyDocs — cyfrowa platforma dla salonów beauty. Formularze zgody, dokumentacja klientów i zarządzanie gabinetem.",
    images: [
      {
        url: "/logo.png",
        width: 512,
        height: 512,
        alt: "BeautyDocs Logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "BeautyDocs - Platforma dla salonów beauty",
    description:
      "BeautyDocs — cyfrowa platforma dla salonów beauty. Formularze zgody i dokumentacja klientów.",
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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getRequestLocale();
  return (
    <html lang={LOCALE_INFO[locale].htmlLang} className={sora.variable}>
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
        <AuthProvider>
          <BeautyDocsI18nProvider locale={locale} messages={messagesFor(locale)}>
            {children}
          </BeautyDocsI18nProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
