import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/seo";
export default function sitemap(): MetadataRoute.Sitemap {
  const origin = siteOrigin();
  return origin
    ? [{ url: `${origin}/`, changeFrequency: "monthly", priority: 1 }]
    : [];
}
