import { NextResponse } from "next/server";
import { checkPriceAlerts } from "@/lib/notifications/checkPriceAlerts";
import { getCronSecret } from "@/lib/notifications/env";

function isAuthorized(request: Request): boolean {
  let secret: string;
  try {
    secret = getCronSecret();
  } catch {
    return false;
  }
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

async function runCheck(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const summary = await checkPriceAlerts();
  return NextResponse.json(summary);
}

/**
 * Price-check job trigger. Vercel Cron calls this with GET, sending
 * `Authorization: Bearer $CRON_SECRET` automatically once CRON_SECRET is set
 * as a project env var (https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs).
 * POST is kept for manual/local triggering with the same header:
 * `curl -X POST -H "Authorization: Bearer $CRON_SECRET" /api/notifications/check`.
 */
export async function GET(request: Request) {
  return runCheck(request);
}

export async function POST(request: Request) {
  return runCheck(request);
}
