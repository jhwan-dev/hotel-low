import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import Link from "next/link";
import { BellIcon } from "@/components/icons";
import { BottomNav, Header } from "@/components/layout";
import { PushBridge } from "@/components/push/PushBridge";
import { Button } from "@/components/ui";
import { signOut } from "@/lib/auth/actions";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { notificationService } from "@/lib/notifications";
import { baseOpenGraph, baseTwitter, SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL } from "@/lib/site";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Without this, og:image (from app/opengraph-image.tsx) and og:url can't be
  // resolved to absolute URLs and link previews come out blank.
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  title: {
    default: SITE_TITLE,
    template: "%s | HOTELow",
  },
  description: SITE_DESCRIPTION,
  openGraph: baseOpenGraph(),
  twitter: baseTwitter(),
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();
  const isSignedIn = Boolean(user && !user.isMock);
  // Every page goes through this layout — a Supabase hiccup here must never
  // take the whole app down over a notification badge count.
  let unreadCount = 0;
  if (user) {
    try {
      unreadCount = await notificationService.countUnread(user.id);
    } catch (err) {
      console.error("RootLayout: countUnread failed", err);
    }
  }

  return (
    <html lang="ko" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-background font-sans text-foreground">
        <PushBridge />
        <Header
          rightSlot={
            <>
              <Link href="/alerts" className="relative text-ink">
                <BellIcon />
                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-price-up px-1 text-[0.625rem] font-bold leading-none text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Link>
              {isSignedIn ? (
                <form action={signOut.bind(null, "/")}>
                  <Button type="submit" variant="ghost" size="sm" className="px-2">
                    로그아웃
                  </Button>
                </form>
              ) : (
                <Link href="/login" className="text-small font-semibold text-primary">
                  로그인
                </Link>
              )}
            </>
          }
        />
        <main className="flex-1 pb-20 md:pb-8">{children}</main>
        <BottomNav />
      </body>
      {/* 트래블페이아웃 Drive 사이트 인증용 — 자동 링크 변환 기능은 대시보드에서 끔 */}
      <Script
        id="travelpayouts-drive"
        dangerouslySetInnerHTML={{
          __html: `(function () {
      var script = document.createElement("script");
      script.async = 1;
      script.setAttribute("data-cmp-ab","2");
      script.src = 'https://emrldco.com/NTg0MDMw.js?t=584030';
      document.head.appendChild(script);
    })();`,
        }}
      />
    </html>
  );
}
