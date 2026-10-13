/**
 * Hotel photos come from whatever OTA/chain CDN SerpApi's source listed —
 * scripts/seed-hotel-catalog.ts stores each `original_image` URL verbatim,
 * and a newly-seeded hotel can bring a CDN domain nobody's seen before at
 * any time. That's exactly why every <Image> rendering one of these uses
 * next/image's `unoptimized`: an host next/image doesn't recognize throws
 * instead of just skipping optimization, and Vercel's Hobby-plan image
 * optimizer also caps at 1,000-5,000 unique source images/month — at 400
 * hotels, up to 4 images each (card + detail-page gallery) are reachable,
 * a 1,600 ceiling that already exceeds the lower tier. Pre-shrinking the
 * URL itself sidesteps both: it's a plain string rewrite, no optimizer
 * involved, so no host allowlist and no quota either.
 *
 * Every rewrite below was verified by hand against a real stored URL
 * (curl, comparing byte sizes and content-type) before being added — never
 * guessed blindly, since getting a host's size convention wrong 404s the
 * image outright instead of degrading gracefully. Google and TripAdvisor
 * expose an exact pixel size via a URL param/suffix, so `size` is honored
 * precisely for those; Hotelbeds/CloudFront/trvl-media only expose one
 * discrete smaller tier each (no arbitrary size control), so `size` is
 * just a hint there — always the smallest verified-working tier. Every
 * other host (no safe size-reduction trick found) passes through
 * unchanged, same as before this existed.
 */
export function shrinkHotelImage(url: string, size: number): string {
  if (url.includes("googleusercontent.com")) {
    return /=s\d+$/.test(url) ? url.replace(/=s\d+$/, `=s${size}`) : `${url}=s${size}`;
  }
  if (url.includes("dynamic-media-cdn.tripadvisor.com")) {
    const height = Math.round(size * 0.75);
    return url.replace(/([?&])w=\d+/, `$1w=${size}`).replace(/([?&])h=\d+/, `$1h=${height}`);
  }
  // Tiers verified to exist: original (full size) and bigger (~53x
  // smaller, still a real photo) — "small" also exists but returns a
  // ~2.5KB file suspiciously close to a placeholder, so not used here.
  if (url.includes("photos.hotelbeds.com")) {
    return url.replace("/giata/original/", "/giata/bigger/");
  }
  if (url.includes("d2hyz2bfif3cr8.cloudfront.net")) {
    return url.replace(/_O\.(\w+)$/i, "_S.$1");
  }
  if (url.includes("images.trvl-media.com")) {
    return url.replace(/_z\.(\w+)$/i, "_s.$1");
  }
  return url;
}
