import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Search, Tags } from "lucide-react";
import { BeautyDocsPublicCatalog } from "@/components/beautydocs/catalog/BeautyDocsPublicCatalog";
import {
  BeautyDocsMarketingFooter,
  BeautyDocsMarketingHeader,
} from "@/components/beautydocs/marketing";
import { fetchBeautyDocsCatalogProducts } from "@/lib/beautydocs-catalog-api";

// Keep the public catalogue server-rendered from the current editorial API.
// A deployment must not freeze the temporary "unavailable" state into static HTML.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Porównywarka cen beauty — kosmetyki i preparaty | BeautyDocs" },
  description:
    "Porównuj ceny kosmetyków, preparatów i urządzeń beauty. Filtruj oferty po marce, rodzaju produktu oraz obszarze zabiegowym.",
  alternates: { canonical: "/katalog" },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: "pl_PL",
    url: "/katalog",
    siteName: "BeautyDocs",
    title: "Porównywarka cen produktów beauty",
    description:
      "Kosmetyki, preparaty i urządzenia z cenami, osobnymi kartami, źródłami oraz filtrami.",
  },
};

export default async function PublicCatalogPage() {
  const result = await fetchBeautyDocsCatalogProducts();
  const items = result.status === "ok" ? result.data.items : [];

  return <div className="bd-public-page bd-catalog-page"><a className="bd-skip" href="#katalog-tresc">Przejdź do katalogu</a><BeautyDocsMarketingHeader />
    <main id="katalog-tresc"><section className="bd-catalog-intro bd-container"><div><p className="bd-eyebrow"><span className="bd-dot" /> Katalog BeautyDocs</p><h1>Dobre wybory.<br /><span className="bd-serif">Zaczynają się tutaj.</span></h1></div><div><p className="bd-description">Odkrywaj produkty do swojego salonu i porównuj oferty w jednym miejscu. Od codziennej pielęgnacji po profesjonalne urządzenia.</p><div className="bd-catalog-benefits"><span><Search size={16} aria-hidden="true" /> Produkty i marki</span><span><Tags size={16} aria-hidden="true" /> Porównanie ofert</span></div></div></section>
      {result.status === "ok" ? <BeautyDocsPublicCatalog items={items} /> : <section className="bd-container bd-catalog-unavailable"><h2>Katalog jest chwilowo niedostępny</h2><p>Spróbuj ponownie za chwilę. Twoje miejsce do odkrywania produktów będzie tutaj.</p><Link className="bd-button bd-button-outline" href="/katalog">Odśwież katalog</Link></section>}
      <section className="bd-container bd-catalog-cta"><div><p className="bd-eyebrow">Dla Twojego salonu</p><h2>Od wybranego produktu<br /><span className="bd-serif">do uporządkowanej wizyty.</span></h2><p>Produkty, zabiegi i dokumentacja w jednym miejscu.</p></div><Link className="bd-button bd-button-primary" href="/platforma">Poznaj platformę <ArrowRight size={17} aria-hidden="true" /></Link></section>
    </main><BeautyDocsMarketingFooter /></div>;
}
