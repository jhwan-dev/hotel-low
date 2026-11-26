import type { MetadataRoute } from "next";

const BASE_URL = "https://hotel-low.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/me", "/tracking", "/alerts", "/login", "/account", "/api", "/style-guide"],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
