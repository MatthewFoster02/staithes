// Builders for schema.org JSON-LD. Kept free of React so they can be
// used from route handlers too. Each builder returns `unknown` so the
// consumer serialises with JSON.stringify — Next can't embed JSON-LD
// via its metadata API so we render a <script type="application/ld+json">
// tag manually in the page.

import { siteUrl } from "@/lib/seo/site";

export interface PropertyLdInput {
  name: string;
  description: string;
  propertyType: string;
  addressApprox: string;
  latitude: number;
  longitude: number;
  maxGuests: number;
  bedrooms: number;
  beds: number;
  bathrooms: number;
  baseNightlyRate: string;
  currency: string;
  /** Absolute URLs, already resolved via propertyPhotoUrl. */
  imageUrls: string[];
}

export interface ReviewLdInput {
  id: string;
  guestDisplayName: string;
  ratingOverall: number;
  reviewText: string;
  createdISO: string;
}

export interface AggregateRatingLdInput {
  averageOverall: number;
  count: number;
}

// schema.org doesn't have a direct `VacationRental` type in core, but
// `LodgingBusiness` is widely supported and Google treats it as the
// canonical lodging type. We also add `additionalType` pointing at
// the VacationRental extension so compatible crawlers can pick it up.
export function propertyLd(
  input: PropertyLdInput,
  aggregate: AggregateRatingLdInput | null,
  reviews: ReviewLdInput[],
): unknown {
  const base = siteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "LodgingBusiness",
    "@id": `${base}/#property`,
    additionalType: "https://schema.org/VacationRental",
    name: input.name,
    description: input.description,
    url: base,
    image: input.imageUrls,
    address: {
      "@type": "PostalAddress",
      addressLocality: input.addressApprox,
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: input.latitude,
      longitude: input.longitude,
    },
    numberOfRooms: input.bedrooms,
    occupancy: {
      "@type": "QuantitativeValue",
      maxValue: input.maxGuests,
      unitText: "people",
    },
    amenityFeature: [
      {
        "@type": "LocationFeatureSpecification",
        name: "Beds",
        value: input.beds,
      },
      {
        "@type": "LocationFeatureSpecification",
        name: "Bathrooms",
        value: input.bathrooms,
      },
    ],
    priceRange: `${input.currency} ${input.baseNightlyRate}`,
    offers: {
      "@type": "Offer",
      priceCurrency: input.currency,
      price: input.baseNightlyRate,
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: input.baseNightlyRate,
        priceCurrency: input.currency,
        unitCode: "DAY",
      },
      availability: "https://schema.org/InStock",
      url: base,
    },
    ...(aggregate && aggregate.count > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: Number(aggregate.averageOverall.toFixed(2)),
            reviewCount: aggregate.count,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
    ...(reviews.length > 0
      ? {
          review: reviews.map((r) => ({
            "@type": "Review",
            "@id": `${base}/#review-${r.id}`,
            author: { "@type": "Person", name: r.guestDisplayName },
            datePublished: r.createdISO,
            reviewBody: r.reviewText,
            reviewRating: {
              "@type": "Rating",
              ratingValue: r.ratingOverall,
              bestRating: 5,
              worstRating: 1,
            },
          })),
        }
      : {}),
  };
}

export interface OrganisationLdInput {
  siteName: string;
  logoUrl: string | null;
  contactEmail: string;
  contactPhone: string | null;
}

export function organisationLd(input: OrganisationLdInput): unknown {
  const base = siteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${base}/#organization`,
    name: input.siteName,
    url: base,
    ...(input.logoUrl ? { logo: input.logoUrl } : {}),
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      email: input.contactEmail,
      ...(input.contactPhone ? { telephone: input.contactPhone } : {}),
    },
  };
}

export function websiteLd(siteName: string): unknown {
  const base = siteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${base}/#website`,
    url: base,
    name: siteName,
    inLanguage: "en-GB",
  };
}
