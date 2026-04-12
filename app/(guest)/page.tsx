import Image from "next/image";
import { prisma } from "@/lib/db/prisma";
import { propertyPhotoUrl } from "@/lib/storage/photos";
import { Button } from "@/components/ui/button";

export default async function HomePage() {
  const property = await prisma.property.findFirst({
    include: {
      photos: { orderBy: { sortOrder: "asc" }, take: 1 },
    },
  });

  const heroPhoto = property?.photos[0];

  return (
    <section className="mx-auto max-w-3xl px-6 py-16 text-center">
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
        {property?.name ?? "Welcome to Staithes"}
      </h1>
      <p className="mt-4 text-lg text-neutral-600">
        {property?.shortDescription ?? "A peaceful coastal escape."}
      </p>

      {heroPhoto && (
        <div className="relative mt-10 aspect-[16/10] w-full overflow-hidden rounded-2xl bg-neutral-100">
          <Image
            src={propertyPhotoUrl(heroPhoto.url)}
            alt={heroPhoto.altText}
            fill
            priority
            sizes="(max-width: 768px) 100vw, 768px"
            className="object-cover"
          />
        </div>
      )}

      <div className="mt-8 flex justify-center">
        <Button>Check availability</Button>
      </div>
    </section>
  );
}
