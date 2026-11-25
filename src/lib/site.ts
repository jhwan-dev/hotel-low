import type { Metadata } from "next";

/**
 * Public identity of the deployed site — one place for the values that
 * `metadata` (title/description/Open Graph) and anything else that has to
 * speak in the product's own voice reach for.
 */

/** Production origin. Used as `metadataBase`, so `openGraph.url` and the
 * generated OG/Twitter image URLs can stay relative. */
export const SITE_URL = "https://hotel-low.vercel.app";

export const SITE_NAME = "HOTELow";

export const SITE_TITLE = "HOTELow — 호텔 가격이 내려가면 알려드려요";

export const SITE_DESCRIPTION =
  "여행 날짜와 호텔을 선택하면 가격을 지속적으로 추적하고, 가격이 내려갔을 때 알려드립니다.";

/**
 * Open Graph / Twitter defaults for the whole site.
 *
 * These are functions, not shared objects, on purpose: Next resolves metadata
 * per route segment and writes defaults back into the objects it is given, so
 * handing the same object to both the layout and a page (or reading one twice)
 * makes later segments resolve against polluted data — with a shared object
 * the `twitter` block came out of the renderer with no tags at all. A fresh
 * object per segment avoids that.
 *
 * A page that sets `openGraph` (or `twitter`) replaces the layout's instead of
 * merging into it, so a page pinning just `openGraph.url` also spreads
 * `baseOpenGraph()` to keep `og:site_name`, `og:type` and `og:locale`.
 */
export function baseOpenGraph(): NonNullable<Metadata["openGraph"]> {
  return {
    type: "website",
    siteName: SITE_NAME,
    locale: "ko_KR",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  };
}

export function baseTwitter(): NonNullable<Metadata["twitter"]> {
  return {
    // Large card: the OG image (app/opengraph-image.tsx) is 1200×630.
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  };
}
