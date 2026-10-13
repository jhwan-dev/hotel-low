import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      // Hotel photos are deliberately NOT optimized by Next (every <Image>
      // rendering one sets `unoptimized` — see src/lib/hotels/imageUrl.ts
      // for the full reasoning) and so intentionally have no entries here:
      // scripts/seed-hotel-catalog.ts stores each hotel's own OTA/chain CDN
      // URL verbatim, a newly-seeded hotel can bring a domain nobody's seen
      // before at any time, and Next throws for an unconfigured host rather
      // than just skipping optimization. Leaving this list Unsplash-only
      // means a future component that forgets `unoptimized` fails loudly
      // and immediately in testing — not silently, for some catalog-growth-
      // dependent subset of hotels, the way a partial allowlist would.
    ],
  },
};

export default nextConfig;
