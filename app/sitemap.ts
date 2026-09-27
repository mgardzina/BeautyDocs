import { MetadataRoute } from "next";
import { fetchBeautyDocsCatalogProducts } from "@/lib/beautydocs-catalog-api";
import { catalogDetailText, catalogProductPath } from "@/lib/beautydocs-catalog-path";

// Product cards come from the editorial API, so the sitemap must be generated
// at request time instead of freezing an empty list when the API is unavailable at build time.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://beautydocs.pl";
  const result = await fetchBeautyDocsCatalogProducts();
  const productPages: MetadataRoute.Sitemap =
    result.status === "ok"
      ? result.data.items.flatMap((item) => {
          const path = catalogProductPath(item);
          if (!path) return [];
          const reviewedAt = catalogDetailText(item.details, "lastReviewedAt");
          return [
            {
              url: `${baseUrl}${path}`,
              lastModified: reviewedAt ? new Date(`${reviewedAt}T12:00:00Z`) : new Date(),
              changeFrequency: "monthly" as const,
              priority: 0.7,
            },
          ];
        })
      : [];

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${baseUrl}/katalog`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/platforma`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/cennik`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/kontakt`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/polityka-prywatnosci`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/regulamin`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
    ...productPages,
  ];
}
