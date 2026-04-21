import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { propertyPhotoUrl, propertyThumbnailUrl } from "@/lib/storage/photos";
import { PropertyEditForm, type PropertyEditValues } from "@/components/admin/property-edit-form";
import {
  PropertyPhotoManager,
  type PropertyPhotoItem,
} from "@/components/admin/property-photo-manager";

export const metadata: Metadata = {
  title: "Admin · Property",
};

export default async function AdminPropertyPage() {
  const property = await prisma.property.findFirst({
    include: {
      photos: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
    },
  });
  if (!property) notFound();

  const initial: PropertyEditValues = {
    name: property.name,
    slug: property.slug,
    description: property.description,
    shortDescription: property.shortDescription ?? "",
    propertyType: property.propertyType,
    addressFull: property.addressFull,
    addressApprox: property.addressApprox,
    latitude: property.latitude.toString(),
    longitude: property.longitude.toString(),
    maxGuests: property.maxGuests,
    bedrooms: property.bedrooms,
    beds: property.beds,
    bathrooms: property.bathrooms.toString(),
    checkInTime: property.checkInTime,
    checkOutTime: property.checkOutTime,
    minStayDefault: property.minStayDefault,
    maxStay: property.maxStay === null ? "" : String(property.maxStay),
    baseNightlyRate: property.baseNightlyRate.toString(),
    cleaningFee: property.cleaningFee.toString(),
    extraGuestFee: property.extraGuestFee.toString(),
    baseGuestCount: property.baseGuestCount,
    currency: property.currency,
    houseRules: property.houseRules ?? "",
    cancellationPolicy: property.cancellationPolicy,
    status: property.status,
    instantBookingEnabled: property.instantBookingEnabled,
  };

  const photos: PropertyPhotoItem[] = property.photos.map((p) => ({
    id: p.id,
    url: propertyPhotoUrl(p.url),
    thumbnailUrl: propertyThumbnailUrl(p.url, 256),
    altText: p.altText,
    category: p.category,
    caption: p.caption,
    sortOrder: p.sortOrder,
  }));

  return (
    <article className="mx-auto max-w-4xl px-6 py-10 pb-28">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Property</h1>
        <p className="mt-1 text-sm text-neutral-600">
          The public-facing details for {property.name}. Changes go live
          immediately — there&rsquo;s no draft state.
        </p>
      </header>

      <div className="space-y-8">
        <PropertyEditForm initial={initial} />
        <PropertyPhotoManager photos={photos} />
      </div>
    </article>
  );
}
