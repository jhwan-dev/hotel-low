import "server-only";

const DEFAULT_DAILY_LIMIT = 7; // free SerpApi plan: 250/month ÷ ~30 days, rounded down for headroom
const DEFAULT_CRON_RESERVE = 2;

/** Server-only. Callers must already guard with `import "server-only"`. */
export function getSerpApiKey(): string {
  const key = process.env.SERPAPI_API_KEY;
  if (!key) {
    throw new Error(
      "SERPAPI_API_KEY is not set. Callers must check isSerpApiConfigured() first and fall back to the mock provider.",
    );
  }
  return key;
}

export function isSerpApiConfigured(): boolean {
  return Boolean(process.env.SERPAPI_API_KEY);
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = value ? Number.parseInt(value, 10) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

/** Max real SerpApi calls allowed in one day, shared by cron and tracking-start via src/lib/serpapi/callBudget.ts. */
export function getSerpApiDailyLimit(): number {
  return parsePositiveInt(process.env.SERPAPI_DAILY_LIMIT, DEFAULT_DAILY_LIMIT);
}

/** How much of the daily limit the cron job must always leave unspent for tracking-start — see checkPriceAlerts.ts. */
export function getSerpApiCronReserve(): number {
  return parsePositiveInt(process.env.SERPAPI_CRON_RESERVE, DEFAULT_CRON_RESERVE);
}
