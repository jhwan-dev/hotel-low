import "server-only";

/** Server-only. Callers must already guard with `import "server-only"`. */
export function getCronSecret(): string {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    throw new Error(
      "CRON_SECRET is not set. /api/notifications/check must never run without it configured.",
    );
  }
  return secret;
}
