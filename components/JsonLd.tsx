export default function JsonLd() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "BeautySalon",
    name: "PowderBrows Academy - Malwina Zięba",
    alternateName: "PowderBrows Academy",
    description:
      "Profesjonalny makijaż permanentny brwi, ust i kresek w Stalowej Woli. Naturalne efekty i bezpieczeństwo na pierwszym miejscu. Zabiegi kwasem hialuronowym i depilacja laserowa.",
    url: "https://powderbrowsacademy.com.pl",
    logo: "https://powderbrowsacademy.com.pl/logo.png",
    image: "https://powderbrowsacademy.com.pl/logo.png",
    telephone: "+48733702282",
    email: "powderbrows@gmail.com",
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
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}
