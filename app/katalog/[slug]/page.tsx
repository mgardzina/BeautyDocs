import { getServerTranslator } from "../../../lib/i18n/server";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { BeautyDocsCatalogProductPage } from "@/components/beautydocs/catalog/BeautyDocsCatalogProductPage";
import type { ProductGalleryImage } from "@/components/beautydocs/catalog/ProductMediaGallery";
import { relatedCatalogProducts } from "@/lib/beautydocs-catalog-related";
import {
  BeautyDocsMarketingFooter,
  BeautyDocsMarketingHeader,
} from "@/components/beautydocs/marketing";
import {
  fetchBeautyDocsCatalogProduct,
  fetchBeautyDocsCatalogProducts,
} from "@/lib/beautydocs-catalog-api";
import {
  catalogDetailList,
  catalogDetailText,
  isCatalogProductSlug,
} from "@/lib/beautydocs-catalog-path";
import { catalogPriceOffers } from "@/lib/beautydocs-catalog-offers";
import type { BeautyDocsCatalogItem } from "@/types/beautydocs-catalog";

const SITE_URL = "https://beautydocs.pl";

interface ProductPageProps {
  readonly params: Promise<{ readonly slug: string }>;
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  if (!isCatalogProductSlug(slug)) return unavailableMetadata();
  const result = await fetchBeautyDocsCatalogProduct(slug);
  if (result.status !== "ok") return unavailableMetadata();

  const item = result.data;
  const imagePath = catalogDetailText(item.details, "imagePath");
  const imageAlt = catalogDetailText(item.details, "imageAlt") ?? item.name;
  const categories = catalogDetailList(item.details, "treatmentCategories");
  const canonical = `/katalog/${slug}`;
  const title = `${item.name} — zastosowanie i informacje | BeautyDocs`;

  return {
    title: { absolute: title },
    description: item.summary,
    keywords: [item.name, item.brand ?? "BeautyDocs", ...categories],
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: {
      type: "website",
      locale: "pl_PL",
      url: canonical,
      siteName: "BeautyDocs",
      title,
      description: item.summary,
      images: imagePath ? [{ url: imagePath, alt: imageAlt }] : undefined,
    },
    twitter: {
      card: imagePath ? "summary_large_image" : "summary",
      title,
      description: item.summary,
      images: imagePath ? [imagePath] : undefined,
    },
  };
}

export default async function CatalogProductPage({ params }: ProductPageProps) {
  const { t } = await getServerTranslator();
  const { slug } = await params;
  if (!isCatalogProductSlug(slug)) notFound();
  const [productResult, listResult] = await Promise.all([
    fetchBeautyDocsCatalogProduct(slug),
    fetchBeautyDocsCatalogProducts(),
  ]);
  if (productResult.status === "invalid" || productResult.status === "not-found") {
    notFound();
  }
  if (productResult.status !== "ok") return <UnavailableProductPage />;

  const item = productResult.data;
  const allItems = listResult.status === "ok" ? listResult.data.items : [];
  const related = relatedCatalogProducts(item, allItems);
  const productUrl = `${SITE_URL}/katalog/${slug}`;
  const details = item.details;
  const brand = item.brand ?? "BeautyDocs";
  const category =
    catalogDetailText(details, "productCategory") ?? fallbackCategory(item);
  const treatmentCategories = catalogDetailList(details, "treatmentCategories");
  const priceOffers = catalogPriceOffers(details);
  const galleryImages = readProductImagePaths(details);
  const structuredData = productStructuredData({
    brand,
    category,
    images: galleryImages,
    item,
    offers: priceOffers,
    productUrl,
    treatmentCategories,
  });

  return (
    <div className="min-h-screen bg-[#f7f8f4] text-[#173d35]">
      <BeautyDocsMarketingHeader />
      <main>
        <script
          dangerouslySetInnerHTML={{ __html: safeJson(structuredData) }}
          type="application/ld+json"
        />

        <div className="mx-auto max-w-[1440px] px-4 pb-24 pt-8 sm:px-6 lg:px-10">
          <nav
            aria-label={t("Okruszki")}
            className="flex flex-wrap items-center gap-2 text-xs font-bold text-stone-500"
          >
            <Link className="transition hover:text-[#245c4d]" href="/">
              {t("BeautyDocs")}
            </Link>
            <span aria-hidden="true">/</span>
            <Link className="transition hover:text-[#245c4d]" href="/katalog">
              {t("Katalog")}
            </Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page" className="text-stone-700">
              {item.name}
            </span>
          </nav>

          <BeautyDocsCatalogProductPage item={item} relatedItems={related} />

          <Link
            className="mt-12 inline-flex min-h-11 items-center gap-2 border-b border-[#bda5ad] pb-1 text-sm font-black text-[#245c4d] transition hover:text-[#173d35]"
            href="/katalog"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />{" "}{t("Wróć do katalogu")}
          </Link>
        </div>
      </main>
      <BeautyDocsMarketingFooter />
    </div>
  );
}

function UnavailableProductPage() {
  return (
    <div className="min-h-screen bg-[#f7f8f4] text-[#173d35]">
      <BeautyDocsMarketingHeader />
      <main className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
        <h1 className="font-serif text-4xl">Karta produktu jest chwilowo niedostępna</h1>
        <p className="mt-4 text-sm leading-7 text-stone-500">
          Spróbuj ponownie za chwilę albo wróć do głównego katalogu.
        </p>
        <Link
          className="mt-7 inline-flex items-center gap-2 rounded-full bg-[#173d35] px-5 py-3 text-sm font-black text-white"
          href="/katalog"
        >
          <ArrowLeft aria-hidden="true" className="size-4" /> Wróć do katalogu
        </Link>
      </main>
      <BeautyDocsMarketingFooter />
    </div>
  );
}

function unavailableMetadata(): Metadata {
  return {
    title: { absolute: "Karta produktu | BeautyDocs" },
    robots: { index: false, follow: false },
  };
}

function fallbackCategory(item: BeautyDocsCatalogItem): string {
  if (item.kind === "DEVICE") return "Urządzenie profesjonalne";
  if (item.kind === "COSMETIC") return "Kosmetyk / dermokosmetyk";
  return "Preparat zabiegowy";
}

function readProductImagePaths(
  details: Readonly<Record<string, unknown>>,
): ProductGalleryImage[] {
  const candidates = Array.isArray(details.productImages) ? details.productImages : [];
  const images = candidates.flatMap((entry): ProductGalleryImage[] => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const record = entry as Readonly<Record<string, unknown>>;
    if (
      typeof record.path !== "string" ||
      !record.path.startsWith("/beautydocs/catalog/") ||
      typeof record.alt !== "string"
    ) {
      return [];
    }
    return [
      {
        path: record.path,
        alt: record.alt,
        fit: record.fit === "cover" ? "cover" : "contain",
        label: typeof record.label === "string" ? record.label : "Produkt",
        note: typeof record.note === "string" ? record.note : null,
        scale: 1,
      },
    ];
  });
  if (images.length > 0) return images;
  const fallbackPath = catalogDetailText(details, "imagePath");
  return fallbackPath
    ? [{ path: fallbackPath, alt: "Produkt", fit: "contain", label: "Produkt", note: null, scale: 1 }]
    : [];
}

function productStructuredData({
  brand,
  category,
  images,
  item,
  offers,
  productUrl,
  treatmentCategories,
}: {
  readonly brand: string;
  readonly category: string;
  readonly images: readonly ProductGalleryImage[];
  readonly item: BeautyDocsCatalogItem;
  readonly offers: ReturnType<typeof catalogPriceOffers>;
  readonly productUrl: string;
  readonly treatmentCategories: readonly string[];
}) {
  const availableOffers = offers.filter(
    (offer) => offer.availability !== "OUT_OF_STOCK",
  );
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Product",
        "@id": `${productUrl}#product`,
        name: item.name,
        description: item.summary,
        url: productUrl,
        image: images.map((image) => `${SITE_URL}${image.path}`),
        brand: { "@type": "Brand", name: brand },
        category,
        ...(availableOffers.length > 0
          ? {
              offers: {
                "@type": "AggregateOffer",
                priceCurrency: "PLN",
                lowPrice: Math.min(...availableOffers.map((offer) => offer.pricePln)),
                highPrice: Math.max(...availableOffers.map((offer) => offer.pricePln)),
                offerCount: availableOffers.length,
                url: productUrl,
              },
            }
          : {}),
        additionalProperty: treatmentCategories.map((value) => ({
          "@type": "PropertyValue",
          name: "Zabieg lub obszar",
          value,
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "BeautyDocs", item: SITE_URL },
          {
            "@type": "ListItem",
            position: 2,
            name: "Katalog",
            item: `${SITE_URL}/katalog`,
          },
          { "@type": "ListItem", position: 3, name: item.name, item: productUrl },
        ],
      },
    ],
  };
}

function safeJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
