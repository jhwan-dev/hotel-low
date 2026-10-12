"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

export interface AppDownloadBannerProps {
  title?: string;
  description?: string;
  className?: string;
}

const PLAY_STORE_URL = process.env.NEXT_PUBLIC_PLAY_STORE_URL;

/**
 * Nudges a web visitor toward the Android app, where push actually works —
 * src/lib/notifications/service.ts's PushNotificationService only ever has
 * device tokens to send to from inside the app, never from a browser tab.
 *
 * Renders nothing — not even a flash — until NEXT_PUBLIC_PLAY_STORE_URL is
 * set; there's no store listing to link to before launch. Also renders
 * nothing once the native app itself opens this page, checked via the
 * global `window.Capacitor` the native shell injects at runtime rather than
 * the `@capacitor/core` package, which this web app has no reason to depend
 * on before Phase B adds the native shell.
 */
export function AppDownloadBanner({
  title = "앱에서 실시간 알림 받기",
  description = "가격이 떨어지면 앱으로 바로 알려드려요.",
  className,
}: AppDownloadBannerProps) {
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    // `window.Capacitor` doesn't exist during SSR/the first client render —
    // reading it has to wait for an effect, which is exactly why this
    // starts rendered (isNative defaults to false) and flips to hidden
    // right after, instead of deciding during render and risking a
    // hydration mismatch.
    const capacitor = (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsNative(Boolean(capacitor?.isNativePlatform?.()));
  }, []);

  if (!PLAY_STORE_URL || isNative) return null;

  return (
    <a
      href={PLAY_STORE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "flex items-center justify-between gap-3 rounded-card border border-primary-light-2 bg-primary-light/40 p-4",
        className,
      )}
    >
      <div className="flex flex-col gap-0.5">
        <span className="text-small font-semibold text-primary">{title}</span>
        <span className="text-caption text-ink-muted">{description}</span>
      </div>
      <span className="shrink-0 rounded-full bg-primary px-3 py-1.5 text-caption font-semibold text-white">
        앱 설치
      </span>
    </a>
  );
}
