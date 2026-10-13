"use client";

import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";

export type PushPermissionState = "granted" | "denied" | "prompt" | "unavailable";

/**
 * "unavailable" covers the browser (no native platform at all) — callers
 * treat it the same as "don't show anything push-related" as "prompt",
 * just never actually asks.
 */
export async function getPushPermissionState(): Promise<PushPermissionState> {
  if (!Capacitor.isNativePlatform()) return "unavailable";
  const status = await PushNotifications.checkPermissions();
  if (status.receive === "granted" || status.receive === "denied") return status.receive;
  return "prompt";
}

/**
 * Shows the OS permission dialog and registers for a token if granted.
 * Call this only from a direct user action (our own explainer sheet's
 * confirm button) — never on mount, so the OS dialog is never the first
 * thing a user sees.
 */
export async function requestPushPermissionAndRegister(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const result = await PushNotifications.requestPermissions();
  if (result.receive === "granted") {
    await PushNotifications.register();
  }
}

/**
 * Re-registers for a token on every app start if the user already granted
 * permission on a previous visit — tokens can rotate, and this never shows
 * any UI since the OS already has a decision on file. Does nothing if the
 * user hasn't decided yet or has denied; src/components/push/PushPermissionPrompt.tsx
 * (triggered from PriceTrackingCta's first successful tracking-start) is
 * the only place that ever asks.
 */
export async function registerIfAlreadyGranted(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const status = await PushNotifications.checkPermissions();
  if (status.receive === "granted") {
    await PushNotifications.register();
  }
}
