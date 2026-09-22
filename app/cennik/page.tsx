import type { Metadata } from "next";
import {
  BeautyDocsFinalCta,
  BeautyDocsMarketingFooter,
  BeautyDocsMarketingHeader,
  BeautyDocsPricing,
  BeautyDocsReveal,
} from "../../components/beautydocs/marketing";

export const metadata: Metadata = {
  title: { absolute: "Cennik — BeautyDocs" },
  description:
    "Prosty cennik BeautyDocs dla salonów beauty — bez ukrytych kosztów, płać za to, czego używasz.",
  robots: { index: true, follow: true },
};

export default function BeautyDocsCennikPage() {
  return (
    <div className="min-h-screen bg-[#f7f8f4] text-[#173d35]">
      <a
        className="sr-only z-50 rounded-lg bg-white px-4 py-2 font-bold text-[#173d35] focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        href="#cennik"
      >
        Przejdź do treści
      </a>
      <BeautyDocsMarketingHeader />
      <main>
        <BeautyDocsPricing standalone />
        <BeautyDocsReveal>
          <BeautyDocsFinalCta />
        </BeautyDocsReveal>
      </main>
      <BeautyDocsMarketingFooter />
    </div>
  );
}
