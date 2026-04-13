import type { Metadata } from "next";
import { prisma } from "@/lib/db/prisma";
import { PhotoGallery, type GalleryPhoto } from "@/components/property/photo-gallery";
import { PropertyDetails } from "@/components/property/property-details";
import { PropertyDescription } from "@/components/property/property-description";
import {
  PropertyAmenities,
  type AmenityItem,
} from "@/components/property/property-amenities";
import { PropertyMap } from "@/components/property/property-map";
import { AvailabilityCalendar } from "@/components/property/availability-calendar";
import { ContactHostButton } from "@/components/messaging/contact-host-button";
import { PropertyReviews } from "@/components/reviews/property-reviews";
import { getCurrentUser } from "@/lib/auth/server";
import { propertyPhotoUrl } from "@/lib/storage/photos";
import { siteUrl } from "@/lib/seo/site";

export async function generateMetadata(): Promise<Metadata> {
  const [property, siteConfig] = await Promise.all([
    prisma.property.findFirst({
      include: { photos: { orderBy: { sortOrder: "asc" }, take: 1 } },
    }),
    prisma.siteConfiguration.findFirst(),
  ]);

  const siteName = siteConfig?.siteName ?? "Staithes";
  const title = siteConfig?.seoTitle ?? property?.name ?? siteName;
  const description =
    siteConfig?.seoDescription ??
    property?.shortDescription ??
    "A short-stay holiday rental.";

  const heroPath = property?.photos[0]?.url ?? null;
  const ogImageUrl = siteConfig?.ogImageUrl ?? (heroPath ? propertyPhotoUrl(heroPath) : null);
  const images = ogImageUrl
    ? [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: property?.photos[0]?.altText ?? siteName,
        },
      ]
    : undefined;

  return {
    title: { absolute: title },
    description,
    alternates: {
      canonical: siteUrl(),
    },
    openGraph: {
      type: "website",
      url: siteUrl(),
      siteName,
      title,
      description,
      images,
      locale: "en_GB",
    },
    twitter: {
      card: images ? "summary_large_image" : "summary",
      title,
      description,
      images: images?.map((i) => i.url),
    },
  };
}

export default async function HomePage() {
  const [property, user] = await Promise.all([
    prisma.property.findFirst({
      include: {
        photos: { orderBy: { sortOrder: "asc" } },
        amenities: {
          include: { amenity: true },
          orderBy: { amenity: { sortOrder: "asc" } },
        },
      },
    }),
    getCurrentUser(),
  ]);

  // Reviews lookups happen in parallel with the rest of the page in
  // a separate block because they depend on `property` existing.
  const reviewsData = property
    ? await Promise.all([
        prisma.review.findMany({
          where: { propertyId: property.id, isPublished: true },
          include: { guest: { select: { firstName: true, lastName: true } } },
          orderBy: { createdAt: "desc" },
          take: 6,
        }),
        prisma.review.aggregate({
          where: { propertyId: property.id, isPublished: true },
          _avg: { ratingOverall: true },
          _count: { _all: true },
        }),
      ])
    : null;
  const reviewRows = (reviewsData?.[0] ?? []).map((r) => ({
    id: r.id,
    guestFirstName: r.guest.firstName,
    guestLastInitial: r.guest.lastName.charAt(0),
    ratingOverall: Number(r.ratingOverall),
    reviewText: r.reviewText,
    hostResponse: r.hostResponse,
    createdAt: r.createdAt,
  }));
  const reviewCount = reviewsData?.[1]._count._all ?? 0;
  const reviewAverage = reviewsData?.[1]._avg.ratingOverall
    ? Number(reviewsData[1]._avg.ratingOverall)
    : null;

  if (!property) {
    return (
      <section className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h1 className="text-3xl font-semibold">No property configured</h1>
        <p className="mt-2 text-neutral-600">
          Run <code className="rounded bg-neutral-100 px-1.5 py-0.5">npx prisma db seed</code> to
          populate the database.
        </p>
      </section>
    );
  }

  const galleryPhotos: GalleryPhoto[] = property.photos.map((p) => ({
    id: p.id,
    url: p.url,
    altText: p.altText,
    category: p.category,
  }));

  const amenityItems: AmenityItem[] = property.amenities.map((pa) => ({
    id: pa.amenity.id,
    name: pa.amenity.name,
    icon: pa.amenity.icon,
    category: pa.amenity.category,
  }));

  return (
    <article className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {property.name}
          </h1>
          {property.shortDescription && (
            <p className="mt-2 text-lg text-neutral-600">{property.shortDescription}</p>
          )}
          <p className="mt-1 text-sm text-neutral-500">{property.addressApprox}</p>
        </div>
        <ContactHostButton isSignedIn={!!user} />
      </header>

      <PhotoGallery photos={galleryPhotos} />

      <div className="mt-10 grid gap-10 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-10">
          <section>
            <h2 className="mb-4 text-xl font-semibold tracking-tight">
              About this place
            </h2>
            <PropertyDetails
              bedrooms={property.bedrooms}
              beds={property.beds}
              bathrooms={Number(property.bathrooms)}
              maxGuests={property.maxGuests}
            />
          </section>

          <section>
            <PropertyDescription description={property.description} />
          </section>

          <section>
            <h2 className="mb-4 text-xl font-semibold tracking-tight">
              What this place offers
            </h2>
            <PropertyAmenities amenities={amenityItems} />
          </section>

          <section>
            <h2 className="mb-1 text-xl font-semibold tracking-tight">
              Where you&rsquo;ll be
            </h2>
            <p className="mb-4 text-sm text-neutral-600">{property.addressApprox}</p>
            <PropertyMap
              latitude={Number(property.latitude)}
              longitude={Number(property.longitude)}
              areaName={property.addressApprox}
            />
          </section>

          <section>
            <h2 className="mb-4 text-xl font-semibold tracking-tight">Reviews</h2>
            <PropertyReviews
              averageOverall={reviewAverage}
              count={reviewCount}
              reviews={reviewRows}
            />
          </section>
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <AvailabilityCalendar
            baseNightlyRate={String(property.baseNightlyRate)}
            currency={property.currency}
            minStay={property.minStayDefault}
            maxStay={property.maxStay}
            maxGuests={property.maxGuests}
            isSignedIn={!!user}
          />
        </aside>
      </div>
    </article>
  );
}
