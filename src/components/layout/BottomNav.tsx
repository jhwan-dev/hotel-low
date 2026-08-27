"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import { cn } from "@/lib/cn";
import type { IconProps } from "@/components/icons";
import {
  BellIcon,
  BookmarkIcon,
  HomeIcon,
  SearchIcon,
  UserIcon,
} from "@/components/icons";

export interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<IconProps>;
}

export const defaultNavItems: NavItem[] = [
  { href: "/", label: "홈", icon: HomeIcon },
  { href: "/search", label: "검색", icon: SearchIcon },
  { href: "/tracking", label: "가격추적", icon: BookmarkIcon },
  { href: "/alerts", label: "알림", icon: BellIcon },
  { href: "/me", label: "마이", icon: UserIcon },
];

export interface BottomNavProps {
  items?: NavItem[];
}

export function BottomNav({ items = defaultNavItems }: BottomNavProps) {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur md:hidden">
      <div className="mx-auto flex h-16 w-full max-w-screen-sm items-center justify-around px-2">
        {items.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex min-w-16 flex-col items-center justify-center gap-0.5 rounded-control py-1.5 text-caption transition-colors",
                active ? "text-primary" : "text-ink-muted",
              )}
              aria-current={active ? "page" : undefined}
            >
              <span
                className={cn(
                  "flex h-9 w-16 items-center justify-center rounded-full",
                  active && "bg-primary-light",
                )}
              >
                <Icon width={20} height={20} />
              </span>
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
