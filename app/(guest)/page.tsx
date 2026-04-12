import { prisma } from "@/lib/db/prisma";
import { PhotoGallery, type GalleryPhoto } from "@/components/property/photo-gallery";
import { PropertyDetails } from "@/components/property/property-details";
import { PropertyDescription } from "@/components/property/property-description";
import {
  PropertyAmenities,
  type AmenityItem,
} from "@/components/property/property-amenities";
import { PropertyMap } from "@/components/property/property-map";
import { Button } from "@/components/ui/button";

export default async function HomePage() {
  const property = await prisma.property.findFirst({
    include: {
      photos: { orderBy: { sortOrder: "asc" } },
      amenities: {
        include: { amenity: true },
        orderBy: { amenity: { sortOrder: "asc" } },
      },
    },
  });

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
      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {property.name}
        </h1>
        {property.shortDescription && (
          <p className="mt-2 text-lg text-neutral-600">{property.shortDescription}</p>
        )}
        <p className="mt-1 text-sm text-neutral-500">{property.addressApprox}</p>
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
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-2xl border border-neutral-200 p-6 shadow-sm">
            <p className="text-sm text-neutral-500">From</p>
            <p className="text-2xl font-semibold">
              £{Number(property.baseNightlyRate).toFixed(0)}{" "}
              <span className="text-base font-normal text-neutral-500">/ night</span>
            </p>
            <Button className="mt-4 w-full">Check availability</Button>
            <p className="mt-3 text-center text-xs text-neutral-500">
              Booking flow coming in Phase 2
            </p>
          </div>
        </aside>
      </div>
    </article>
  );
}
