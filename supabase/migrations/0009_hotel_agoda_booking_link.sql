-- Lets buildBookingUrl() (src/lib/hotels/serpapi/mapper.ts) link straight to
-- Agoda's real public detail page instead of the generic search-results
-- fallback. Two independent, nullable fields:
--
--   agoda_hid          Agoda's own numeric hotel id. Backfilled for every
--                       existing catalog hotel by scripts/fill-agoda-hid.ts,
--                       decoded out of the pcurl SerpApi already returned
--                       (no new API calls) — used only as the fallback
--                       partnersearch.aspx?hid=... link when no detail path
--                       is set below.
--
--   agoda_detail_path  The path portion of Agoda's canonical detail page
--                       (e.g. "rihga-royal-hotel-osaka/hotel/osaka-jp.html"),
--                       no leading slash, no "/ko-kr/" locale prefix (that's
--                       added at URL-build time). Not derivable from
--                       anything SerpApi returns — filled in by hand via
--                       scripts/export-agoda-url-template.ts +
--                       scripts/import-agoda-detail-urls.ts.
alter table public.hotels
  add column agoda_hid text,
  add column agoda_detail_path text;
