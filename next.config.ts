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
      // Below: surfaced by removing `unoptimized` from next/image (see the
      // hotel-card/detail-page components) — Next only enforces this
      // allowlist when it actually fetches+optimizes an image itself, so
      // these hosts silently worked all along (the browser just loaded them
      // directly, full original size) without ever needing to be listed
      // here. Queried every distinct image hostname actually stored across
      // the live Osaka/Tokyo/Danang/Fukuoka catalog to get this list.
      {
        protocol: "https",
        hostname: "cdn.ostrovok.ru",
      },
      {
        protocol: "https",
        hostname: "cdn.worldota.net",
      },
      {
        protocol: "https",
        hostname: "dynamic-media-cdn.tripadvisor.com",
      },
      {
        protocol: "https",
        hostname: "i.giatamedia.com",
      },
      {
        protocol: "https",
        hostname: "images.trvl-media.com",
      },
      {
        protocol: "https",
        hostname: "pix8.agoda.net",
      },
      {
        protocol: "https",
        hostname: "restaurant.img-ikyu.com",
      },
    ],
  },
};

export default nextConfig;
