import type { Metadata } from "next";
import { BeautyDocsMarketingHeader, BeautyDocsMarketingFooter } from "@/components/beautydocs/marketing";
import { SalonDiscovery } from "@/components/beautydocs/salons/SalonDiscovery";
export const metadata: Metadata = { title: { absolute: "Znajdź swój salon — BeautyDocs" }, description: "Poznaj salony beauty, zobacz zdjęcia, lokalizację i ceny usług." };
export default function SalonsPage() {
  return <div className="bd-public-page bd-salons-page"><a className="bd-skip" href="#salony">Przejdź do salonów</a><BeautyDocsMarketingHeader /><main className="bd-container" id="salony"><header className="bd-salons-heading"><p className="bd-eyebrow">Miejsca, które warto poznać</p><h1>Twój czas.<br /><span className="bd-serif">Twoje miejsce.</span></h1><p>Odkryj salony beauty. Poznaj ludzi, wnętrza i ofertę, zanim wybierzesz miejsce dla siebie.</p></header><SalonDiscovery /></main><BeautyDocsMarketingFooter /></div>;
}
