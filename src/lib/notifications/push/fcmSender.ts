import "server-only";

import type { App } from "firebase-admin/app";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { deviceTokenRepository } from "@/lib/notifications/deviceTokens";
import { getFcmClientEmail, getFcmPrivateKey, getFcmProjectId } from "./env";

export interface PushPayload {
  title: string;
  body: string;
  /** Carried through to the tap handler in src/components/push/PushBridge.tsx (Phase B) — every value must be a string, FCM's data payload doesn't accept anything else. */
  data: Record<string, string>;
}

let app: App | null = null;

/** Lazily initialized so importing this module never fails before isFcmConfigured() has actually been checked. */
function getFcmApp(): App {
  if (app) return app;
  app =
    getApps()[0] ??
    initializeApp({
      credential: cert({
        projectId: getFcmProjectId(),
        clientEmail: getFcmClientEmail(),
        privateKey: getFcmPrivateKey(),
      }),
    });
  return app;
}

/**
 * Sends one push to every device registered for `userId`. A token FCM
 * reports as no longer registered (app uninstalled, notifications revoked)
 * is deleted from device_tokens right here — this sweep is the only thing
 * that would ever notice it's gone stale.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  const tokens = await deviceTokenRepository.listForUser(userId);
  if (tokens.length === 0) return;

  const response = await getMessaging(getFcmApp()).sendEachForMulticast({
    tokens,
    notification: { title: payload.title, body: payload.body },
    data: payload.data,
  });

  await Promise.all(
    response.responses.map((result, i) => {
      if (result.success) return;
      const code = result.error?.code;
      if (
        code === "messaging/registration-token-not-registered" ||
        code === "messaging/invalid-registration-token"
      ) {
        return deviceTokenRepository.remove(tokens[i]);
      }
      console.error(`sendPushToUser: push failed for token ${tokens[i]}`, result.error);
    }),
  );
}
