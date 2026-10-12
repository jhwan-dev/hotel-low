import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      // Hotel photo hosts actually seen in cached SerpApi Google Hotels
      // responses for the Osaka/Tokyo/Danang catalog (scripts/seed-hotel-catalog.ts)
      // — each hotel's own OTA/chain CDN, not something SerpApi itself serves.
      // Re-seeding a new city can surface a host not in this list yet; if hotel
      // images start 404ing again after that, check which domain is new.
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "d2hyz2bfif3cr8.cloudfront.net",
      },
      {
        protocol: "https",
        hostname: "photos.hotelbeds.com",
      },
      {
        protocol: "https",
        hostname: "www.iceportal.com",
      },
    ],
  },
};

export default nextConfig;
