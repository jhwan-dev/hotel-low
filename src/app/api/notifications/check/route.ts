import { NextResponse } from "next/server";
import { checkPriceAlerts } from "@/lib/notifications/checkPriceAlerts";

/**
 * Manual/cron trigger for the price-check job. Not wired to a schedule yet —
 * call it by hand for now (`curl -X POST /api/notifications/check`), or add
 * a `crons` entry pointing here once a real polling cadence is decided.
 */
export async function POST() {
  const summary = await checkPriceAlerts();
  return NextResponse.json(summary);
}
