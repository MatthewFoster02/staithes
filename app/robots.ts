import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo/site";

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Authenticated areas — keep them out of search results.
        disallow: ["/api/", "/dashboard/", "/admin/", "/messages/"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
