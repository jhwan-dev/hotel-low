-- Marks a hotel row's `name` as a placeholder that's safe to silently
-- replace later — only ever set true by
-- src/lib/supabase/hotelsTable.ts's insertHotelFromAgodaMatch (a brand-new
-- row created from an Agoda-link paste-import match, whose only available
-- name at insert time came from an hl=en SerpApi search — see
-- src/lib/hotels/agodaLink/match.ts). Defaults to false, so every existing
-- (seeded, hl=ko) row and every future seeded row is completely unaffected
-- by this migration or by resolveProvisionalName() — that function reads
-- this flag first and does nothing when it's false.
alter table public.hotels
  add column name_is_provisional boolean not null default false;
