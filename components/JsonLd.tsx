export default function JsonLd() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "BeautySalon",
    name: "BeautyDocs",
    description:
      "BeautyDocs — cyfrowa platforma dla salonów beauty. Formularze zgody, dokumentacja klientów i zarządzanie gabinetem w jednym miejscu.",
    url: "https://beautydocs.pl",
    logo: "https://beautydocs.pl/logo.png",
    image: "https://beautydocs.pl/logo.png",
    address: {
      "@type": "PostalAddress",
      streetAddress: "ul. Siedlanowskiego 3, lokal 12",
      addressLocality: "Stalowa Wola",
      postalCode: "37-450",
      addressCountry: "PL",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: 50.5826,
      longitude: 22.0538,
    },
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        opens: "09:00",
        closes: "18:00",
      },
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: "Saturday",
        opens: "09:00",
        closes: "14:00",
      },
    ],
    priceRange: "$$",
    currenciesAccepted: "PLN",
    paymentAccepted: "Cash, Credit Card, Bank Transfer",
    areaServed: {
      "@type": "City",
      name: "Krosno",
    },
    sameAs: [
      "https://www.facebook.com/royallips",
      "https://www.instagram.com/royallips",
    ],
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Usługi kosmetyczne",
      itemListElement: [
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: "Makijaż permanentny brwi",
            description:
              "Profesjonalny makijaż permanentny brwi metodą microblading lub pudrową",
          },
        },
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: "Makijaż permanentny ust",
            description: "Konturowanie i koloryzacja ust techniką permanentną",
          },
        },
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: "Kwas hialuronowy",
            description:
              "Zabiegi z użyciem kwasu hialuronowego na twarz i ciało",
          },
        },
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: "Depilacja laserowa",
            description: "Trwałe usuwanie owłosienia laserem diodowym",
          },
        },
      ],
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "5.0",
      reviewCount: "47",
      bestRating: "5",
      worstRating: "1",
    },
  };

  return (
    <script
      data-cookieconsent="ignore"
      suppressHydrationWarning
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}
