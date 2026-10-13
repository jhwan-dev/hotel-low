import type { CapacitorConfig } from "@capacitor/cli";

/**
 * server.url points the WebView straight at the real deployed site —
 * there's no bundled build of this app (Server Actions, cookies, and
 * dynamic routes without generateStaticParams are all unsupported under
 * Next's static export; see the push-notifications plan for the full
 * reasoning). webDir/www is a required-but-unused placeholder.
 *
 * Capacitor's own docs call server.url "not intended for use in
 * production" — that warning is aimed at live-reload dev servers. It's
 * still the only viable way to ship *this* app, since none of it can be
 * statically bundled.
 */
const config: CapacitorConfig = {
  appId: "com.hotellow.app",
  appName: "HOTELow",
  webDir: "www",
  server: {
    url: "https://hotel-low.com",
  },
  plugins: {
    // Without this, a push that arrives while the app is open and visible
    // wouldn't show anything at all on Android — only background/killed
    // delivery shows a system notification by default.
    PushNotifications: {
      presentationOptions: ["alert", "sound"],
    },
  },
};

export default config;
