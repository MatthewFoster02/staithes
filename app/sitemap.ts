import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db/prisma";
import { siteUrl } from "@/lib/seo/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const property = await prisma.property.findFirst({
    select: { updatedAt: true },
  });

  return [
    {
      url: `${base}/`,
      lastModified: property?.updatedAt ?? new Date(),
      changeFrequency: "weekly",
      priority: 1.0,
    },
  ];
}
