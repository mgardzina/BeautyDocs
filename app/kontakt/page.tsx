import type { Metadata } from "next";
import {
  BeautyDocsContact,
  BeautyDocsMarketingFooter,
  BeautyDocsMarketingHeader,
} from "../../components/beautydocs/marketing";

export const metadata: Metadata = {
  title: { absolute: "Kontakt — BeautyDocs" },
  description:
    "Umów indywidualną prezentację BeautyDocs dla swojego salonu — pokażemy platformę i pomożemy dobrać formularze pod usługi.",
  robots: { index: true, follow: true },
};

export default function BeautyDocsContactPage() {
  return (
    <div className="min-h-screen bg-[#fcfaf8] text-[#241d21]">
      <a
        className="sr-only z-50 rounded-lg bg-white px-4 py-2 font-bold text-[#241d21] focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        href="#kontakt"
      >
        Przejdź do treści
      </a>
      <BeautyDocsMarketingHeader />
      <main>
        <BeautyDocsContact />
      </main>
      <BeautyDocsMarketingFooter />
    </div>
  );
}
