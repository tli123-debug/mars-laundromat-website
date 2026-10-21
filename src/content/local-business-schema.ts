import { siteConfig } from "@/content/site-config";

export function createLocalBusinessSchema() {
  const businessUrl = siteConfig.url.replace(/\/$/, "");

  return {
    "@context": "https://schema.org",
    "@type": "Laundromat",
    "@id": `${businessUrl}/#laundromat`,
    name: siteConfig.name,
    description: siteConfig.description,
    url: businessUrl,
    telephone: siteConfig.phoneNumber,
    image: `${businessUrl}/images/storefront.jpg`,
    priceRange: "$",
    currenciesAccepted: "USD",
    paymentAccepted: "Cash, Zelle",
    address: {
      "@type": "PostalAddress",
      streetAddress: siteConfig.address.line1,
      addressLocality: siteConfig.address.city,
      addressRegion: siteConfig.address.state,
      postalCode: siteConfig.address.zip,
      addressCountry: "US",
    },
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        opens: "08:00",
        closes: "19:00",
      },
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Saturday", "Sunday"],
        opens: "08:30",
        closes: "19:00",
      },
    ],
    areaServed: siteConfig.coverageArea.neighborhoods.map((neighborhood) => ({
      "@type": "Place",
      name: `${neighborhood}, Brooklyn, NY`,
    })),
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Laundry services",
      itemListElement: [
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: "Laundry Pickup and Delivery",
            url: `${businessUrl}/pickup-delivery`,
          },
        },
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: "Wash and Fold",
            url: `${businessUrl}/services/wash-and-fold`,
          },
        },
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: "Dry Cleaning and Ironing",
            url: `${businessUrl}/services/dry-cleaning`,
          },
        },
      ],
    },
    potentialAction: {
      "@type": "ReserveAction",
      target: `${businessUrl}/book`,
      name: "Book a laundry pickup",
    },
  } as const;
}
