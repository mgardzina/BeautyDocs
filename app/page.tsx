import type { Metadata } from "next";
import {
  BeautyDocsFeatureGrid,
  BeautyDocsFinalCta,
  BeautyDocsHero,
  BeautyDocsMarketingFooter,
  BeautyDocsMarketingHeader,
  BeautyDocsOnboarding,
  BeautyDocsPricing,
  BeautyDocsReveal,
  BeautyDocsStats,
  type BeautyDocsStatsData,
} from "../components/beautydocs/marketing";
import { fetchPlatformStats } from "../lib/beautydocs-api";

// Render with current API availability; aggregate data is cached for one minute.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "BeautyDocs — dokumentacja dla salonów beauty" },
  description:
    "Wspólny system formularzy, wywiadów i dokumentacji klientek dla salonów beauty.",
  robots: { index: true, follow: true },
};

export default async function BeautyDocsHomePreviewPage() {
  const statsResult = await fetchPlatformStats();
  // Only show real numbers — if the API is unavailable, the section is skipped
  // rather than rendering misleading zeros.
  const stats: BeautyDocsStatsData | null =
    statsResult.status === "ok" ? statsResult.stats : null;

  return (
    <div className="min-h-screen bg-[#f7f8f4] text-[#173d35]">
      <a
        className="sr-only z-50 rounded-lg bg-white px-4 py-2 font-bold text-[#173d35] focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        href="#glowna-tresc"
      >
        Przejdź do treści
      </a>
      <BeautyDocsMarketingHeader />
      <main id="glowna-tresc">
        <BeautyDocsHero />
        <BeautyDocsStats data={stats} />
        <BeautyDocsReveal>
          <BeautyDocsFeatureGrid />
        </BeautyDocsReveal>
        <BeautyDocsReveal>
          <BeautyDocsOnboarding />
        </BeautyDocsReveal>
        <BeautyDocsPricing />
        <BeautyDocsReveal>
          <BeautyDocsFinalCta />
        </BeautyDocsReveal>
      </main>
      <BeautyDocsMarketingFooter />
    </div>
  );
}
