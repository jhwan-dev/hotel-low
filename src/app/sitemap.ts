import type { MetadataRoute } from "next";
import { hotelCatalog } from "@/lib/hotels";

const BASE_URL = "https://hotel-low.com";

/**
 * Public, non-personal routes only — /me, /tracking, /alerts, /login,
 * /account are per-user, /api is never a page, and /style-guide is
 * internal. Every /hotels/[id] detail page is appended below from the
 * catalog, which already covers both the mock and Supabase-backed modes
 * via the shared HotelCatalog interface.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL, changeFrequency: "daily", priority: 1 },
    { url: `${BASE_URL}/search`, changeFrequency: "daily", priority: 0.8 },
    { url: `${BASE_URL}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${BASE_URL}/terms`, changeFrequency: "yearly", priority: 0.2 },
  ];

  const entries = await hotelCatalog.listAll();
  const hotelRoutes: MetadataRoute.Sitemap = entries.map((entry) => ({
    url: `${BASE_URL}/hotels/${entry.appHotelId}`,
    changeFrequency: "daily",
    priority: 0.6,
  }));

  return [...staticRoutes, ...hotelRoutes];
}
