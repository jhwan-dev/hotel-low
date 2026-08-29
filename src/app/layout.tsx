import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import { BellIcon } from "@/components/icons";
import { BottomNav, Header } from "@/components/layout";
import { Button } from "@/components/ui";
import { signOut } from "@/lib/auth/actions";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { notificationService } from "@/lib/notifications";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "HOTELow — 호텔 가격이 내려가면 알려드려요",
    template: "%s | HOTELow",
  },
  description:
    "여행 날짜와 호텔을 선택하면 가격을 지속적으로 추적하고, 가격이 내려갔을 때 알려드립니다.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();
  const isSignedIn = Boolean(user && !user.isMock);
  const unreadCount = user ? await notificationService.countUnread(user.id) : 0;

  return (
    <html lang="ko" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-background font-sans text-foreground">
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
    </html>
  );
}
