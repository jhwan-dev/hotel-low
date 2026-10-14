/**
 * Reads the CSV scripts/export-agoda-url-template.ts generated (after a
 * human has filled in its "아고다URL" column) and writes each row's path
 * into hotels.agoda_detail_path. Accepts either a full agoda.com URL or a
 * bare path in that column — this normalizes either down to just the path
 * (no domain, no "/ko-kr/" locale prefix, no leading slash), since the
 * locale is added back at URL-build time in buildBookingUrl().
 *
 * Run with `npm run import:agoda-urls`.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { extractDetailPath } from "@/lib/hotels/agodaLink/detailPath";

const INPUT_FILE = path.join(process.cwd(), "scripts", ".output", "agoda-detail-urls.csv");

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

/** Minimal RFC4180 parser — good enough for the fixed 5-column shape this script's own export produces. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += c;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.length > 1 || r[0] !== "");
}

async function main() {
  const { url, serviceRoleKey } = requireSupabaseConfig();
  const supabase = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let text: string;
  try {
    text = await readFile(INPUT_FILE, "utf8");
  } catch {
    console.error(`${INPUT_FILE} 을 찾을 수 없습니다. 먼저 npm run export:agoda-urls 를 실행해주세요.`);
    process.exit(1);
  }

  const [header, ...rows] = parseCsv(text);
  const idCol = header.indexOf("id");
  const cityCol = header.indexOf("city");
  const nameCol = header.indexOf("name");
  const urlCol = header.indexOf("아고다URL");
  if (idCol === -1 || urlCol === -1) {
    console.error('CSV 헤더에 "id" 또는 "아고다URL" 컬럼이 없습니다 — 파일 형식을 확인해주세요.');
    process.exit(1);
  }

  let updated = 0;
  let skippedEmpty = 0;
  let failed = 0;

  for (const row of rows) {
    const id = row[idCol]?.trim();
    const label = `${row[cityCol] ?? ""} "${row[nameCol] ?? ""}"`;
    if (!id) continue;

    const detailPath = extractDetailPath(row[urlCol] ?? "");
    if (!detailPath) {
      skippedEmpty++;
      continue;
    }

    const { error } = await supabase.from("hotels").update({ agoda_detail_path: detailPath }).eq("id", id);
    if (error) {
      console.warn(`[업데이트 실패] ${label}:`, error);
      failed++;
      continue;
    }
    console.log(`[완료] ${label} -> ${detailPath}`);
    updated++;
  }

  console.log(`\n총 ${rows.length}행 중 ${updated}개 갱신, 빈칸 ${skippedEmpty}개, 실패 ${failed}개.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
