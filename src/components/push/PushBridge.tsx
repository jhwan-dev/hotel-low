"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import type { ActionPerformed, RegistrationError, Token } from "@capacitor/push-notifications";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { registerDeviceToken } from "@/lib/notifications/deviceTokens/actions";
import type { DevicePlatform } from "@/lib/notifications/deviceTokens/repository";

/**
 * Mounted once in the root layout, no-ops entirely in a browser tab —
 * everything here only runs inside the native shell
 * (Capacitor.isNativePlatform()). Handles the whole push lifecycle: asking
 * for permission, registering with FCM, persisting the token against
 * whoever's signed in, and turning a tapped notification into a navigation
 * to the hotel it's about.
 */
export function PushBridge() {
  const router = useRouter();
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const platform: DevicePlatform = Capacitor.getPlatform() === "ios" ? "ios" : "android";

    // Registered before requestPermissions()/register() below — a cold
    // start (app fully closed, launched by tapping the notification itself)
    // still delivers this event once the listener is attached, so it has to
    // be first, not conditional on anything that follows.
    const actionSub = PushNotifications.addListener(
      "pushNotificationActionPerformed",
      (action: ActionPerformed) => {
        const data = action.notification.data as Record<string, string | undefined>;
        const { hotelId, checkIn, checkOut } = data;
        if (!hotelId || !checkIn || !checkOut) return;
        // Same URL shape NotificationListItem.tsx already links to — no new
        // routing logic, just reusing the one the in-app alert list uses.
        router.push(`/hotels/${hotelId}?checkIn=${checkIn}&checkOut=${checkOut}`);
      },
    );

    const registrationSub = PushNotifications.addListener("registration", (token: Token) => {
      tokenRef.current = token.value;
      void registerDeviceToken(token.value, platform);
    });

    const registrationErrorSub = PushNotifications.addListener(
      "registrationError",
      (error: RegistrationError) => {
        console.error("PushBridge: FCM registration failed", error.error);
      },
    );

    void PushNotifications.requestPermissions().then((result) => {
      if (result.receive === "granted") {
        void PushNotifications.register();
      }
    });

    // A token grabbed before sign-in would otherwise never get persisted —
    // registerDeviceToken() itself no-ops without a signed-in user
    // (see src/lib/notifications/deviceTokens/actions.ts), so re-send the
    // same token the moment there's one to attach it to.
    let authSub: { unsubscribe: () => void } | undefined;
    if (isSupabaseConfigured()) {
      const { data } = createClient().auth.onAuthStateChange((event) => {
        if (event === "SIGNED_IN" && tokenRef.current) {
          void registerDeviceToken(tokenRef.current, platform);
        }
      });
      authSub = data.subscription;
    }

    return () => {
      void actionSub.then((handle) => handle.remove());
      void registrationSub.then((handle) => handle.remove());
      void registrationErrorSub.then((handle) => handle.remove());
      authSub?.unsubscribe();
    };
  }, [router]);

  return null;
}
