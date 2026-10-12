import "server-only";

/**
 * Central place that reads the FCM service-account env vars — same role as
 * src/lib/supabase/env.ts. isFcmConfigured() is the switch
 * src/lib/notifications/index.ts uses to decide between
 * InAppNotificationService and PushNotificationService; leave these unset
 * (no Firebase project yet) and the app keeps behaving exactly as it does
 * today.
 */
export function isFcmConfigured(): boolean {
  return Boolean(
    process.env.FCM_PROJECT_ID && process.env.FCM_CLIENT_EMAIL && process.env.FCM_PRIVATE_KEY,
  );
}

export function getFcmProjectId(): string {
  const value = process.env.FCM_PROJECT_ID;
  if (!value) throw new Error("FCM_PROJECT_ID is not set. Check isFcmConfigured() before calling this.");
  return value;
}

export function getFcmClientEmail(): string {
  const value = process.env.FCM_CLIENT_EMAIL;
  if (!value) throw new Error("FCM_CLIENT_EMAIL is not set. Check isFcmConfigured() before calling this.");
  return value;
}

export function getFcmPrivateKey(): string {
  const value = process.env.FCM_PRIVATE_KEY;
  if (!value) throw new Error("FCM_PRIVATE_KEY is not set. Check isFcmConfigured() before calling this.");
  // Vercel's dashboard round-trips the pasted PEM with literal "\n"
  // sequences instead of real newlines; firebase-admin's cert() needs the
  // real thing.
  return value.replace(/\\n/g, "\n");
}
