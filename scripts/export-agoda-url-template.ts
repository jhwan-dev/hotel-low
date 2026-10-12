/**
 * Writes scripts/.output/agoda-detail-urls.csv — one row per SerpApi-seeded
 * hotel, with an empty "아고다URL" column for a human to fill in by hand
 * (the detail-page path isn't derivable from anything SerpApi returns — see
 * supabase/migrations/0009_hotel_agoda_booking_link.sql). Paste either the
 * full agoda.com URL or just its path into that column; either form is
 * fine, scripts/import-agoda-detail-urls.ts normalizes it down to a path.
 *
 * Run with `npm run export:agoda-urls`, fill in the CSV, then
 * `npm run import:agoda-urls`.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const OUTPUT_FILE = path.join(process.cwd(), "scripts", ".output", "agoda-detail-urls.csv");

function requireSupabaseConfig(): { url: string; serviceRoleKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    console.error(
      "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY가 필요합니다. .env.local을 채운 뒤 다시 실행해주세요.",
    );
    process.exit(1);
  }
  return { url, serviceRoleKey };
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

interface HotelRow {
  id: string;
  city: string;
  name: string;
  agoda_hid: string | null;
  agoda_detail_path: string | null;
}

async function main() {
  const { url, serviceRoleKey } = requireSupabaseConfig();
  const supabase = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase
    .from("hotels")
    .select("id, city, name, agoda_hid, agoda_detail_path")
    .eq("provider", "agoda")
    .order("city")
    .order("name");
  if (error) throw error;

  const rows = (data ?? []) as HotelRow[];
  const lines = [
    ["id", "city", "name", "hid", "아고다URL"].join(","),
    ...rows.map((row) =>
      [
        csvCell(row.id),
        csvCell(row.city),
        csvCell(row.name),
        csvCell(row.agoda_hid ?? ""),
        // Pre-fill with whatever's already set, so re-running this after a
        // partial import doesn't throw away previously-filled-in rows.
        csvCell(row.agoda_detail_path ?? ""),
      ].join(","),
    ),
  ];

  await mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
  await writeFile(OUTPUT_FILE, lines.join("\n") + "\n", "utf8");
  console.log(`${rows.length}개 호텔 -> ${OUTPUT_FILE}`);
  console.log(`"아고다URL" 칸을 채운 뒤 npm run import:agoda-urls 를 실행하세요.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
