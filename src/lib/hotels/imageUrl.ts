/**
 * Google Photos/Places CDN (lh3.googleusercontent.com) URLs carry a size
 * suffix — scripts/seed-hotel-catalog.ts stores SerpApi's `original_image`
 * field verbatim, which always ends in "=s10000" (the largest size Google
 * will serve), regardless of where the app actually renders it (anywhere
 * from a 144px thumbnail to a full-width hero). Replaces that suffix with
 * one matching the caller's actual display size so the origin fetch itself
 * is small, not just the bytes Next's own image optimizer re-encodes
 * afterward. Every other host's URL (Unsplash, hotel-chain CDNs) already
 * carries its own sizing and passes through unchanged.
 */
export function resizeGoogleImage(url: string, size: number): string {
  if (!url.includes("googleusercontent.com")) return url;
  if (/=s\d+$/.test(url)) return url.replace(/=s\d+$/, `=s${size}`);
  return `${url}=s${size}`;
}
