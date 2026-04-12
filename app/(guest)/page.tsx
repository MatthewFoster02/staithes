import { prisma } from "@/lib/db/prisma";
import { PhotoGallery, type GalleryPhoto } from "@/components/property/photo-gallery";
import { Button } from "@/components/ui/button";

export default async function HomePage() {
  const property = await prisma.property.findFirst({
    include: {
      photos: { orderBy: { sortOrder: "asc" } },
    },
  });

  const galleryPhotos: GalleryPhoto[] =
    property?.photos.map((p) => ({
      id: p.id,
      url: p.url,
      altText: p.altText,
      category: p.category,
    })) ?? [];

  return (
    <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {property?.name ?? "Welcome to Staithes"}
        </h1>
        {property?.shortDescription && (
          <p className="mt-2 text-lg text-neutral-600">{property.shortDescription}</p>
        )}
      </header>

      <PhotoGallery photos={galleryPhotos} />

      <div className="mt-10 flex justify-center">
        <Button>Check availability</Button>
      </div>
    </section>
  );
}
