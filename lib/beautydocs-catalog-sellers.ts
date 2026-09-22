export interface CatalogSellerIdentity {
  readonly displayName: string;
  readonly logoPath: string | null;
}

const SELLER_LOGOS: Readonly<Record<string, string>> = {
  "authentic beauty concept": "/beautydocs/brands/authentic-beauty-concept.png",
  belnea: "/beautydocs/brands/belnea.png",
  caudalie: "/beautydocs/brands/caudalie.svg",
  clayly: "/beautydocs/brands/clayly.png",
  fedua: "/beautydocs/brands/fedua.png",
  "health labs care": "/beautydocs/brands/health-labs-care.svg",
  instytutum: "/beautydocs/brands/instytutum.svg",
  "la guel": "/beautydocs/brands/la-guel.webp",
  luvee: "/beautydocs/brands/luvee.png",
  medestelle: "/beautydocs/brands/medestelle.png",
  oppoline: "/beautydocs/brands/oppoline.png",
  "revolax polska": "/beautydocs/brands/revolax.svg",
  "sensum mare": "/beautydocs/brands/sensum-mare.svg",
};

export function catalogSellerIdentity(seller: string): CatalogSellerIdentity {
  const displayName = seller.split(" — ", 1)[0]?.trim() || seller.trim();
  const key = normalizeSellerName(displayName);
  return {
    displayName,
    logoPath: SELLER_LOGOS[key] ?? null,
  };
}

function normalizeSellerName(value: string): string {
  return value
    .toLocaleLowerCase("pl")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/ł/g, "l")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
